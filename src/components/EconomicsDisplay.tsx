import type { EconomicsSummary } from "@/lib/types";

interface EconomicsDisplayProps {
  economics: EconomicsSummary;
}

function fmt(n: number): string {
  if (n === 0) return "$0.00";
  return "$" + n.toFixed(2);
}

export default function EconomicsDisplay({
  economics,
}: EconomicsDisplayProps) {
  const { perSubstance, reactantCost, productValue, delta } = economics;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th className="pb-3 pr-4">Substance</th>
              <th className="pb-3 pr-4">Role</th>
              <th className="pb-3 pr-4">Price/Unit</th>
              <th className="pb-3">Total Cost/Price</th>
            </tr>
          </thead>
          <tbody>
            {perSubstance.map((e, i) => (
              <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-2 pr-4">
                  <span className="font-semibold">{e.substance.formula}</span>
                  <span className="ml-1 text-xs text-gray-400">
                    ({e.substance.name})
                  </span>
                </td>
                <td className="py-2 pr-4">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      e.role === "reactant"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-green-50 text-green-700"
                    }`}
                  >
                    {e.role}
                  </span>
                </td>
                <td className="py-2 pr-4 font-mono text-sm">
                  {e.pricePerUnit !== null
                    ? `$${e.pricePerUnit}/${e.priceUnit}`
                    : "--"}
                </td>
                <td className="py-2 font-mono text-sm">{fmt(e.totalCost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Total Reactant Cost:</span>
          <span className="font-mono font-medium text-blue-700">
            {fmt(reactantCost)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Total Product Value:</span>
          <span className="font-mono font-medium text-green-700">
            {fmt(productValue)}
          </span>
        </div>
        <div className="border-t border-gray-300 pt-2 flex justify-between text-sm font-semibold">
          <span className="text-gray-800">Net Delta:</span>
          <span
            className={`font-mono ${
              delta >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {delta >= 0 ? "+" : ""}
            {fmt(delta)}
          </span>
        </div>
      </div>
    </div>
  );
}
