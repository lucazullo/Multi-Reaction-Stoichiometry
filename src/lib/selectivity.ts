import type {
  CompetingReactionSet,
  ReactionSystem,
  SelectivityResult,
  CalculationResult,
} from "./types";
import { calculateStoichiometry, fromMoles } from "./conversion";
import { normalizeFormula } from "./utils";

/**
 * Calculate selectivity, yield, and atom economy for a set of competing reactions.
 *
 * Given a shared reactant that splits between a primary (desired) reaction
 * and competing (undesired) reactions, this function:
 * 1. Allocates the shared reactant moles per the allocation fractions
 * 2. Runs stoichiometry for each reaction independently
 * 3. Computes selectivity = desired product moles / (desired + undesired product moles)
 * 4. Computes yield = desired product moles / shared reactant moles fed
 * 5. Computes atom economy = (MW desired × coeff) / sum(MW all products × coeff)
 */
export function calculateSelectivity(
  system: ReactionSystem,
  competingSet: CompetingReactionSet,
  sharedReactantMoles: number
): SelectivityResult {
  const nodeMap = new Map(system.nodes.map((n) => [n.id, n]));

  const primaryNode = nodeMap.get(competingSet.primaryReactionId);
  if (!primaryNode) throw new Error("Primary reaction not found");

  // Find the shared reactant index in the primary reaction
  const primaryReactantIdx = primaryNode.reaction.reactants.findIndex(
    (r) => normalizeFormula(r.formula) === normalizeFormula(competingSet.sharedReactantFormula)
  );
  if (primaryReactantIdx < 0) throw new Error("Shared reactant not found in primary reaction");

  // Calculate primary reaction
  const primaryAllocation = competingSet.allocations[competingSet.primaryReactionId] ?? 0;
  const primaryMoles = sharedReactantMoles * primaryAllocation;
  const primaryResults = calculateStoichiometry(primaryNode.reaction, {
    substanceIndex: primaryReactantIdx,
    amount: primaryMoles,
    unit: "mol",
  });

  // Get desired product (first product of primary reaction)
  const primaryProductResults = primaryResults.slice(primaryNode.reaction.reactants.length);
  const desiredProduct = primaryProductResults[0];
  const desiredMoles = desiredProduct?.moles ?? 0;

  // Calculate competing reactions
  const coProducts: SelectivityResult["coProducts"] = [];
  let totalUndesiredMoles = 0;

  for (const competingId of competingSet.competingReactionIds) {
    const competingNode = nodeMap.get(competingId);
    if (!competingNode) continue;

    const competingReactantIdx = competingNode.reaction.reactants.findIndex(
      (r) => normalizeFormula(r.formula) === normalizeFormula(competingSet.sharedReactantFormula)
    );
    if (competingReactantIdx < 0) continue;

    const competingAllocation = competingSet.allocations[competingId] ?? 0;
    const competingMoles = sharedReactantMoles * competingAllocation;

    const competingResults = calculateStoichiometry(competingNode.reaction, {
      substanceIndex: competingReactantIdx,
      amount: competingMoles,
      unit: "mol",
    });

    const competingProductResults = competingResults.slice(competingNode.reaction.reactants.length);

    for (const product of competingProductResults) {
      coProducts.push({
        formula: product.substance.formula,
        name: product.substance.name,
        moles: product.moles,
        fromReactionId: competingId,
        reactionLabel: competingNode.displayName ?? competingNode.label,
      });
      totalUndesiredMoles += product.moles;
    }
  }

  // Selectivity: desired / (desired + undesired)
  const selectivity = desiredMoles + totalUndesiredMoles > 0
    ? desiredMoles / (desiredMoles + totalUndesiredMoles)
    : 0;

  // Yield: desired product moles / shared reactant moles fed
  const yieldValue = sharedReactantMoles > 0
    ? desiredMoles / sharedReactantMoles
    : 0;

  // Atom economy: (MW_desired × coeff_desired) / sum(MW_all_products × coeff)
  let totalProductMW = 0;
  const desiredSubstance = primaryNode.reaction.products[0];
  const desiredMW = desiredSubstance ? desiredSubstance.molarMass * desiredSubstance.coefficient : 0;

  // Sum MW of all products from primary reaction
  for (const p of primaryNode.reaction.products) {
    totalProductMW += p.molarMass * p.coefficient;
  }
  // Sum MW of all products from competing reactions
  for (const competingId of competingSet.competingReactionIds) {
    const competingNode = nodeMap.get(competingId);
    if (!competingNode) continue;
    for (const p of competingNode.reaction.products) {
      totalProductMW += p.molarMass * p.coefficient;
    }
  }

  const atomEconomy = totalProductMW > 0 ? desiredMW / totalProductMW : 0;

  return {
    competingSetId: competingSet.id,
    desiredProduct: {
      formula: desiredProduct?.substance.formula ?? "",
      name: desiredProduct?.substance.name ?? "",
      moles: desiredMoles,
    },
    coProducts,
    selectivity,
    yield: yieldValue,
    atomEconomy,
  };
}
