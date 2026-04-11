import type { ReactionSystem } from "./types";
import { normalizeFormula } from "./utils";

export interface ValidationWarning {
  type: "error" | "warning" | "info";
  message: string;
  reactionId?: string;
  linkId?: string;
}

/**
 * Validate the reaction system topology and return warnings.
 */
export function validateSystem(system: ReactionSystem): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const { nodes, links } = system;

  if (nodes.length === 0) return warnings;

  // 1. Check for unlinked products that match reactants in other reactions
  for (const node of nodes) {
    for (let pi = 0; pi < node.reaction.products.length; pi++) {
      const product = node.reaction.products[pi];
      const prodFormula = normalizeFormula(product.formula);

      // Check if any other reaction has this as a reactant
      const potentialConsumers = nodes.filter((other) =>
        other.id !== node.id &&
        other.reaction.reactants.some(
          (r) => normalizeFormula(r.formula) === prodFormula
        )
      );

      if (potentialConsumers.length === 0) continue;

      // Check if there's a link for this product
      const hasLink = links.some(
        (l) =>
          l.fromReactionId === node.id && l.fromProductIndex === pi
      );

      if (!hasLink) {
        const consumerNames = potentialConsumers
          .map((c) => `Rxn ${nodes.indexOf(c) + 1}`)
          .join(", ");
        warnings.push({
          type: "warning",
          message: `${product.formula} (${product.name}) from Rxn ${nodes.indexOf(node) + 1} is not linked but is used as a reactant in ${consumerNames}. Did you forget to add a link?`,
          reactionId: node.id,
        });
      }
    }
  }

  // 2. Check for links where product and reactant formulas don't match
  for (const link of links) {
    const fromNode = nodes.find((n) => n.id === link.fromReactionId);
    const toNode = nodes.find((n) => n.id === link.toReactionId);
    if (!fromNode || !toNode) {
      warnings.push({
        type: "error",
        message: `Link references a reaction that doesn't exist.`,
        linkId: link.id,
      });
      continue;
    }

    const product = fromNode.reaction.products[link.fromProductIndex];
    const reactant = toNode.reaction.reactants[link.toReactantIndex];

    if (!product) {
      warnings.push({
        type: "error",
        message: `Link from Rxn ${nodes.indexOf(fromNode) + 1} references product index ${link.fromProductIndex} which doesn't exist.`,
        linkId: link.id,
      });
      continue;
    }
    if (!reactant) {
      warnings.push({
        type: "error",
        message: `Link to Rxn ${nodes.indexOf(toNode) + 1} references reactant index ${link.toReactantIndex} which doesn't exist.`,
        linkId: link.id,
      });
      continue;
    }

    if (normalizeFormula(product.formula) !== normalizeFormula(reactant.formula)) {
      warnings.push({
        type: "error",
        message: `Link mismatch: Rxn ${nodes.indexOf(fromNode) + 1} product ${product.formula} ≠ Rxn ${nodes.indexOf(toNode) + 1} reactant ${reactant.formula}.`,
        linkId: link.id,
      });
    }
  }

  // 3. Check for fractions that exceed 100% total for the same product
  const fractionSums = new Map<string, number>(); // "nodeId:productIdx" -> total fraction
  for (const link of links) {
    const key = `${link.fromReactionId}:${link.fromProductIndex}`;
    fractionSums.set(key, (fractionSums.get(key) ?? 0) + link.fraction);
  }
  for (const [key, total] of fractionSums) {
    if (total > 1.001) {
      const [nodeId, pidxStr] = key.split(":");
      const node = nodes.find((n) => n.id === nodeId);
      const product = node?.reaction.products[Number(pidxStr)];
      warnings.push({
        type: "error",
        message: `Total fraction for ${product?.formula ?? "unknown"} from Rxn ${nodes.indexOf(node!) + 1} exceeds 100% (${(total * 100).toFixed(0)}%).`,
        reactionId: nodeId,
      });
    }
  }

  // 4. Check for cycles (would cause infinite propagation)
  const visited = new Set<string>();
  const inStack = new Set<string>();
  let hasCycle = false;

  function dfs(id: string) {
    if (inStack.has(id)) { hasCycle = true; return; }
    if (visited.has(id)) return;
    visited.add(id);
    inStack.add(id);
    for (const link of links) {
      if (link.fromReactionId === id) dfs(link.toReactionId);
    }
    inStack.delete(id);
  }

  for (const node of nodes) {
    dfs(node.id);
  }
  if (hasCycle) {
    warnings.push({
      type: "error",
      message: "Circular dependency detected in reaction links. The system must be acyclic.",
    });
  }

  // 5. Info: disconnected reactions (no links at all)
  if (nodes.length >= 2 && links.length === 0) {
    warnings.push({
      type: "info",
      message: "No links between reactions. All reactions will be calculated independently (parallel).",
    });
  } else if (nodes.length >= 2) {
    const connectedNodes = new Set<string>();
    for (const link of links) {
      connectedNodes.add(link.fromReactionId);
      connectedNodes.add(link.toReactionId);
    }
    const disconnected = nodes.filter((n) => !connectedNodes.has(n.id));
    for (const node of disconnected) {
      warnings.push({
        type: "info",
        message: `Rxn ${nodes.indexOf(node) + 1} (${node.label.slice(0, 30)}) has no links — it will run independently.`,
        reactionId: node.id,
      });
    }
  }

  return warnings;
}
