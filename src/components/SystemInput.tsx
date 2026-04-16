"use client";

import { useState, useEffect, useRef } from "react";
import type { AmountUnit, ReactionNode, CalculationInput } from "@/lib/types";
import UnitSelect from "./UnitSelect";
import { unicodeFormula } from "./FormulaText";

interface SystemInputProps {
  nodes: ReactionNode[];
  onCalculate: (startReactionId: string, input: CalculationInput) => void;
  initialReactionId?: string | null;
  initialInput?: CalculationInput | null;
}

export default function SystemInput({
  nodes,
  onCalculate,
  initialReactionId,
  initialInput,
}: SystemInputProps) {
  const [reactionId, setReactionId] = useState(initialReactionId ?? nodes[0]?.id ?? "");
  const [substanceIndex, setSubstanceIndex] = useState(initialInput?.substanceIndex ?? 0);
  const [amount, setAmount] = useState(initialInput ? String(initialInput.amount) : "");
  const [unit, setUnit] = useState<AmountUnit>(initialInput?.unit ?? "g");

  // Track last-synced initial values to avoid re-syncing on every object reference change.
  // This prevents the useEffect from overriding user selections after each Calculate click
  // (which creates a new startInput object even when values haven't changed).
  const lastSyncedRef = useRef<{
    reactionId: string | null | undefined;
    substanceIndex: number | undefined;
    amount: number | undefined;
    unit: AmountUnit | undefined;
  }>({
    reactionId: initialReactionId,
    substanceIndex: initialInput?.substanceIndex,
    amount: initialInput?.amount,
    unit: initialInput?.unit,
  });

  // Sync reactionId when nodes change (e.g., reaction added/deleted).
  // Also reset substanceIndex when falling back to avoid out-of-bounds.
  useEffect(() => {
    if (!reactionId || !nodes.find((n) => n.id === reactionId)) {
      if (nodes.length > 0) {
        setReactionId(nodes[0].id);
        setSubstanceIndex(0);
      }
    }
  }, [nodes, reactionId]);

  // Restore values when initial props meaningfully change (e.g., session load).
  // Uses value comparison (not reference) to avoid overriding user selections
  // when the parent re-renders with a new object that has the same values.
  useEffect(() => {
    const prev = lastSyncedRef.current;
    const newReactionId = initialReactionId ?? null;
    const newSubIdx = initialInput?.substanceIndex;
    const newAmount = initialInput?.amount;
    const newUnit = initialInput?.unit;

    const changed =
      newReactionId !== prev.reactionId ||
      newSubIdx !== prev.substanceIndex ||
      newAmount !== prev.amount ||
      newUnit !== prev.unit;

    if (!changed) return;

    // Update the ref to reflect what we're syncing
    lastSyncedRef.current = {
      reactionId: newReactionId,
      substanceIndex: newSubIdx,
      amount: newAmount,
      unit: newUnit,
    };

    if (initialReactionId) setReactionId(initialReactionId);
    if (initialInput) {
      setSubstanceIndex(initialInput.substanceIndex);
      setAmount(String(initialInput.amount));
      setUnit(initialInput.unit);
    }
  }, [initialReactionId, initialInput]);

  const selectedNode = nodes.find((n) => n.id === reactionId);
  const allSubstances = selectedNode
    ? [...selectedNode.reaction.reactants, ...selectedNode.reaction.products]
    : [];

  // Guard substanceIndex bounds — clamp if out of range (e.g., after reaction edit)
  const safeSubstanceIndex =
    allSubstances.length > 0
      ? Math.min(substanceIndex, allSubstances.length - 1)
      : 0;
  if (safeSubstanceIndex !== substanceIndex && allSubstances.length > 0) {
    // Schedule the state correction (can't call setState during render in strict mode)
    // Use the safe value for this render; the effect below will sync state
    // eslint-disable-next-line react-hooks/exhaustive-deps
    setTimeout(() => setSubstanceIndex(safeSubstanceIndex), 0);
  }

  const selectedSubstance = allSubstances[safeSubstanceIndex];
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
    onCalculate(reactionId, { substanceIndex: safeSubstanceIndex, amount: parsed, unit });
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
            value={safeSubstanceIndex}
            onChange={(e) => handleSubstanceChange(Number(e.target.value))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none"
          >
            {allSubstances.map((s, i) => (
              <option key={i} value={i}>
                {unicodeFormula(s.formula)} ({s.name}) — {s.role}
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
