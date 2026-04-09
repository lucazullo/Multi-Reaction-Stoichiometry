"use client";

import type { CalculationResult, EnergyUnit, ThermodynamicsResult } from "@/lib/types";

interface ThermodynamicsDisplayProps {
  thermodynamics: ThermodynamicsResult;
  energyUnit: EnergyUnit;
  onEnergyUnitChange: (unit: EnergyUnit) => void;
  selectedResult: CalculationResult;
}

const KJ_TO_BTU = 0.947817;

function fmt(n: number): string {
  if (n === 0) return "0";
  if (Math.abs(n) >= 0.01 && Math.abs(n) < 1e6) return n.toPrecision(4);
  return n.toExponential(3);
}

function convert(kJ: number, unit: EnergyUnit): number {
  return unit === "BTU" ? kJ * KJ_TO_BTU : kJ;
}

export default function ThermodynamicsDisplay({
  thermodynamics,
  energyUnit,
  onEnergyUnitChange,
  selectedResult,
}: ThermodynamicsDisplayProps) {
  const { deltaH, isExothermic, perSubstance } = thermodynamics;
  const sel = selectedResult;
  const selName = sel.substance.formula;

  // Specific energy: deltaH per unit of the selected substance
  const specificEnergy = {
    perMol: sel.moles > 0 ? deltaH / sel.moles : 0,
    perG: sel.grams > 0 ? deltaH / sel.grams : 0,
    perKg: sel.kilograms > 0 ? deltaH / sel.kilograms : 0,
    perLb: sel.pounds > 0 ? deltaH / sel.pounds : 0,
    perL: sel.liters && sel.liters > 0 ? deltaH / sel.liters : null,
    perGal: sel.gallons && sel.gallons > 0 ? deltaH / sel.gallons : null,
  };

  return (
    <div className="space-y-4">
      {/* Banner */}
      <div
        className={`flex items-center justify-between rounded-lg p-4 ${
          isExothermic
            ? "bg-orange-50 border border-orange-200"
            : "bg-blue-50 border border-blue-200"
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{isExothermic ? "\uD83D\uDD25" : "\u2744\uFE0F"}</span>
          <div>
            <p
              className={`font-semibold ${
                isExothermic ? "text-orange-800" : "text-blue-800"
              }`}
            >
              {isExothermic ? "Exothermic Reaction" : "Endothermic Reaction"}
            </p>
            <p
              className={`text-sm font-mono ${
                isExothermic ? "text-orange-600" : "text-blue-600"
              }`}
            >
              ΔH<sub>rxn</sub> = {fmt(convert(deltaH, energyUnit))}{" "}
              {energyUnit}
            </p>
          </div>
        </div>

        {/* Energy unit toggle */}
        <div className="flex rounded-lg border border-gray-300 bg-white overflow-hidden text-sm">
          <button
            onClick={() => onEnergyUnitChange("kJ")}
            className={`px-3 py-1.5 font-medium transition ${
              energyUnit === "kJ"
                ? "bg-teal-600 text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            kJ
          </button>
          <button
            onClick={() => onEnergyUnitChange("BTU")}
            className={`px-3 py-1.5 font-medium transition ${
              energyUnit === "BTU"
                ? "bg-teal-600 text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            BTU
          </button>
        </div>
      </div>

      {/* Specific energy per unit of selected substance */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <p className="mb-2 text-sm font-medium text-gray-700">
          Energy per unit of <span className="font-semibold text-teal-700">{selName}</span> ({sel.substance.name}):
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">{energyUnit}/mol:</span>
            <span className="font-mono">{fmt(convert(specificEnergy.perMol, energyUnit))}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{energyUnit}/g:</span>
            <span className="font-mono">{fmt(convert(specificEnergy.perG, energyUnit))}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{energyUnit}/kg:</span>
            <span className="font-mono">{fmt(convert(specificEnergy.perKg, energyUnit))}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{energyUnit}/lb:</span>
            <span className="font-mono">{fmt(convert(specificEnergy.perLb, energyUnit))}</span>
          </div>
          {specificEnergy.perL !== null && (
            <div className="flex justify-between">
              <span className="text-gray-500">{energyUnit}/L:</span>
              <span className="font-mono">{fmt(convert(specificEnergy.perL, energyUnit))}</span>
            </div>
          )}
          {specificEnergy.perGal !== null && (
            <div className="flex justify-between">
              <span className="text-gray-500">{energyUnit}/gal:</span>
              <span className="font-mono">{fmt(convert(specificEnergy.perGal, energyUnit))}</span>
            </div>
          )}
        </div>
      </div>

      {/* Per-substance table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th className="pb-3 pr-4">Substance</th>
              <th className="pb-3 pr-4">Role</th>
              <th className="pb-3 pr-4">ΔHf° (kJ/mol)</th>
              <th className="pb-3 pr-4">Moles</th>
              <th className="pb-3">
                Heat Contribution ({energyUnit})
              </th>
            </tr>
          </thead>
          <tbody>
            {perSubstance.map((row, i) => (
              <tr
                key={i}
                className="border-b border-gray-100 hover:bg-gray-50"
              >
                <td className="py-2 pr-4">
                  <span className="font-semibold">
                    {row.substance.formula}
                  </span>
                  <span className="ml-1 text-xs text-gray-400">
                    ({row.substance.name})
                  </span>
                </td>
                <td className="py-2 pr-4">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      row.substance.role === "reactant"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-green-50 text-green-700"
                    }`}
                  >
                    {row.substance.role}
                  </span>
                </td>
                <td className="py-2 pr-4 font-mono">
                  {fmt(row.enthalpyOfFormation)}
                </td>
                <td className="py-2 pr-4 font-mono">{fmt(row.moles)}</td>
                <td
                  className={`py-2 font-mono ${
                    row.heatContribution < 0
                      ? "text-orange-600"
                      : row.heatContribution > 0
                      ? "text-blue-600"
                      : ""
                  }`}
                >
                  {row.heatContribution > 0 ? "+" : ""}
                  {fmt(convert(row.heatContribution, energyUnit))}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 font-semibold">
              <td className="pt-3 pr-4" colSpan={4}>
                Total ΔH<sub>rxn</sub>
              </td>
              <td
                className={`pt-3 font-mono ${
                  isExothermic ? "text-orange-600" : "text-blue-600"
                }`}
              >
                {fmt(convert(deltaH, energyUnit))} {energyUnit}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
