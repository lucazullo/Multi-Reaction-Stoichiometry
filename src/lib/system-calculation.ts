import type {
  AtomBalance,
  BalanceCheck,
  CalculationInput,
  CalculationResult,
  MassBalance,
  ReactionSystem,
  SeriesLink,
  SubstanceTotals,
  SystemCalculationResult,
  SystemThermodynamics,
  ThermodynamicsResult,
} from "./types";
import {
  calculateStoichiometry,
  calculateThermodynamics,
} from "./conversion";
import { normalizeFormula, parseAtoms, computeMolarMass } from "./utils";
import { lookupSubstanceWithAlias, validateSubstanceProperties } from "./substance-data";
import type { PropertyWarning } from "./substance-data";

/** Compute ideal gas density at STP (0 °C, 1 atm) in kg/m³ */
function idealGasDensitySTP(molarMass: number): number {
  return Math.round((molarMass / 22.414) * 10000) / 10000;
}

/**
 * Calculate the full reaction system starting from any reaction + substance.
 * Propagates FORWARD through outgoing links and BACKWARD through incoming links.
 * Handles multiple outgoing links (splits) and multiple incoming links (merges).
 */
export function calculateSystem(
  system: ReactionSystem,
  startReactionId: string,
  input: CalculationInput
): SystemCalculationResult {
  const perReaction = new Map<string, CalculationResult[]>();
  const nodeMap = new Map(system.nodes.map((n) => [n.id, n]));
  const propertyWarnings: PropertyWarning[] = [];

  // ── Property normalisation (Layers 1–4) ────────────────────────────
  // Track first-seen properties per formula for cross-reaction consistency (Layer 3).
  const firstSeen = new Map<string, {
    density: number | null;
    enthalpyOfFormation: number;
    hhv: number | null;
    lhv: number | null;
    state: string;
  }>();

  for (const node of system.nodes) {
    for (const s of [...node.reaction.reactants, ...node.reaction.products]) {
      const key = normalizeFormula(s.formula);

      // Layer 1a: Deterministic molar mass from IUPAC atomic weights
      const computedMW = computeMolarMass(s.formula);
      if (computedMW !== null) {
        s.molarMass = computedMW;
      }

      // Layer 1b: Deterministic gas density at STP
      if (s.state === "gas") {
        s.densityGas = idealGasDensitySTP(s.molarMass);
      }

      // Layer 2: Override with reference database when available
      const ref = lookupSubstanceWithAlias(key);
      if (ref) {
        s.density = ref.density;
        s.enthalpyOfFormation = ref.enthalpyOfFormation;
        s.hhv = ref.hhv;
        s.lhv = ref.lhv;
        // Don't override state — user may have intentionally changed it
      }

      // Layer 3: Cross-reaction consistency — first-seen wins for non-ref substances
      if (!ref) {
        const existing = firstSeen.get(key);
        if (existing) {
          // Use the first-seen values for consistency
          s.density = existing.density;
          s.enthalpyOfFormation = existing.enthalpyOfFormation;
          s.hhv = existing.hhv;
          s.lhv = existing.lhv;
        } else {
          firstSeen.set(key, {
            density: s.density,
            enthalpyOfFormation: s.enthalpyOfFormation,
            hhv: s.hhv ?? null,
            lhv: s.lhv ?? null,
            state: s.state,
          });
        }
      }

      // Layer 4: Validation constraints
      const warnings = validateSubstanceProperties(key, {
        state: s.state,
        density: s.density,
        enthalpyOfFormation: s.enthalpyOfFormation,
        hhv: s.hhv ?? null,
        lhv: s.lhv ?? null,
      });
      propertyWarnings.push(...warnings);
    }
  }

  // Build adjacency lists in both directions
  const outgoingLinks = new Map<string, SeriesLink[]>();
  const incomingLinks = new Map<string, SeriesLink[]>();
  for (const node of system.nodes) {
    outgoingLinks.set(node.id, []);
    incomingLinks.set(node.id, []);
  }
  for (const link of system.links) {
    outgoingLinks.get(link.fromReactionId)?.push(link);
    incomingLinks.get(link.toReactionId)?.push(link);
  }

  // 1. Calculate the starting reaction
  const startNode = nodeMap.get(startReactionId);
  if (!startNode) throw new Error("Start reaction not found");
  const startResults = calculateStoichiometry(startNode.reaction, input);
  perReaction.set(startReactionId, startResults);

  // 2. Iterative forward + backward propagation
  // We alternate forward and backward passes until no new nodes are calculated.
  // This handles cases like: start at rxn-1 → backward discovers rxn-8 →
  // forward from rxn-8 discovers rxn-2 and rxn-4 (sibling branches).
  let changed = true;
  while (changed) {
    changed = false;

    // Forward pass: propagate from all calculated nodes to their downstream
    const forwardOrder = topologicalForwardAll(system, perReaction, outgoingLinks);

    for (const nodeId of forwardOrder) {
      if (perReaction.has(nodeId)) continue;

      const node = nodeMap.get(nodeId);
      if (!node) continue;

      // Gather all incoming links from already-calculated reactions
      const incoming = (incomingLinks.get(nodeId) ?? []).filter(
        (l) => perReaction.has(l.fromReactionId)
      );
      if (incoming.length === 0) continue;

      // For each incoming link, compute moles available for the target reactant
      const reactantMoles = new Map<number, number>();

      for (const link of incoming) {
        const sourceResults = perReaction.get(link.fromReactionId)!;
        const sourceNode = nodeMap.get(link.fromReactionId)!;
        const productResultIndex =
          sourceNode.reaction.reactants.length + link.fromProductIndex;
        const productResult = sourceResults[productResultIndex];
        if (!productResult) continue;

        // v2: Apply source reaction's conversion factor to product moles
        const sourceConversion = sourceNode.reaction.conversion ?? 1.0;
        const molesAvailable = productResult.moles * sourceConversion * link.fraction;
        const existing = reactantMoles.get(link.toReactantIndex) ?? 0;
        reactantMoles.set(link.toReactantIndex, existing + molesAvailable);
      }

      if (reactantMoles.size === 0) continue;

      // Find limiting reactant (smallest scale factor)
      let minScale = Infinity;
      let limitingIdx = 0;
      let limitingMoles = 0;

      for (const [reactantIndex, moles] of reactantMoles) {
        const substance = node.reaction.reactants[reactantIndex];
        if (!substance) continue;
        const scale = moles / substance.coefficient;
        if (scale < minScale) {
          minScale = scale;
          limitingIdx = reactantIndex;
          limitingMoles = moles;
        }
      }

      const results = calculateStoichiometry(node.reaction, {
        substanceIndex: limitingIdx,
        amount: limitingMoles,
        unit: "mol",
      });
      perReaction.set(nodeId, results);
      changed = true;
    }

    // Backward pass: propagate from all calculated nodes to their upstream
    const backwardOrder = topologicalBackwardAll(system, perReaction, incomingLinks);

    for (const nodeId of backwardOrder) {
      if (perReaction.has(nodeId)) continue;

      const node = nodeMap.get(nodeId);
      if (!node) continue;

      // Find outgoing links to already-calculated reactions
      const outgoing = (outgoingLinks.get(nodeId) ?? []).filter(
        (l) => perReaction.has(l.toReactionId)
      );
      if (outgoing.length === 0) continue;

      // For each outgoing link, compute how much product this reaction must produce
      // to satisfy the downstream reactant needs
      let maxScale = 0;

      for (const link of outgoing) {
        const targetResults = perReaction.get(link.toReactionId)!;
        const reactantResult = targetResults[link.toReactantIndex];
        if (!reactantResult) continue;

        // How much does the downstream need from us?
        const molesNeeded = reactantResult.moles / (link.fraction || 1);
        const productSubstance = node.reaction.products[link.fromProductIndex];
        if (!productSubstance) continue;
        const scale = molesNeeded / productSubstance.coefficient;

        // Use the largest scale (must produce enough for ALL downstream consumers)
        if (scale > maxScale) maxScale = scale;
      }

      if (maxScale === 0) continue;

      // Calculate using the first outgoing link's product as reference,
      // scaled to the max needed
      const refLink = outgoing[0];
      const productIndex =
        node.reaction.reactants.length + refLink.fromProductIndex;
      const molesNeeded = maxScale * node.reaction.products[refLink.fromProductIndex].coefficient;

      const results = calculateStoichiometry(node.reaction, {
        substanceIndex: productIndex,
        amount: molesNeeded,
        unit: "mol",
      });
      perReaction.set(nodeId, results);
      changed = true;
    }
  }

  const totals = aggregateSubstances(system, perReaction);
  const balanceCheck = checkBalance(perReaction);

  // Build debug info for UI display
  const debugLines: string[] = [];
  for (const [nodeId, results] of perReaction) {
    const node = nodeMap.get(nodeId);
    debugLines.push(`--- ${node?.label?.slice(0, 60) ?? nodeId} ---`);
    for (const r of results) {
      debugLines.push(`  ${r.substance.role}: ${normalizeFormula(r.substance.formula)} = ${r.moles.toPrecision(4)} mol`);
    }
  }
  debugLines.push("");
  debugLines.push("--- Links ---");
  for (const l of system.links) {
    const from = nodeMap.get(l.fromReactionId);
    const to = nodeMap.get(l.toReactionId);
    const prod = from?.reaction.products[l.fromProductIndex];
    const react = to?.reaction.reactants[l.toReactantIndex];
    debugLines.push(`  ${normalizeFormula(prod?.formula ?? '?')} [product idx ${l.fromProductIndex}] —(${(l.fraction*100).toFixed(0)}%)→ ${normalizeFormula(react?.formula ?? '?')} [reactant idx ${l.toReactantIndex}]`);
  }
  debugLines.push("");
  debugLines.push("--- Aggregation ---");
  for (const t of totals) {
    debugLines.push(`  ${normalizeFormula(t.formula)}: produced=${t.produced.toPrecision(4)}, consumed=${t.consumed.toPrecision(4)}, net=${t.totalMoles.toPrecision(4)}, role=${t.role}`);
  }

  return {
    perReaction,
    totals,
    balanceCheck,
    debugInfo: debugLines.join("\n"),
    propertyWarnings: propertyWarnings.length > 0 ? propertyWarnings : undefined,
  };
}

/**
 * Get forward topological order starting from ALL already-calculated nodes.
 * This ensures sibling branches are discovered after backward propagation.
 */
function topologicalForwardAll(
  system: ReactionSystem,
  calculated: Map<string, CalculationResult[]>,
  outgoingLinks: Map<string, SeriesLink[]>
): string[] {
  const visited = new Set<string>();
  const order: string[] = [];

  function dfs(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    for (const link of outgoingLinks.get(id) ?? []) {
      dfs(link.toReactionId);
    }
    order.push(id);
  }

  // Start DFS from every already-calculated node
  for (const nodeId of calculated.keys()) {
    dfs(nodeId);
  }

  return order.reverse(); // topological order
}

/**
 * Get backward topological order starting from ALL already-calculated nodes.
 */
function topologicalBackwardAll(
  system: ReactionSystem,
  calculated: Map<string, CalculationResult[]>,
  incomingLinks: Map<string, SeriesLink[]>
): string[] {
  const visited = new Set<string>();
  const order: string[] = [];

  function dfs(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    for (const link of incomingLinks.get(id) ?? []) {
      dfs(link.fromReactionId);
    }
    order.push(id);
  }

  // Start DFS from every already-calculated node
  for (const nodeId of calculated.keys()) {
    dfs(nodeId);
  }

  return order.reverse();
}

/**
 * Aggregate all substances across reactions into net totals.
 * Tracks excess/deficit for linked substances.
 */
function aggregateSubstances(
  system: ReactionSystem,
  perReaction: Map<string, CalculationResult[]>
): SubstanceTotals[] {
  const nodeMap = new Map(system.nodes.map((n) => [n.id, n]));

  // Track linked formulas
  const linkedFormulas = new Set<string>();
  for (const link of system.links) {
    const sourceNode = nodeMap.get(link.fromReactionId);
    if (sourceNode) {
      const product = sourceNode.reaction.products[link.fromProductIndex];
      if (product) linkedFormulas.add(normalizeFormula(product.formula));
    }
    const targetNode = nodeMap.get(link.toReactionId);
    if (targetNode) {
      const reactant = targetNode.reaction.reactants[link.toReactantIndex];
      if (reactant) linkedFormulas.add(normalizeFormula(reactant.formula));
    }
  }

  // Accumulate produced and consumed moles per formula
  const produced = new Map<string, number>();
  const consumed = new Map<string, number>();
  const nameMap = new Map<string, string>();
  const molarMassMap = new Map<string, number>();
  const liquidInfo = new Map<string, { isLiquid: boolean; density: number | null }>();
  const densityGasMap = new Map<string, number | null>();

  for (const [, results] of perReaction) {
    for (const r of results) {
      const key = normalizeFormula(r.substance.formula);
      nameMap.set(key, r.substance.name);
      molarMassMap.set(key, r.substance.molarMass);
      if (!liquidInfo.has(key)) {
        liquidInfo.set(key, {
          isLiquid: r.substance.state === "liquid" && r.substance.density !== null,
          density: r.substance.density,
        });
      }
      if (!densityGasMap.has(key)) {
        densityGasMap.set(key, r.substance.densityGas ?? null);
      }

      if (r.substance.role === "reactant") {
        consumed.set(key, (consumed.get(key) ?? 0) + r.moles);
      } else {
        produced.set(key, (produced.get(key) ?? 0) + r.moles);
      }
    }
  }

  const allFormulas = new Set([...consumed.keys(), ...produced.keys()]);
  const totals: SubstanceTotals[] = [];

  for (const formula of allFormulas) {
    const prod = produced.get(formula) ?? 0;
    const cons = consumed.get(formula) ?? 0;
    const net = prod - cons;
    const molarMass = molarMassMap.get(formula) ?? 1;

    let role: SubstanceTotals["role"];
    let note: string | undefined;

    if (linkedFormulas.has(formula)) {
      if (Math.abs(net) < 1e-10) {
        role = "intermediate";
        note = "Fully consumed in downstream reaction";
      } else if (net > 0) {
        role = "excess";
        note = `Excess: ${net.toPrecision(4)} mol produced beyond what downstream consumes`;
      } else {
        role = "deficit";
        note = `Deficit: ${Math.abs(net).toPrecision(4)} mol more needed than upstream produces`;
      }
    } else if (net > 0) {
      role = "net-product";
    } else if (net < 0) {
      role = "net-reactant";
    } else {
      role = "intermediate";
    }

    const netMoles = Math.abs(net);
    const netGrams = netMoles * molarMass;
    const liq = liquidInfo.get(formula);
    const isLiquid = liq?.isLiquid ?? false;
    const density = liq?.density ?? null;

    totals.push({
      formula,
      name: nameMap.get(formula) ?? formula,
      role,
      totalMoles: netMoles,
      totalGrams: netGrams,
      totalKilograms: netGrams / 1000,
      totalPounds: netGrams / 453.592,
      totalTons: netGrams / 907185,
      totalTonnes: netGrams / 1000000,
      totalLiters: isLiquid && density ? netGrams / density / 1000 : null,
      totalGallons: isLiquid && density ? netGrams / density / 3785.41 : null,
      isLiquid,
      produced: prod,
      consumed: cons,
      molarMass,
      densityGas: densityGasMap.get(formula) ?? null,
      note,
    });
  }

  const roleOrder: Record<string, number> = {
    "net-reactant": 0,
    deficit: 1,
    intermediate: 2,
    excess: 3,
    "net-product": 4,
  };
  totals.sort((a, b) => (roleOrder[a.role] ?? 5) - (roleOrder[b.role] ?? 5));

  return totals;
}

/**
 * Check atom-level and mass-level balance across all reactions.
 * For a correctly balanced system, atoms in = atoms out and mass in = mass out.
 */
function checkBalance(
  perReaction: Map<string, CalculationResult[]>
): BalanceCheck {
  const TOLERANCE = 0.01; // 1% relative tolerance

  // Atom balance: sum atoms on each side across all reactions
  const atomsConsumed = new Map<string, number>();
  const atomsProduced = new Map<string, number>();
  let totalMassIn = 0;  // grams
  let totalMassOut = 0;

  for (const [, results] of perReaction) {
    for (const r of results) {
      const atoms = parseAtoms(r.substance.formula);
      const massGrams = r.moles * r.substance.molarMass;

      if (r.substance.role === "reactant") {
        totalMassIn += massGrams;
        for (const [atom, count] of atoms) {
          atomsConsumed.set(atom, (atomsConsumed.get(atom) ?? 0) + count * r.moles);
        }
      } else {
        totalMassOut += massGrams;
        for (const [atom, count] of atoms) {
          atomsProduced.set(atom, (atomsProduced.get(atom) ?? 0) + count * r.moles);
        }
      }
    }
  }

  // Build atom balance report
  const allAtoms = new Set([...atomsConsumed.keys(), ...atomsProduced.keys()]);
  const atomBalances: AtomBalance[] = [];
  let allAtomsBalanced = true;

  for (const atom of allAtoms) {
    const cons = atomsConsumed.get(atom) ?? 0;
    const prod = atomsProduced.get(atom) ?? 0;
    const delta = prod - cons;
    const maxVal = Math.max(prod, cons);
    const balanced = maxVal === 0 || Math.abs(delta) / maxVal < TOLERANCE;
    if (!balanced) allAtomsBalanced = false;

    atomBalances.push({ atom, produced: prod, consumed: cons, delta, balanced });
  }

  atomBalances.sort((a, b) => a.atom.localeCompare(b.atom));

  // Mass balance
  const massDelta = totalMassOut - totalMassIn;
  const massDeltaPercent = totalMassIn > 0 ? (massDelta / totalMassIn) * 100 : 0;
  const massBalanced = totalMassIn === 0 || Math.abs(massDeltaPercent) < TOLERANCE * 100;

  const mass: MassBalance = {
    totalMassIn,
    totalMassOut,
    delta: massDelta,
    deltaPercent: massDeltaPercent,
    balanced: massBalanced,
  };

  return {
    atoms: atomBalances,
    mass,
    allBalanced: allAtomsBalanced && massBalanced,
  };
}

/**
 * Calculate thermodynamics for the full system.
 */
export function calculateSystemThermodynamics(
  system: ReactionSystem,
  perReaction: Map<string, CalculationResult[]>
): SystemThermodynamics {
  const thermoMap = new Map<string, ThermodynamicsResult>();
  let totalDeltaH = 0;

  for (const node of system.nodes) {
    const results = perReaction.get(node.id);
    if (!results) continue;

    const thermo = calculateThermodynamics(node.reaction, results);
    thermoMap.set(node.id, thermo);
    totalDeltaH += thermo.deltaH;
  }

  return {
    perReaction: thermoMap,
    totalDeltaH,
    isExothermic: totalDeltaH < 0,
  };
}
