import type { SystemEconomics } from "@/lib/types";
import FormulaText from "./FormulaText";

interface SystemEconomicsDisplayProps {
  economics: SystemEconomics;
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

export default function SystemEconomicsDisplay({
  economics,
}: SystemEconomicsDisplayProps) {
  const { perSubstance, feedstockCost, productValue, delta } = economics;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th className="pb-3 pr-4">Substance</th>
              <th className="pb-3 pr-4">Role</th>
              <th className="pb-3 pr-4">Net Quantity</th>
              <th className="pb-3 pr-4">Price/Unit</th>
              <th className="pb-3">Total Cost/Price</th>
            </tr>
          </thead>
          <tbody>
            {perSubstance.map((e, i) => (
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
                <td className="py-2 pr-4 font-mono text-sm">
                  {e.quantityKg.toPrecision(4)} kg
                </td>
                <td className="py-2 pr-4 font-mono text-sm">
                  {e.pricePerUnit !== null
                    ? `$${e.pricePerUnit}/${e.priceUnit}`
                    : "--"}
                </td>
                <td className={`py-2 font-mono text-sm ${
                  e.role === "net-reactant" ? "text-blue-700" : "text-green-700"
                }`}>
                  {e.totalValue > 0 ? fmt(e.totalValue) : "--"}
                </td>
              </tr>
            ))}
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
