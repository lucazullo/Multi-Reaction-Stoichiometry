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

  // 2. Forward propagation (BFS from start, following outgoing links)
  const forwardQueue = [startReactionId];
  const forwardVisited = new Set([startReactionId]);

  while (forwardQueue.length > 0) {
    const currentId = forwardQueue.shift()!;
    const currentResults = perReaction.get(currentId)!;
    const currentNode = nodeMap.get(currentId)!;

    for (const link of outgoingLinks.get(currentId) ?? []) {
      if (forwardVisited.has(link.toReactionId)) continue;

      const targetNode = nodeMap.get(link.toReactionId);
      if (!targetNode) continue;

      // Get product moles from source
      const productResultIndex =
        currentNode.reaction.reactants.length + link.fromProductIndex;
      const productResult = currentResults[productResultIndex];
      if (!productResult) continue;

      const molesAvailable = productResult.moles * link.fraction;

      // Check if target already has partial results from other links
      // For now, use the linked substance as the determining input
      const targetInput: CalculationInput = {
        substanceIndex: link.toReactantIndex,
        amount: molesAvailable,
        unit: "mol",
      };

      const results = calculateStoichiometry(targetNode.reaction, targetInput);
      perReaction.set(link.toReactionId, results);
      forwardVisited.add(link.toReactionId);
      forwardQueue.push(link.toReactionId);
    }
  }

  // 3. Backward propagation (BFS from start, following incoming links in reverse)
  const backwardQueue = [startReactionId];
  const backwardVisited = new Set([startReactionId]);

  while (backwardQueue.length > 0) {
    const currentId = backwardQueue.shift()!;
    const currentResults = perReaction.get(currentId)!;
    const currentNode = nodeMap.get(currentId)!;

    for (const link of incomingLinks.get(currentId) ?? []) {
      if (backwardVisited.has(link.fromReactionId)) continue;

      const sourceNode = nodeMap.get(link.fromReactionId);
      if (!sourceNode) continue;

      // How much of the linked reactant does the current reaction need?
      const reactantResult = currentResults[link.toReactantIndex];
      if (!reactantResult) continue;

      // The source must produce enough: molesNeeded = reactantMoles / fraction
      const molesNeeded = reactantResult.moles / (link.fraction || 1);

      // Calculate source reaction based on required product output
      const productIndex =
        sourceNode.reaction.reactants.length + link.fromProductIndex;
      const sourceInput: CalculationInput = {
        substanceIndex: productIndex,
        amount: molesNeeded,
        unit: "mol",
      };

      const results = calculateStoichiometry(sourceNode.reaction, sourceInput);
      perReaction.set(link.fromReactionId, results);
      backwardVisited.add(link.fromReactionId);
      backwardQueue.push(link.fromReactionId);
    }
  }

  const totals = aggregateSubstances(system, perReaction);
  return { perReaction, totals };
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

  // Track link flows: how much was available vs consumed for each linked substance
  const linkFlows: Array<{
    formula: string;
    available: number;
    consumed: number;
    fraction: number;
    fromLabel: string;
    toLabel: string;
  }> = [];

  for (const link of system.links) {
    const sourceNode = nodeMap.get(link.fromReactionId);
    const targetNode = nodeMap.get(link.toReactionId);
    const sourceResults = perReaction.get(link.fromReactionId);
    const targetResults = perReaction.get(link.toReactionId);
    if (!sourceNode || !targetNode || !sourceResults || !targetResults) continue;

    const productIdx = sourceNode.reaction.reactants.length + link.fromProductIndex;
    const productResult = sourceResults[productIdx];
    const reactantResult = targetResults[link.toReactantIndex];
    if (!productResult || !reactantResult) continue;

    const product = sourceNode.reaction.products[link.fromProductIndex];
    if (product) {
      linkFlows.push({
        formula: normalizeFormula(product.formula),
        available: productResult.moles * link.fraction,
        consumed: reactantResult.moles,
        fraction: link.fraction,
        fromLabel: sourceNode.label,
        toLabel: targetNode.label,
      });
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

  // Build linked formulas set
  const linkedFormulas = new Set(linkFlows.map((f) => f.formula));

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
      // This substance flows through a link
      const flow = linkFlows.find((f) => f.formula === formula);

      if (Math.abs(net) < 1e-10) {
        role = "intermediate";
        note = "Fully consumed in downstream reaction";
      } else if (net > 0) {
        role = "excess";
        note = flow
          ? `Excess: ${net.toPrecision(4)} mol produced beyond what downstream reaction consumes`
          : undefined;
      } else {
        role = "deficit";
        note = flow
          ? `Deficit: ${Math.abs(net).toPrecision(4)} mol more needed than upstream reaction produces`
          : undefined;
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
      totalTons: netGrams / 907185,      // short ton = 907,185 g
      totalTonnes: netGrams / 1000000,   // metric tonne = 1,000,000 g
      totalLiters: isLiquid && density ? netGrams / density / 1000 : null,
      totalGallons: isLiquid && density ? netGrams / density / 3785.41 : null,
      isLiquid,
      produced: prod,
      consumed: cons,
      note,
    });
  }

  // Sort: net-reactants, deficit, intermediate, excess, net-products
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

