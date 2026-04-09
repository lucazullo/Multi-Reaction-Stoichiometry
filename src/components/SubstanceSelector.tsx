"use client";

import { useState } from "react";
import type { AmountUnit, BalancedReaction, CalculationInput } from "@/lib/types";
import UnitSelect from "./UnitSelect";

interface SubstanceSelectorProps {
  reaction: BalancedReaction;
  onCalculate: (input: CalculationInput) => void;
}

export default function SubstanceSelector({
  reaction,
  onCalculate,
}: SubstanceSelectorProps) {
  const allSubstances = [...reaction.reactants, ...reaction.products];
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState<AmountUnit>("g");

  const selected = allSubstances[selectedIndex];
  const isLiquid = selected?.state === "liquid" && selected?.density;

  // Reset volume unit if switching away from a liquid
  const handleSubstanceChange = (index: number) => {
    setSelectedIndex(index);
    const substance = allSubstances[index];
    const substanceIsLiquid = substance?.state === "liquid" && substance?.density;
    if (!substanceIsLiquid && (unit === "L" || unit === "gal")) {
      setUnit("g");
    }
  };

  const handleCalculate = () => {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) return;
    onCalculate({ substanceIndex: selectedIndex, amount: parsed, unit });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-gray-700">
        Select a substance and enter a quantity:
      </h3>

      <div className="flex flex-wrap gap-2">
        {allSubstances.map((s, i) => (
          <button
            key={i}
            onClick={() => handleSubstanceChange(i)}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
              selectedIndex === i
                ? "border-teal-500 bg-teal-50 text-teal-700 ring-1 ring-teal-500"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {s.formula}
            <span className="ml-1 text-xs font-normal opacity-70">
              ({s.name})
            </span>
          </button>
        ))}
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
          <UnitSelect
            value={unit}
            onChange={setUnit}
            allowVolume={!!isLiquid}
          />
        </div>
        <button
          onClick={handleCalculate}
          disabled={!amount || parseFloat(amount) <= 0}
          className="rounded-lg bg-teal-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Calculate
        </button>
      </div>
    </div>
  );
}
