"use client";

import { useState } from "react";
import type { SubstanceTotals, ReactionSystem } from "@/lib/types";
import { normalizeFormula } from "@/lib/utils";

interface PhysicalPropertiesTableProps {
  totals: SubstanceTotals[];
  system: ReactionSystem;
}

type DensityUnit = "kg/L" | "lb/ft3" | "lb/gal" | "lb/L";
type HVUnit = "BTU/lb" | "BTU/gal" | "MJ/kg" | "MJ/L";

// Conversion factors
const KG_PER_L_TO_LB_PER_FT3 = 62.428;
const KG_PER_L_TO_LB_PER_GAL = 8.3454;
const KG_PER_L_TO_LB_PER_L = 2.20462;
const KJ_PER_KG_TO_BTU_PER_LB = 0.429923;
const KJ_PER_KG_TO_MJ_PER_KG = 0.001;

const KG_M3_TO_KG_L = 0.001;
const KG_M3_TO_LB_FT3 = 0.062428;

interface SubstanceProps {
  formula: string;
  name: string;
  molarMass: number;
  state: string;
  densityLiquid: number | null;
  densityGas: number | null;
  hhv: number | null;
  lhv: number | null;
  isLiquid: boolean;
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "--";
  if (n === 0) return "0";
  if (Math.abs(n) >= 0.01 && Math.abs(n) < 1e6) return n.toPrecision(4);
  return n.toExponential(3);
}

function convertDensity(p: SubstanceProps, unit: DensityUnit): string {
  if (p.isLiquid && p.densityLiquid !== null) {
    const kgPerL = p.densityLiquid;
    switch (unit) {
      case "kg/L": return fmt(kgPerL);
      case "lb/ft3": return fmt(kgPerL * KG_PER_L_TO_LB_PER_FT3);
      case "lb/gal": return fmt(kgPerL * KG_PER_L_TO_LB_PER_GAL);
      case "lb/L": return fmt(kgPerL * KG_PER_L_TO_LB_PER_L);
    }
  } else if (p.state === "gas" && p.densityGas !== null) {
    const kgPerM3 = p.densityGas;
    switch (unit) {
      case "kg/L": return fmt(kgPerM3 * KG_M3_TO_KG_L);
      case "lb/ft3": return fmt(kgPerM3 * KG_M3_TO_LB_FT3);
      case "lb/gal": return "--";
      case "lb/L": return fmt(kgPerM3 * KG_M3_TO_KG_L * KG_PER_L_TO_LB_PER_L);
    }
  }
  return "--";
}

function convertHV(p: SubstanceProps, kJPerKg: number | null, unit: HVUnit): string {
  if (kJPerKg === null) return "--";
  switch (unit) {
    case "BTU/lb": return fmt(kJPerKg * KJ_PER_KG_TO_BTU_PER_LB);
    case "MJ/kg": return fmt(kJPerKg * KJ_PER_KG_TO_MJ_PER_KG);
    case "BTU/gal":
      if (p.isLiquid && p.densityLiquid !== null) {
        return fmt(kJPerKg * KJ_PER_KG_TO_BTU_PER_LB * p.densityLiquid * KG_PER_L_TO_LB_PER_GAL);
      }
      return "--";
    case "MJ/L":
      if (p.isLiquid && p.densityLiquid !== null) {
        return fmt(kJPerKg * KJ_PER_KG_TO_MJ_PER_KG * p.densityLiquid);
      }
      return "--";
  }
}

const ROLE_STYLES: Record<string, string> = {
  "net-reactant": "bg-blue-50 text-blue-700",
  "net-product": "bg-green-50 text-green-700",
  intermediate: "bg-gray-100 text-gray-500",
  excess: "bg-amber-50 text-amber-700",
  deficit: "bg-red-50 text-red-700",
};

const ROLE_LABELS: Record<string, string> = {
  "net-reactant": "Feedstock",
  "net-product": "Product",
  intermediate: "Intermediate",
  excess: "Excess",
  deficit: "Deficit",
};

function UnitSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-xs text-gray-600 focus:border-teal-500 focus:outline-none"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export default function PhysicalPropertiesTable({
  totals,
  system,
}: PhysicalPropertiesTableProps) {
  // Build substance properties from system nodes
  const substanceMap = new Map<string, SubstanceProps>();
  for (const node of system.nodes) {
    for (const s of [...node.reaction.reactants, ...node.reaction.products]) {
      const key = normalizeFormula(s.formula);
      if (!substanceMap.has(key)) {
        substanceMap.set(key, {
          formula: s.formula,
          name: s.name,
          molarMass: s.molarMass,
          state: s.state,
          densityLiquid: s.density,
          densityGas: s.densityGas ?? null,
          hhv: s.hhv ?? null,
          lhv: s.lhv ?? null,
          isLiquid: s.state === "liquid" && s.density !== null,
        });
      }
    }
  }

  const rows = totals.map((t) => {
    const key = normalizeFormula(t.formula);
    return { totals: t, props: substanceMap.get(key) ?? null };
  });

  // Per-row unit states
  const [densityUnits, setDensityUnits] = useState<DensityUnit[]>(
    rows.map(() => "lb/ft3")
  );
  const [hhvUnits, setHHVUnits] = useState<HVUnit[]>(
    rows.map(() => "BTU/lb")
  );
  const [lhvUnits, setLHVUnits] = useState<HVUnit[]>(
    rows.map(() => "BTU/lb")
  );

  const setDensityUnit = (i: number, u: DensityUnit) => {
    setDensityUnits((prev) => { const next = [...prev]; next[i] = u; return next; });
  };
  const setHHVUnit = (i: number, u: HVUnit) => {
    setHHVUnits((prev) => { const next = [...prev]; next[i] = u; return next; });
  };
  const setLHVUnit = (i: number, u: HVUnit) => {
    setLHVUnits((prev) => { const next = [...prev]; next[i] = u; return next; });
  };

  const densityOptions = (isLiquid: boolean): Array<{ value: string; label: string }> => {
    const opts = [
      { value: "kg/L", label: "kg/L" },
      { value: "lb/ft3", label: "lb/ft\u00B3" },
      { value: "lb/L", label: "lb/L" },
    ];
    if (isLiquid) opts.push({ value: "lb/gal", label: "lb/gal" });
    return opts;
  };

  const hvOptions = (isLiquid: boolean): Array<{ value: string; label: string }> => {
    const opts = [
      { value: "BTU/lb", label: "BTU/lb" },
      { value: "MJ/kg", label: "MJ/kg" },
    ];
    if (isLiquid) {
      opts.push({ value: "BTU/gal", label: "BTU/gal" });
      opts.push({ value: "MJ/L", label: "MJ/L" });
    }
    return opts;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            <th className="pb-3 pr-3">Substance</th>
            <th className="pb-3 pr-3">Role</th>
            <th className="pb-3 pr-3">State</th>
            <th className="pb-3 pr-3">MW (g/mol)</th>
            <th className="pb-3 pr-3">Density</th>
            <th className="pb-3 pr-3">HHV</th>
            <th className="pb-3">LHV</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const t = row.totals;
            const p = row.props;
            const isLiq = p?.isLiquid ?? false;
            return (
              <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-2 pr-3">
                  <span className="font-semibold">{t.formula}</span>
                  <span className="ml-1 text-xs text-gray-400">({t.name})</span>
                </td>
                <td className="py-2 pr-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_STYLES[t.role] ?? ""}`}>
                    {ROLE_LABELS[t.role] ?? t.role}
                  </span>
                </td>
                <td className="py-2 pr-3 text-xs text-gray-600 capitalize">
                  {p?.state ?? "--"}
                </td>
                <td className="py-2 pr-3 font-mono">
                  {p ? fmt(p.molarMass) : "--"}
                </td>
                {/* Density with per-row unit selector */}
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono">{p ? convertDensity(p, densityUnits[i]) : "--"}</span>
                    {p && (p.densityLiquid || p.densityGas) && (
                      <UnitSelect
                        value={densityUnits[i]}
                        onChange={(v) => setDensityUnit(i, v as DensityUnit)}
                        options={densityOptions(isLiq)}
                      />
                    )}
                  </div>
                </td>
                {/* HHV with per-row unit selector */}
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono">{p ? convertHV(p, p.hhv, hhvUnits[i]) : "--"}</span>
                    {p?.hhv !== null && p?.hhv !== undefined && (
                      <UnitSelect
                        value={hhvUnits[i]}
                        onChange={(v) => setHHVUnit(i, v as HVUnit)}
                        options={hvOptions(isLiq)}
                      />
                    )}
                  </div>
                </td>
                {/* LHV with per-row unit selector */}
                <td className="py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono">{p ? convertHV(p, p.lhv, lhvUnits[i]) : "--"}</span>
                    {p?.lhv !== null && p?.lhv !== undefined && (
                      <UnitSelect
                        value={lhvUnits[i]}
                        onChange={(v) => setLHVUnit(i, v as HVUnit)}
                        options={hvOptions(isLiq)}
                      />
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
