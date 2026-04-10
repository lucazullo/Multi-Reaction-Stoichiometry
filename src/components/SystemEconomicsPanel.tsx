"use client";

import { useState } from "react";
import type { AmountUnit, SubstanceTotals, SystemEconLine, SystemEconomics } from "@/lib/types";
import { METHANE_KG_PER_MMBTU } from "@/lib/constants";
import { normalizeFormula } from "@/lib/utils";
import UnitSelect from "./UnitSelect";

export type SavedPrices = Array<{ value: string; unit: string }>;

interface SystemEconomicsPanelProps {
  totals: SubstanceTotals[];
  onCalculate: (economics: SystemEconomics) => void;
  initialPrices?: SavedPrices;
  onPricesChange?: (prices: SavedPrices) => void;
}

const PRICEABLE_ROLES = new Set(["net-reactant", "net-product", "excess"]);

// Extended unit type to include MMBTU
type PriceUnit = AmountUnit | "MMBTU";

function isMethane(formula: string): boolean {
  const norm = normalizeFormula(formula);
  return norm === "CH4" || norm === "ch4";
}

function getQuantityForUnit(t: SubstanceTotals, unit: PriceUnit): number {
  switch (unit) {
    case "mol": return t.totalMoles;
    case "g": return t.totalGrams;
    case "kg": return t.totalKilograms;
    case "lb": return t.totalPounds;
    case "MMBTU": return t.totalKilograms / METHANE_KG_PER_MMBTU;
    default: return 0;
  }
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
  initialPrices,
  onPricesChange,
}: SystemEconomicsPanelProps) {
  const priceableItems = totals.filter((t) => PRICEABLE_ROLES.has(t.role));

  const [prices, setPrices] = useState<Array<{ value: string; unit: PriceUnit }>>(() => {
    if (initialPrices && initialPrices.length === priceableItems.length) {
      return initialPrices.map((p) => ({ value: p.value, unit: p.unit as PriceUnit }));
    }
    return priceableItems.map((t) => ({
      value: "",
      unit: isMethane(t.formula) ? "MMBTU" as PriceUnit : "kg" as PriceUnit,
    }));
  });

  const updatePrices = (next: Array<{ value: string; unit: PriceUnit }>) => {
    setPrices(next);
    onPricesChange?.(next.map((p) => ({ value: p.value, unit: p.unit })));
  };

  const handlePriceChange = (index: number, value: string) => {
    const next = [...prices];
    next[index] = { ...next[index], value };
    updatePrices(next);
  };

  const handleUnitChange = (index: number, unit: PriceUnit) => {
    const next = [...prices];
    next[index] = { ...next[index], unit };
    updatePrices(next);
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
        productValue += totalValue;
      }

      // Store the display unit — cast MMBTU back to AmountUnit for the type
      const displayUnit = prices[i].unit === "MMBTU" ? "kg" as AmountUnit : prices[i].unit as AmountUnit;

      return {
        formula: t.formula,
        name: t.name,
        role: t.role,
        quantity: t.totalMoles,
        quantityGrams: t.totalGrams,
        quantityKg: t.totalKilograms,
        quantityLb: t.totalPounds,
        pricePerUnit: hasPrice ? parsed : null,
        priceUnit: displayUnit,
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
        {priceableItems.map((t, i) => {
          const methane = isMethane(t.formula);
          return (
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
                {methane ? (
                  <select
                    value={prices[i].unit}
                    onChange={(e) => handleUnitChange(i, e.target.value as PriceUnit)}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none"
                  >
                    <optgroup label="Energy">
                      <option value="MMBTU">MMBTU</option>
                    </optgroup>
                    <optgroup label="Amount">
                      <option value="mol">Moles (mol)</option>
                    </optgroup>
                    <optgroup label="Mass">
                      <option value="g">Grams (g)</option>
                      <option value="kg">Kilograms (kg)</option>
                      <option value="lb">Pounds (lb)</option>
                    </optgroup>
                  </select>
                ) : (
                  <UnitSelect
                    value={prices[i].unit as AmountUnit}
                    onChange={(unit) => handleUnitChange(i, unit)}
                    allowVolume={false}
                  />
                )}
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
