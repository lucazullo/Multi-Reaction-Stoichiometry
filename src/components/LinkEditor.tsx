"use client";

import { useState } from "react";
import type { ReactionNode, SeriesLink } from "@/lib/types";

interface LinkEditorProps {
  nodes: ReactionNode[];
  onAdd: (link: Omit<SeriesLink, "id">) => void;
  onClose: () => void;
}

export default function LinkEditor({ nodes, onAdd, onClose }: LinkEditorProps) {
  const [fromId, setFromId] = useState(nodes[0]?.id ?? "");
  const [fromProductIdx, setFromProductIdx] = useState(0);
  const [toId, setToId] = useState(nodes[1]?.id ?? nodes[0]?.id ?? "");
  const [toReactantIdx, setToReactantIdx] = useState(0);
  const [fraction, setFraction] = useState("1.0");

  const fromNode = nodes.find((n) => n.id === fromId);
  const toNode = nodes.find((n) => n.id === toId);
  const products = fromNode?.reaction.products ?? [];
  const reactants = toNode?.reaction.reactants ?? [];

  const canSubmit = fromId && toId && fromId !== toId && products.length > 0 && reactants.length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const frac = parseFloat(fraction);
    onAdd({
      fromReactionId: fromId,
      fromProductIndex: fromProductIdx,
      toReactionId: toId,
      toReactantIndex: toReactantIdx,
      fraction: isNaN(frac) || frac <= 0 || frac > 1 ? 1 : frac,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-800">Add Series Link</h3>
        <p className="text-xs text-gray-500">
          Connect a product from one reaction to a reactant of another.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">From Reaction</label>
            <select
              value={fromId}
              onChange={(e) => { setFromId(e.target.value); setFromProductIdx(0); }}
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
            <label className="block text-xs font-medium text-gray-600 mb-1">Product</label>
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
            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
            </svg>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">To Reaction</label>
            <select
              value={toId}
              onChange={(e) => { setToId(e.target.value); setToReactantIdx(0); }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {nodes.filter((n) => n.id !== fromId).map((n, i) => (
                <option key={n.id} value={n.id}>
                  Reaction {nodes.indexOf(n) + 1}: {n.label.slice(0, 40)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Reactant</label>
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
