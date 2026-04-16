"use client";

import { useState, useEffect } from "react";
import type { SubstanceTotals, SystemEconLine, SystemEconomics, AmountUnit } from "@/lib/types";
import { METHANE_KG_PER_MMBTU } from "@/lib/constants";
import FormulaText from "./FormulaText";
import { normalizeFormula } from "@/lib/utils";

export type SavedPrices = Array<{ value: string; unit: string }>;
export type IntermediateTreatment = "cost" | "revenue";
export type PinnedIntermediate = { formula: string; price: string; unit: string; treat?: IntermediateTreatment };

interface SystemEconomicsPanelProps {
  totals: SubstanceTotals[];
  onCalculate: (economics: SystemEconomics) => void;
  initialPrices?: SavedPrices;
  onPricesChange?: (prices: SavedPrices) => void;
  initialPinnedIntermediates?: PinnedIntermediate[];
  onPinnedIntermediatesChange?: (pinned: PinnedIntermediate[]) => void;
}

const PRICEABLE_ROLES = new Set(["net-reactant", "net-product", "excess"]);

type PriceUnit = "mol" | "g" | "kg" | "lb" | "ton" | "tonne" | "L" | "gal" | "MMBTU";

function isMethane(formula: string): boolean {
  const norm = normalizeFormula(formula);
  return norm === "CH4" || norm === "ch4";
}

/** Compute quantity in the chosen unit from SubstanceTotals (net amounts). */
function getQuantityForUnit(t: SubstanceTotals, unit: PriceUnit): number {
  switch (unit) {
    case "mol": return t.totalMoles;
    case "g": return t.totalGrams;
    case "kg": return t.totalKilograms;
    case "lb": return t.totalPounds;
    case "ton": return t.totalTons;
    case "tonne": return t.totalTonnes;
    case "L": return t.totalLiters ?? 0;
    case "gal": return t.totalGallons ?? 0;
    case "MMBTU": return t.totalKilograms / METHANE_KG_PER_MMBTU;
    default: return 0;
  }
}

/** Compute quantity for an intermediate using throughput (produced) moles. */
function getThroughputForUnit(t: SubstanceTotals, unit: PriceUnit): number {
  const moles = t.produced; // = consumed for true intermediates
  const grams = moles * t.molarMass;
  const kg = grams / 1000;
  switch (unit) {
    case "mol": return moles;
    case "g": return grams;
    case "kg": return kg;
    case "lb": return grams / 453.592;
    case "ton": return grams / 907185;
    case "tonne": return grams / 1000000;
    case "L": return t.isLiquid && t.totalLiters !== null ? (moles / (t.totalMoles || 1)) * t.totalLiters : 0;
    case "gal": return t.isLiquid && t.totalGallons !== null ? (moles / (t.totalMoles || 1)) * t.totalGallons : 0;
    case "MMBTU": return kg / METHANE_KG_PER_MMBTU;
    default: return 0;
  }
}

function defaultUnit(t: SubstanceTotals): PriceUnit {
  if (isMethane(t.formula)) return "MMBTU";
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

function UnitSelect({ value, onChange, methane, liquid }: {
  value: PriceUnit; onChange: (u: PriceUnit) => void; methane: boolean; liquid: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as PriceUnit)}
      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none"
    >
      {methane && (
        <optgroup label="Energy">
          <option value="MMBTU">MMBTU</option>
        </optgroup>
      )}
      <optgroup label="Amount">
        <option value="mol">Moles (mol)</option>
      </optgroup>
      <optgroup label="Mass">
        <option value="g">Grams (g)</option>
        <option value="kg">Kilograms (kg)</option>
        <option value="lb">Pounds (lb)</option>
        <option value="ton">Short Ton (US)</option>
        <option value="tonne">Metric Tonne</option>
      </optgroup>
      {liquid && (
        <optgroup label="Volume">
          <option value="L">Liters (L)</option>
          <option value="gal">Gallons (gal)</option>
        </optgroup>
      )}
    </select>
  );
}

export default function SystemEconomicsPanel({
  totals,
  onCalculate,
  initialPrices,
  onPricesChange,
  initialPinnedIntermediates,
  onPinnedIntermediatesChange,
}: SystemEconomicsPanelProps) {
  const priceableItems = totals.filter((t) => PRICEABLE_ROLES.has(t.role));
  const intermediateItems = totals.filter((t) => t.role === "intermediate");

  // --- Boundary substance prices ---
  const [prices, setPrices] = useState<Array<{ value: string; unit: PriceUnit }>>(() => {
    if (initialPrices && initialPrices.length === priceableItems.length) {
      return initialPrices.map((p) => ({ value: p.value, unit: p.unit as PriceUnit }));
    }
    return priceableItems.map((t) => ({ value: "", unit: defaultUnit(t) }));
  });

  // --- Pinned intermediates ---
  const [pinned, setPinned] = useState<Set<string>>(() => {
    return new Set((initialPinnedIntermediates ?? []).map((p) => normalizeFormula(p.formula)));
  });
  const [intPrices, setIntPrices] = useState<Map<string, { value: string; unit: PriceUnit; treat: IntermediateTreatment }>>(() => {
    const m = new Map<string, { value: string; unit: PriceUnit; treat: IntermediateTreatment }>();
    for (const p of initialPinnedIntermediates ?? []) {
      m.set(normalizeFormula(p.formula), { value: p.price, unit: p.unit as PriceUnit, treat: p.treat ?? "cost" });
    }
    return m;
  });

  // Propagate pinned intermediate changes to parent
  const syncPinned = (nextPinned: Set<string>, nextIntPrices: Map<string, { value: string; unit: PriceUnit; treat: IntermediateTreatment }>) => {
    const arr: PinnedIntermediate[] = [];
    for (const formula of nextPinned) {
      const p = nextIntPrices.get(formula) ?? { value: "", unit: "kg" as PriceUnit, treat: "cost" as IntermediateTreatment };
      arr.push({ formula, price: p.value, unit: p.unit, treat: p.treat });
    }
    onPinnedIntermediatesChange?.(arr);
  };

  // Reset prices if totals structure changes
  useEffect(() => {
    if (prices.length !== priceableItems.length) {
      const next = priceableItems.map((t) => ({ value: "", unit: defaultUnit(t) }));
      setPrices(next);
      onPricesChange?.(next.map((p) => ({ value: p.value, unit: p.unit })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceableItems.length]);

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

  const togglePin = (formula: string) => {
    const key = normalizeFormula(formula);
    const next = new Set(pinned);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
      if (!intPrices.has(key)) {
        const t = intermediateItems.find((t) => normalizeFormula(t.formula) === key);
        const newPrices = new Map(intPrices);
        newPrices.set(key, { value: "", unit: t ? defaultUnit(t) : "kg", treat: "cost" });
        setIntPrices(newPrices);
        setPinned(next);
        syncPinned(next, newPrices);
        return;
      }
    }
    setPinned(next);
    syncPinned(next, intPrices);
  };

  const handleIntPriceChange = (formula: string, value: string) => {
    const key = normalizeFormula(formula);
    const next = new Map(intPrices);
    next.set(key, { ...next.get(key)!, value });
    setIntPrices(next);
    syncPinned(pinned, next);
  };

  const handleIntUnitChange = (formula: string, unit: PriceUnit) => {
    const key = normalizeFormula(formula);
    const next = new Map(intPrices);
    next.set(key, { ...next.get(key)!, unit });
    setIntPrices(next);
    syncPinned(pinned, next);
  };

  const handleIntTreatChange = (formula: string, treat: IntermediateTreatment) => {
    const key = normalizeFormula(formula);
    const next = new Map(intPrices);
    next.set(key, { ...next.get(key)!, treat });
    setIntPrices(next);
    syncPinned(pinned, next);
  };

  // --- Calculate ---
  const handleCalculate = () => {
    let feedstockCost = 0;
    let productValue = 0;
    let intermediateValue = 0;

    // Boundary substances
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

      const methane = isMethane(t.formula);
      return {
        formula: t.formula,
        name: t.name,
        role: t.role,
        quantity: t.totalMoles,
        quantityGrams: t.totalGrams,
        quantityKg: t.totalKilograms,
        quantityLb: t.totalPounds,
        quantityTons: t.totalTons,
        quantityTonnes: t.totalTonnes,
        quantityLiters: t.totalLiters,
        quantityGallons: t.totalGallons,
        quantityMMBTU: methane ? t.totalKilograms / METHANE_KG_PER_MMBTU : null,
        isLiquid: t.isLiquid,
        isMethane: methane,
        pricePerUnit: hasPrice ? parsed : null,
        priceUnit: prices[i].unit as string as AmountUnit,
        totalValue,
      };
    });

    // Pinned intermediates
    let intermediateCost = 0;
    let intermediateRevenue = 0;
    for (const t of intermediateItems) {
      const key = normalizeFormula(t.formula);
      if (!pinned.has(key)) continue;
      const p = intPrices.get(key);
      if (!p) continue;

      const parsed = parseFloat(p.value);
      const hasPrice = !isNaN(parsed) && parsed > 0;
      const quantity = hasPrice ? getThroughputForUnit(t, p.unit) : 0;
      const totalValue = hasPrice ? parsed * quantity : 0;
      const treat = p.treat ?? "cost";
      if (treat === "cost") {
        intermediateCost += totalValue;
      } else {
        intermediateRevenue += totalValue;
      }
      intermediateValue += totalValue;

      const throughputGrams = t.produced * t.molarMass;
      const throughputKg = throughputGrams / 1000;
      const methane = isMethane(t.formula);
      perSubstance.push({
        formula: t.formula,
        name: t.name,
        role: "intermediate",
        quantity: t.produced,
        quantityGrams: throughputGrams,
        quantityKg: throughputKg,
        quantityLb: throughputGrams / 453.592,
        quantityTons: throughputGrams / 907185,
        quantityTonnes: throughputGrams / 1000000,
        quantityLiters: t.isLiquid ? throughputKg : null,
        quantityGallons: t.isLiquid ? throughputKg / 3.78541 : null,
        quantityMMBTU: methane ? throughputKg / METHANE_KG_PER_MMBTU : null,
        isLiquid: t.isLiquid,
        isMethane: methane,
        pricePerUnit: hasPrice ? parsed : null,
        priceUnit: p.unit as string as AmountUnit,
        totalValue,
      });
    }

    onCalculate({
      perSubstance,
      feedstockCost,
      productValue,
      intermediateValue,
      delta: (productValue + intermediateRevenue) - (feedstockCost + intermediateCost),
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Enter prices for feedstocks and products at the system boundary.
      </p>

      {/* Boundary substances */}
      <div className="space-y-3">
        {priceableItems.map((t, i) => {
          const methane = isMethane(t.formula);
          const liquid = t.isLiquid;
          return (
            <div key={t.formula} className="flex items-center gap-3">
              <div className="w-52 flex-shrink-0 flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_STYLES[t.role] ?? ""}`}>
                  {ROLE_LABELS[t.role] ?? t.role}
                </span>
                <FormulaText formula={t.formula} className="text-sm font-semibold text-gray-700" />
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
                <UnitSelect value={prices[i].unit} onChange={(u) => handleUnitChange(i, u)} methane={methane} liquid={liquid} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Intermediates — collapsible section */}
      {intermediateItems.length > 0 && (
        <div className="rounded-lg border border-purple-200 bg-purple-50/30 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-purple-700">Intermediates</span>
            <span className="text-xs text-purple-500">
              — include in analysis to assign internal transfer prices
            </span>
          </div>
          {intermediateItems.map((t) => {
            const key = normalizeFormula(t.formula);
            const isPinned = pinned.has(key);
            const p = intPrices.get(key) ?? { value: "", unit: "kg" as PriceUnit, treat: "cost" as IntermediateTreatment };
            const methane = isMethane(t.formula);
            const throughputKg = (t.produced * t.molarMass) / 1000;
            return (
              <div key={key} className="space-y-2">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isPinned}
                      onChange={() => togglePin(t.formula)}
                      className="rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                    />
                    <FormulaText formula={t.formula} className="text-sm font-semibold text-gray-700" />
                    <span className="text-xs text-gray-400">({t.name})</span>
                  </label>
                  <span className="text-xs text-purple-500 font-mono">
                    throughput: {throughputKg.toPrecision(4)} kg
                  </span>
                </div>
                {isPinned && (
                  <div className="flex items-center gap-1.5 ml-6 flex-wrap">
                    <select
                      value={p.treat}
                      onChange={(e) => handleIntTreatChange(t.formula, e.target.value as IntermediateTreatment)}
                      className={`rounded-lg border px-2 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 ${
                        p.treat === "cost"
                          ? "border-blue-300 bg-blue-50 text-blue-700 focus:border-blue-500 focus:ring-blue-500"
                          : "border-green-300 bg-green-50 text-green-700 focus:border-green-500 focus:ring-green-500"
                      }`}
                    >
                      <option value="cost">Cost</option>
                      <option value="revenue">Revenue</option>
                    </select>
                    <span className="text-sm text-gray-500">$</span>
                    <input
                      type="number"
                      value={p.value}
                      onChange={(e) => handleIntPriceChange(t.formula, e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="any"
                      className="w-28 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                    />
                    <span className="text-sm text-gray-500">per</span>
                    <UnitSelect value={p.unit} onChange={(u) => handleIntUnitChange(t.formula, u)} methane={methane} liquid={t.isLiquid} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={handleCalculate}
        className="rounded-lg bg-amber-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-amber-700"
      >
        Calculate Economics
      </button>
    </div>
  );
}
