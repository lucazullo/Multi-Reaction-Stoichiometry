"use client";

import { useState, useEffect } from "react";
import type { ReactionNode, SeriesLink } from "@/lib/types";
import { normalizeFormula } from "@/lib/utils";

interface LinkEditorProps {
  nodes: ReactionNode[];
  onAdd: (link: Omit<SeriesLink, "id">) => void;
  onClose: () => void;
}

export default function LinkEditor({ nodes, onAdd, onClose }: LinkEditorProps) {
  const [fromId, setFromId] = useState(nodes[0]?.id ?? "");
  const [fromProductIdx, setFromProductIdx] = useState(0);
  const [toId, setToId] = useState("");
  const [toReactantIdx, setToReactantIdx] = useState(0);
  const [fraction, setFraction] = useState("1.0");

  const fromNode = nodes.find((n) => n.id === fromId);
  const toNode = nodes.find((n) => n.id === toId);
  const products = fromNode?.reaction.products ?? [];
  const reactants = toNode?.reaction.reactants ?? [];

  // Initialize toId to first node that isn't fromId
  useEffect(() => {
    const other = nodes.find((n) => n.id !== fromId);
    if (other && !toId) setToId(other.id);
  }, [fromId, nodes, toId]);

  // When product changes, try to auto-match a reactant with the same formula
  useEffect(() => {
    if (products.length === 0 || reactants.length === 0) return;
    const selectedProduct = products[fromProductIdx];
    if (!selectedProduct) return;
    const prodFormula = normalizeFormula(selectedProduct.formula);
    const matchIdx = reactants.findIndex(
      (r) => normalizeFormula(r.formula) === prodFormula
    );
    if (matchIdx >= 0) {
      setToReactantIdx(matchIdx);
    }
  }, [fromProductIdx, products, reactants]);

  // When "To Reaction" changes, try to auto-match reactant with selected product
  useEffect(() => {
    if (products.length === 0 || reactants.length === 0) return;
    const selectedProduct = products[fromProductIdx];
    if (!selectedProduct) return;
    const prodFormula = normalizeFormula(selectedProduct.formula);
    const matchIdx = reactants.findIndex(
      (r) => normalizeFormula(r.formula) === prodFormula
    );
    if (matchIdx >= 0) {
      setToReactantIdx(matchIdx);
    } else {
      setToReactantIdx(0);
    }
  }, [toId]); // eslint-disable-line react-hooks/exhaustive-deps

  const availableToNodes = nodes.filter((n) => n.id !== fromId);
  const canSubmit =
    fromId && toId && fromId !== toId && products.length > 0 && reactants.length > 0;

  const handleFromChange = (id: string) => {
    setFromId(id);
    setFromProductIdx(0);
    // Reset toId if same as new fromId
    if (toId === id) {
      const other = nodes.find((n) => n.id !== id);
      setToId(other?.id ?? "");
    }
  };

  const handleToChange = (id: string) => {
    setToId(id);
    setToReactantIdx(0);
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    const frac = parseFloat(fraction);

    // Validate: show what we're actually linking
    const product = products[fromProductIdx];
    const reactant = reactants[toReactantIdx];
    if (!product || !reactant) return;

    onAdd({
      fromReactionId: fromId,
      fromProductIndex: fromProductIdx,
      toReactionId: toId,
      toReactantIndex: toReactantIdx,
      fraction: isNaN(frac) || frac <= 0 || frac > 1 ? 1 : frac,
    });
    onClose();
  };

  // Show a warning if product and reactant formulas don't match
  const selectedProduct = products[fromProductIdx];
  const selectedReactant = reactants[toReactantIdx];
  const formulaMatch =
    selectedProduct &&
    selectedReactant &&
    normalizeFormula(selectedProduct.formula) ===
      normalizeFormula(selectedReactant.formula);

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-800">
          Add Series Link
        </h3>
        <p className="text-xs text-gray-500">
          Connect a product from one reaction to a reactant of another.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              From Reaction
            </label>
            <select
              value={fromId}
              onChange={(e) => handleFromChange(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {nodes.map((n, i) => (
                <option key={n.id} value={n.id}>
                  Reaction {i + 1}: {n.label.slice(0, 40)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Product
            </label>
            <select
              value={fromProductIdx}
              onChange={(e) => setFromProductIdx(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {products.map((p, i) => (
                <option key={i} value={i}>
                  {p.formula} ({p.name})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-center">
            <svg
              className="h-5 w-5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3"
              />
            </svg>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              To Reaction
            </label>
            <select
              value={toId}
              onChange={(e) => handleToChange(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {availableToNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  Reaction {nodes.indexOf(n) + 1}: {n.label.slice(0, 40)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Reactant
            </label>
            <select
              value={toReactantIdx}
              onChange={(e) => setToReactantIdx(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {reactants.map((r, i) => (
                <option key={i} value={i}>
                  {r.formula} ({r.name})
                </option>
              ))}
            </select>
          </div>

          {/* Formula match indicator */}
          {selectedProduct && selectedReactant && (
            <div
              className={`rounded-lg px-3 py-2 text-xs ${
                formulaMatch
                  ? "bg-green-50 border border-green-200 text-green-700"
                  : "bg-amber-50 border border-amber-200 text-amber-700"
              }`}
            >
              {formulaMatch ? (
                <>
                  Linking: <span className="font-semibold">{selectedProduct.formula}</span> ({selectedProduct.name}) →{" "}
                  <span className="font-semibold">{selectedReactant.formula}</span> ({selectedReactant.name})
                </>
              ) : (
                <>
                  Warning: Product <span className="font-semibold">{selectedProduct.formula}</span> does not match reactant{" "}
                  <span className="font-semibold">{selectedReactant.formula}</span>. Are you sure?
                </>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Fraction (0–1)
            </label>
            <input
              type="number"
              value={fraction}
              onChange={(e) => setFraction(e.target.value)}
              min="0"
              max="1"
              step="0.01"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            Add Link
          </button>
        </div>
      </div>
    </div>
  );
}
