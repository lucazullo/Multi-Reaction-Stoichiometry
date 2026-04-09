"use client";

import { useState } from "react";
import type { AmountUnit, ReactionNode, CalculationInput } from "@/lib/types";
import UnitSelect from "./UnitSelect";

interface SystemInputProps {
  nodes: ReactionNode[];
  onCalculate: (startReactionId: string, input: CalculationInput) => void;
}

export default function SystemInput({ nodes, onCalculate }: SystemInputProps) {
  const [reactionId, setReactionId] = useState(nodes[0]?.id ?? "");
  const [substanceIndex, setSubstanceIndex] = useState(0);
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState<AmountUnit>("g");

  const selectedNode = nodes.find((n) => n.id === reactionId);
  const allSubstances = selectedNode
    ? [...selectedNode.reaction.reactants, ...selectedNode.reaction.products]
    : [];
  const selectedSubstance = allSubstances[substanceIndex];
  const isLiquid = selectedSubstance?.state === "liquid" && selectedSubstance?.density;

  const handleReactionChange = (id: string) => {
    setReactionId(id);
    setSubstanceIndex(0);
  };

  const handleSubstanceChange = (idx: number) => {
    setSubstanceIndex(idx);
    const substance = allSubstances[idx];
    if (!(substance?.state === "liquid" && substance?.density) && (unit === "L" || unit === "gal")) {
      setUnit("g");
    }
  };

  const handleCalculate = () => {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0 || !reactionId) return;
    onCalculate(reactionId, { substanceIndex, amount: parsed, unit });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-500">Starting Reaction</label>
          <select
            value={reactionId}
            onChange={(e) => handleReactionChange(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none"
          >
            {nodes.map((n, i) => (
              <option key={n.id} value={n.id}>
                Reaction {i + 1}: {n.label.slice(0, 40)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Substance</label>
          <select
            value={substanceIndex}
            onChange={(e) => handleSubstanceChange(Number(e.target.value))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none"
          >
            {allSubstances.map((s, i) => (
              <option key={i} value={i}>
                {s.formula} ({s.name}) — {s.role}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-gray-500">Amount</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount..."
            min="0"
            step="any"
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Unit</label>
          <UnitSelect value={unit} onChange={setUnit} allowVolume={!!isLiquid} />
        </div>
        <button
          onClick={handleCalculate}
          disabled={!amount || parseFloat(amount) <= 0}
          className="rounded-lg bg-teal-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Calculate System
        </button>
      </div>
    </div>
  );
}
