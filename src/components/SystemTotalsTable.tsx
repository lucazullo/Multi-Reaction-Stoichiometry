import type { SubstanceTotals } from "@/lib/types";
import FormulaText from "./FormulaText";

interface SystemTotalsTableProps {
  totals: SubstanceTotals[];
}

function fmt(n: number): string {
  if (n === 0) return "0";
  if (Math.abs(n) >= 0.01 && Math.abs(n) < 1e6) return n.toPrecision(4);
  return n.toExponential(3);
}

const ROLE_STYLES: Record<string, string> = {
  "net-reactant": "bg-blue-50 text-blue-700 border-blue-200",
  "net-product": "bg-green-50 text-green-700 border-green-200",
  intermediate: "bg-gray-100 text-gray-500 border-gray-200",
  excess: "bg-amber-50 text-amber-700 border-amber-200",
  deficit: "bg-red-50 text-red-700 border-red-200",
};

const ROLE_LABELS: Record<string, string> = {
  "net-reactant": "Feedstock",
  "net-product": "Product",
  intermediate: "Intermediate",
  excess: "Excess",
  deficit: "Deficit",
};

export default function SystemTotalsTable({ totals }: SystemTotalsTableProps) {
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th className="pb-3 pr-4">Substance</th>
              <th className="pb-3 pr-4">Net Role</th>
              <th className="pb-3 pr-4">Produced</th>
              <th className="pb-3 pr-4">Consumed</th>
              <th className="pb-3 pr-4">Net (mol)</th>
              <th className="pb-3 pr-4">Net (g)</th>
              <th className="pb-3 pr-4">Net (kg)</th>
              <th className="pb-3">Net (lb)</th>
            </tr>
          </thead>
          <tbody>
            {totals.map((t, i) => (
              <tr
                key={i}
                className={`border-b border-gray-100 ${
                  t.role === "excess" || t.role === "deficit"
                    ? t.role === "excess"
                      ? "bg-amber-50/50"
                      : "bg-red-50/50"
                    : "hover:bg-gray-50"
                }`}
              >
                <td className="py-3 pr-4">
                  <FormulaText formula={t.formula} className="font-semibold" />
                  <span className="ml-1 text-xs text-gray-400">({t.name})</span>
                </td>
                <td className="py-3 pr-4">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium ${ROLE_STYLES[t.role]}`}
                  >
                    {ROLE_LABELS[t.role]}
                  </span>
                </td>
                <td className="py-3 pr-4 font-mono text-green-600">
                  {t.produced > 0 ? fmt(t.produced) : "--"}
                </td>
                <td className="py-3 pr-4 font-mono text-blue-600">
                  {t.consumed > 0 ? fmt(t.consumed) : "--"}
                </td>
                <td className="py-3 pr-4 font-mono">{fmt(t.totalMoles)}</td>
                <td className="py-3 pr-4 font-mono">{fmt(t.totalGrams)}</td>
                <td className="py-3 pr-4 font-mono">{fmt(t.totalKilograms)}</td>
                <td className="py-3 font-mono">{fmt(t.totalPounds)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Notes for excess/deficit */}
      {totals.some((t) => t.note) && (
        <div className="space-y-1">
          {totals
            .filter((t) => t.note)
            .map((t, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
                  t.role === "excess"
                    ? "bg-amber-50 text-amber-800 border border-amber-200"
                    : t.role === "deficit"
                    ? "bg-red-50 text-red-800 border border-red-200"
                    : "bg-gray-50 text-gray-600 border border-gray-200"
                }`}
              >
                <span className="font-semibold flex-shrink-0">
                  {t.role === "excess" ? "\u26A0" : t.role === "deficit" ? "\u274C" : "\u2139\uFE0F"}{" "}
                  <FormulaText formula={t.formula} />:
                </span>
                <span>{t.note}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
