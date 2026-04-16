"use client";

import { useState } from "react";
import type { CompetingReactionSet, ReactionNode } from "@/lib/types";
import { normalizeFormula } from "@/lib/utils";

interface CompetingReactionsEditorProps {
  nodes: ReactionNode[];
  competingSets: CompetingReactionSet[];
  onChange: (sets: CompetingReactionSet[]) => void;
}

let nextSetId = 0;

export default function CompetingReactionsEditor({ nodes, competingSets, onChange }: CompetingReactionsEditorProps) {
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [primaryId, setPrimaryId] = useState("");
  const [competingIds, setCompetingIds] = useState<string[]>([]);
  const [sharedFormula, setSharedFormula] = useState("");

  // Get all unique reactant formulas across all reactions
  const allReactantFormulas = new Set<string>();
  for (const node of nodes) {
    for (const r of node.reaction.reactants) {
      allReactantFormulas.add(normalizeFormula(r.formula));
    }
  }

  // Find reactions that share a given reactant
  const reactionsWithFormula = (formula: string) =>
    nodes.filter((n) =>
      n.reaction.reactants.some((r) => normalizeFormula(r.formula) === normalizeFormula(formula))
    );

  const handleAdd = () => {
    if (!primaryId || competingIds.length === 0 || !sharedFormula) return;

    const allIds = [primaryId, ...competingIds];
    const evenSplit = 1 / allIds.length;
    const allocations: Record<string, number> = {};
    for (const id of allIds) {
      allocations[id] = evenSplit;
    }

    const newSet: CompetingReactionSet = {
      id: `cset-${nextSetId++}`,
      label: label || "Competing reactions",
      primaryReactionId: primaryId,
      competingReactionIds: competingIds,
      sharedReactantFormula: sharedFormula,
      allocations,
    };

    onChange([...competingSets, newSet]);
    setShowForm(false);
    setLabel("");
    setPrimaryId("");
    setCompetingIds([]);
    setSharedFormula("");
  };

  const handleDelete = (id: string) => {
    onChange(competingSets.filter((s) => s.id !== id));
  };

  const handleAllocationChange = (setId: string, reactionId: string, value: number) => {
    onChange(competingSets.map((s) => {
      if (s.id !== setId) return s;
      return { ...s, allocations: { ...s.allocations, [reactionId]: Math.max(0, Math.min(1, value)) } };
    }));
  };

  const getNodeLabel = (id: string) => {
    const node = nodes.find((n) => n.id === id);
    return node?.displayName ?? node?.label ?? id;
  };

  return (
    <div className="space-y-3">
      {/* Existing competing sets */}
      {competingSets.map((set) => {
        const allIds = [set.primaryReactionId, ...set.competingReactionIds];
        const totalAllocation = Object.values(set.allocations).reduce((s, v) => s + v, 0);

        return (
          <div key={set.id} className="rounded-lg border border-purple-200 bg-purple-50 p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-purple-800">{set.label}</h4>
              <button
                onClick={() => handleDelete(set.id)}
                className="text-xs text-gray-400 hover:text-red-500"
              >
                Remove
              </button>
            </div>
            <p className="text-[10px] text-purple-600 mb-2">
              Shared reactant: <span className="font-mono font-medium">{set.sharedReactantFormula}</span>
            </p>

            <div className="space-y-1.5">
              {allIds.map((id) => {
                const isPrimary = id === set.primaryReactionId;
                return (
                  <div key={id} className="flex items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      isPrimary ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                    }`}>
                      {isPrimary ? "Desired" : "Side"}
                    </span>
                    <span className="flex-1 text-xs text-gray-700 truncate">{getNodeLabel(id)}</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={Math.round((set.allocations[id] ?? 0) * 100)}
                        onChange={(e) => handleAllocationChange(set.id, id, Number(e.target.value) / 100)}
                        className="w-20 h-1 accent-purple-600"
                      />
                      <span className="w-10 text-right text-[10px] font-mono text-gray-600">
                        {Math.round((set.allocations[id] ?? 0) * 100)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {totalAllocation > 1.01 && (
              <p className="mt-1 text-[10px] text-red-600">
                Warning: allocations sum to {Math.round(totalAllocation * 100)}% (exceeds 100%)
              </p>
            )}
          </div>
        );
      })}

      {/* Add new set */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          disabled={nodes.length < 2}
          className="flex items-center gap-1.5 rounded-lg border border-dashed border-purple-300 bg-purple-50 px-3 py-2 text-xs font-medium text-purple-700 transition hover:bg-purple-100 disabled:opacity-50"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Define Competing Reaction Set
        </button>
      ) : (
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-purple-800">New Competing Set</h4>
            <button onClick={() => setShowForm(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
          </div>

          <div>
            <label className="block text-[10px] text-gray-600 mb-0.5">Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Ethylene oxidation pathways"
              className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
            />
          </div>

          <div>
            <label className="block text-[10px] text-gray-600 mb-0.5">Shared reactant formula</label>
            <select
              value={sharedFormula}
              onChange={(e) => { setSharedFormula(e.target.value); setPrimaryId(""); setCompetingIds([]); }}
              className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
            >
              <option value="">Select...</option>
              {[...allReactantFormulas].map((f) => (
                <option key={f} value={f}>{f} ({reactionsWithFormula(f).length} reactions)</option>
              ))}
            </select>
          </div>

          {sharedFormula && (
            <>
              <div>
                <label className="block text-[10px] text-gray-600 mb-0.5">Primary (desired) reaction</label>
                <select
                  value={primaryId}
                  onChange={(e) => setPrimaryId(e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                >
                  <option value="">Select...</option>
                  {reactionsWithFormula(sharedFormula).map((n) => (
                    <option key={n.id} value={n.id}>{n.displayName ?? n.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-gray-600 mb-0.5">Competing (undesired) reactions</label>
                {reactionsWithFormula(sharedFormula)
                  .filter((n) => n.id !== primaryId)
                  .map((n) => (
                    <label key={n.id} className="flex items-center gap-2 py-0.5 text-xs">
                      <input
                        type="checkbox"
                        checked={competingIds.includes(n.id)}
                        onChange={(e) => {
                          if (e.target.checked) setCompetingIds([...competingIds, n.id]);
                          else setCompetingIds(competingIds.filter((id) => id !== n.id));
                        }}
                        className="h-3 w-3 rounded border-gray-300 accent-purple-600"
                      />
                      {n.displayName ?? n.label}
                    </label>
                  ))}
              </div>
            </>
          )}

          <button
            onClick={handleAdd}
            disabled={!primaryId || competingIds.length === 0}
            className="rounded-lg bg-purple-600 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-purple-700 disabled:opacity-50"
          >
            Create Set
          </button>
        </div>
      )}
    </div>
  );
}
