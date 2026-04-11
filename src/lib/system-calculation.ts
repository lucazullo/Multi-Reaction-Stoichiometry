import type {
  CalculationInput,
  CalculationResult,
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
import { normalizeFormula } from "./utils";

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

  // 2. Forward propagation
  // Use topological order to ensure all incoming links are resolved before calculating
  const forwardOrder = topologicalForward(system, startReactionId, outgoingLinks);

  for (const nodeId of forwardOrder) {
    if (nodeId === startReactionId) continue; // already calculated
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

      const molesAvailable = productResult.moles * link.fraction;
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
  }

  // 3. Backward propagation
  const backwardOrder = topologicalBackward(system, startReactionId, incomingLinks);

  for (const nodeId of backwardOrder) {
    if (nodeId === startReactionId) continue;
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
  }

  // Debug: log per-reaction results
  console.group("System Calculation Debug");
  for (const [nodeId, results] of perReaction) {
    const node = nodeMap.get(nodeId);
    console.group(`Reaction: ${node?.label?.slice(0, 50)}`);
    for (const r of results) {
      console.log(`  ${r.substance.role} ${normalizeFormula(r.substance.formula)} (${r.substance.name}): ${r.moles.toPrecision(4)} mol`);
    }
    console.groupEnd();
  }
  console.log("Links:", system.links.map(l => {
    const from = nodeMap.get(l.fromReactionId);
    const to = nodeMap.get(l.toReactionId);
    const prod = from?.reaction.products[l.fromProductIndex];
    const react = to?.reaction.reactants[l.toReactantIndex];
    return `${normalizeFormula(prod?.formula ?? '?')} (idx ${l.fromProductIndex}, ${l.fraction*100}%) → ${normalizeFormula(react?.formula ?? '?')} (idx ${l.toReactantIndex})`;
  }));
  console.groupEnd();

  const totals = aggregateSubstances(system, perReaction);
  return { perReaction, totals };
}

/**
 * Get forward topological order starting from startId.
 */
function topologicalForward(
  system: ReactionSystem,
  startId: string,
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

  dfs(startId);
  return order.reverse(); // topological order
}

/**
 * Get backward topological order starting from startId.
 */
function topologicalBackward(
  system: ReactionSystem,
  startId: string,
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

  dfs(startId);
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
