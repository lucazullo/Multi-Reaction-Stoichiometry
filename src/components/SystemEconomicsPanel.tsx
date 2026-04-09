"use client";

import { useState } from "react";
import type { AmountUnit, SubstanceTotals, SystemEconLine, SystemEconomics } from "@/lib/types";
import UnitSelect from "./UnitSelect";

interface SystemEconomicsPanelProps {
  totals: SubstanceTotals[];
  onCalculate: (economics: SystemEconomics) => void;
}

// Only feedstocks, products, and excess are priceable
const PRICEABLE_ROLES = new Set(["net-reactant", "net-product", "excess"]);

function getQuantityForUnit(t: SubstanceTotals, unit: AmountUnit): number {
  switch (unit) {
    case "mol": return t.totalMoles;
    case "g": return t.totalGrams;
    case "kg": return t.totalKilograms;
    case "lb": return t.totalPounds;
    default: return 0;
  }
}

function fmt(n: number): string {
  if (n === 0) return "$0.00";
  if (Math.abs(n) < 0.01) return "$" + n.toExponential(2);
  return "$" + n.toFixed(2);
}

const ROLE_LABELS: Record<string, string> = {
  "net-reactant": "Feedstock",
  "net-product": "Product",
  excess: "Excess",
};

const ROLE_STYLES: Record<string, string> = {
  "net-reactant": "bg-blue-50 text-blue-700",
  "net-product": "bg-green-50 text-green-700",
  excess: "bg-amber-50 text-amber-700",
};

export default function SystemEconomicsPanel({
  totals,
  onCalculate,
}: SystemEconomicsPanelProps) {
  const priceableItems = totals.filter((t) => PRICEABLE_ROLES.has(t.role));

  const [prices, setPrices] = useState<Array<{ value: string; unit: AmountUnit }>>(
    priceableItems.map(() => ({ value: "", unit: "kg" as AmountUnit }))
  );

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
    let feedstockCost = 0;
    let productValue = 0;

    const perSubstance: SystemEconLine[] = priceableItems.map((t, i) => {
      const parsed = parseFloat(prices[i].value);
      const hasPrice = !isNaN(parsed) && parsed > 0;
      const quantity = hasPrice ? getQuantityForUnit(t, prices[i].unit) : 0;
      const totalValue = hasPrice ? parsed * quantity : 0;

      if (t.role === "net-reactant") {
        feedstockCost += totalValue;
      } else {
        // net-product and excess both count as value
        productValue += totalValue;
      }

      return {
        formula: t.formula,
        name: t.name,
        role: t.role,
        quantity: t.totalMoles,
        quantityGrams: t.totalGrams,
        quantityKg: t.totalKilograms,
        quantityLb: t.totalPounds,
        pricePerUnit: hasPrice ? parsed : null,
        priceUnit: prices[i].unit,
        totalValue,
      };
    });

    onCalculate({
      perSubstance,
      feedstockCost,
      productValue,
      delta: productValue - feedstockCost,
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Enter prices for feedstocks and products at the system boundary. Intermediates are internal and not priced.
      </p>

      <div className="space-y-3">
        {priceableItems.map((t, i) => (
          <div key={t.formula} className="flex items-center gap-3">
            <div className="w-52 flex-shrink-0 flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_STYLES[t.role] ?? ""}`}>
                {ROLE_LABELS[t.role] ?? t.role}
              </span>
              <span className="text-sm font-semibold text-gray-700">{t.formula}</span>
              <span className="text-xs text-gray-400">({t.name})</span>
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
                allowVolume={false}
              />
            </div>
          </div>
        ))}
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
