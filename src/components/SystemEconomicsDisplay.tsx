"use client";

import { useState } from "react";
import type { SystemEconomics, SystemEconLine } from "@/lib/types";
import FormulaText from "./FormulaText";

interface SystemEconomicsDisplayProps {
  economics: SystemEconomics;
}

function fmt(n: number): string {
  if (n === 0) return "$0.00";
  if (Math.abs(n) < 0.01) return "$" + n.toExponential(2);
  return "$" + n.toFixed(2);
}

function fmtQty(n: number | null): string {
  if (n === null) return "--";
  if (n === 0) return "0";
  if (Math.abs(n) < 0.01) return n.toExponential(3);
  if (Math.abs(n) >= 1e6) return n.toExponential(4);
  return n.toPrecision(4);
}

type DisplayUnit = "g" | "kg" | "lb" | "ton" | "tonne" | "L" | "gal" | "MMBTU";

const UNIT_LABELS: Record<DisplayUnit, string> = {
  g: "g",
  kg: "kg",
  lb: "lb",
  ton: "short ton",
  tonne: "tonne",
  L: "L",
  gal: "gal",
  MMBTU: "MMBTU",
};

function getDisplayQuantity(e: SystemEconLine, unit: DisplayUnit): number | null {
  switch (unit) {
    case "g": return e.quantityGrams;
    case "kg": return e.quantityKg;
    case "lb": return e.quantityLb;
    case "ton": return e.quantityTons;
    case "tonne": return e.quantityTonnes;
    case "L": return e.quantityLiters;
    case "gal": return e.quantityGallons;
    case "MMBTU": return e.quantityMMBTU;
    default: return e.quantityKg;
  }
}

function defaultDisplayUnit(e: SystemEconLine): DisplayUnit {
  if (e.isMethane) return "MMBTU";
  if (e.quantityKg >= 500) return "tonne";
  return "kg";
}

const ROLE_LABELS: Record<string, string> = {
  "net-reactant": "Feedstock",
  "net-product": "Product",
  excess: "Excess",
  intermediate: "Intermediate",
};

const ROLE_STYLES: Record<string, string> = {
  "net-reactant": "bg-blue-50 text-blue-700",
  "net-product": "bg-green-50 text-green-700",
  excess: "bg-amber-50 text-amber-700",
  intermediate: "bg-purple-50 text-purple-700",
};

const VALUE_COLORS: Record<string, string> = {
  "net-reactant": "text-blue-700",
  "net-product": "text-green-700",
  excess: "text-green-700",
  intermediate: "text-purple-700",
};

export default function SystemEconomicsDisplay({
  economics,
}: SystemEconomicsDisplayProps) {
  const { perSubstance, feedstockCost, productValue, intermediateValue, delta } = economics;

  const [units, setUnits] = useState<DisplayUnit[]>(() =>
    perSubstance.map((e) => defaultDisplayUnit(e))
  );

  const handleUnitChange = (index: number, unit: DisplayUnit) => {
    setUnits((prev) => {
      const next = [...prev];
      next[index] = unit;
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th className="pb-3 pr-4">Substance</th>
              <th className="pb-3 pr-4">Role</th>
              <th className="pb-3 pr-4">Quantity</th>
              <th className="pb-3 pr-4">Price/Unit</th>
              <th className="pb-3">Total Cost/Price</th>
            </tr>
          </thead>
          <tbody>
            {perSubstance.map((e, i) => {
              const unit = units[i] ?? "kg";
              const qty = getDisplayQuantity(e, unit);
              return (
                <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 pr-4">
                    <FormulaText formula={e.formula} className="font-semibold" />
                    <span className="ml-1 text-xs text-gray-400">({e.name})</span>
                  </td>
                  <td className="py-2 pr-4">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_STYLES[e.role] ?? "bg-gray-100 text-gray-500"}`}>
                      {ROLE_LABELS[e.role] ?? e.role}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-sm">{fmtQty(qty)}</span>
                      <select
                        value={unit}
                        onChange={(ev) => handleUnitChange(i, ev.target.value as DisplayUnit)}
                        className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-xs text-gray-600 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 focus:outline-none"
                      >
                        <optgroup label="Mass">
                          <option value="g">g</option>
                          <option value="kg">kg</option>
                          <option value="lb">lb</option>
                          <option value="ton">short ton</option>
                          <option value="tonne">metric tonne</option>
                        </optgroup>
                        {(e.isLiquid || e.quantityLiters !== null) && (
                          <optgroup label="Volume">
                            <option value="L">L</option>
                            <option value="gal">gal</option>
                          </optgroup>
                        )}
                        {e.isMethane && (
                          <optgroup label="Energy">
                            <option value="MMBTU">MMBTU</option>
                          </optgroup>
                        )}
                      </select>
                      {e.role === "intermediate" && (
                        <span className="text-[10px] text-purple-400">(throughput)</span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 pr-4 font-mono text-sm">
                    {e.pricePerUnit !== null
                      ? `$${e.pricePerUnit}/${e.priceUnit}`
                      : "--"}
                  </td>
                  <td className={`py-2 font-mono text-sm ${VALUE_COLORS[e.role] ?? "text-gray-700"}`}>
                    {e.totalValue > 0 ? fmt(e.totalValue) : "--"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Total Feedstock Cost:</span>
          <span className="font-mono font-medium text-blue-700">{fmt(feedstockCost)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Total Product/Excess Value:</span>
          <span className="font-mono font-medium text-green-700">{fmt(productValue)}</span>
        </div>
        {intermediateValue > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Internal Transfer Value (intermediates):</span>
            <span className="font-mono font-medium text-purple-700">{fmt(intermediateValue)}</span>
          </div>
        )}
        <div className="border-t border-gray-300 pt-2 flex justify-between text-sm font-semibold">
          <span className="text-gray-800">Net Delta:</span>
          <span className={`font-mono ${delta >= 0 ? "text-green-600" : "text-red-600"}`}>
            {delta >= 0 ? "+" : ""}{fmt(delta)}
          </span>
        </div>
      </div>
    </div>
  );
}
