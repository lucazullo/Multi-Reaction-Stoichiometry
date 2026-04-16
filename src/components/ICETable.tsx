"use client";

import type { BalancedReaction, EquilibriumResult } from "@/lib/types";

interface ICETableProps {
  reaction: BalancedReaction;
  initialConcentrations: Record<string, number>; // formula → mol/L
  result: EquilibriumResult;
}

function fmt(n: number): string {
  if (n === 0) return "0";
  if (Math.abs(n) >= 0.01 && Math.abs(n) < 1e6) return n.toPrecision(4);
  return n.toExponential(3);
}

export default function ICETable({ reaction, initialConcentrations, result }: ICETableProps) {
  const allSpecies = [
    ...reaction.reactants.map((r) => ({ ...r, sign: -1 })),
    ...reaction.products.map((p) => ({ ...p, sign: 1 })),
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-300">
            <th className="py-2 pr-4 text-left font-semibold text-gray-600"></th>
            {allSpecies.map((s) => (
              <th key={s.formula} className="px-3 py-2 text-center font-semibold text-gray-700">
                {s.formula}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Initial */}
          <tr className="border-b border-gray-100">
            <td className="py-1.5 pr-4 font-medium text-gray-600">I (mol/L)</td>
            {allSpecies.map((s) => (
              <td key={s.formula} className="px-3 py-1.5 text-center font-mono">
                {fmt(initialConcentrations[s.formula] ?? 0)}
              </td>
            ))}
          </tr>
          {/* Change */}
          <tr className="border-b border-gray-100">
            <td className="py-1.5 pr-4 font-medium text-gray-600">C (mol/L)</td>
            {allSpecies.map((s) => {
              const initial = initialConcentrations[s.formula] ?? 0;
              const eq = result.equilibriumConcentrations[s.formula] ?? 0;
              const change = eq - initial;
              return (
                <td key={s.formula} className={`px-3 py-1.5 text-center font-mono ${change < 0 ? "text-red-600" : change > 0 ? "text-green-600" : ""}`}>
                  {change >= 0 ? "+" : ""}{fmt(change)}
                </td>
              );
            })}
          </tr>
          {/* Equilibrium */}
          <tr className="bg-teal-50">
            <td className="py-1.5 pr-4 font-semibold text-teal-700">E (mol/L)</td>
            {allSpecies.map((s) => (
              <td key={s.formula} className="px-3 py-1.5 text-center font-mono font-semibold text-teal-800">
                {fmt(result.equilibriumConcentrations[s.formula] ?? 0)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
