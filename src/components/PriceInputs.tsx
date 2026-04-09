"use client";

import { useState } from "react";
import type { AmountUnit, BalancedReaction, PriceEntry } from "@/lib/types";
import UnitSelect from "./UnitSelect";

interface PriceInputsProps {
  reaction: BalancedReaction;
  onCalculate: (prices: Map<number, PriceEntry>) => void;
}

export default function PriceInputs({
  reaction,
  onCalculate,
}: PriceInputsProps) {
  const allSubstances = [...reaction.reactants, ...reaction.products];

  const [prices, setPrices] = useState<
    Array<{ value: string; unit: AmountUnit }>
  >(allSubstances.map(() => ({ value: "", unit: "kg" as AmountUnit })));

  const handlePriceChange = (index: number, value: string) => {
    setPrices((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], value };
      return next;
    });
  };

  const handleUnitChange = (index: number, unit: AmountUnit) => {
    setPrices((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], unit };
      return next;
    });
  };

  const handleCalculate = () => {
    const priceMap = new Map<number, PriceEntry>();
    prices.forEach((p, i) => {
      const parsed = parseFloat(p.value);
      priceMap.set(i, {
        price: isNaN(parsed) || parsed <= 0 ? null : parsed,
        unit: p.unit,
      });
    });
    onCalculate(priceMap);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Enter prices for substances to calculate economics. Leave blank for $0.
      </p>

      <div className="space-y-2">
        {allSubstances.map((s, i) => {
          const isLiquid = s.state === "liquid" && s.density;
          return (
            <div key={i} className="flex items-center gap-3">
              <div className="w-40 flex-shrink-0">
                <span
                  className={`text-sm font-medium ${
                    s.role === "reactant" ? "text-blue-700" : "text-green-700"
                  }`}
                >
                  {s.formula}
                </span>
                <span className="ml-1 text-xs text-gray-400">({s.name})</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-500">$</span>
                <input
                  type="number"
                  value={prices[i].value}
                  onChange={(e) => handlePriceChange(i, e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="any"
                  className="w-28 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none"
                />
                <span className="text-sm text-gray-500">per</span>
                <UnitSelect
                  value={prices[i].unit}
                  onChange={(unit) => handleUnitChange(i, unit)}
                  allowVolume={!!isLiquid}
                />
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={handleCalculate}
        className="rounded-lg bg-amber-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-amber-700"
      >
        Calculate Economics
      </button>
    </div>
  );
}
