import type { CalculationResult } from "@/lib/types";

interface ResultsTableProps {
  results: CalculationResult[];
  selectedIndex: number;
}

function formatNumber(n: number): string {
  if (n === 0) return "0";
  if (Math.abs(n) >= 0.01 && Math.abs(n) < 1e6) {
    return n.toPrecision(4);
  }
  return n.toExponential(3);
}

export default function ResultsTable({
  results,
  selectedIndex,
}: ResultsTableProps) {
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th className="pb-3 pr-4">Substance</th>
              <th className="pb-3 pr-4">Moles</th>
              <th className="pb-3 pr-4">Grams</th>
              <th className="pb-3 pr-4">Kilograms</th>
              <th className="pb-3 pr-4">Pounds</th>
              <th className="pb-3 pr-4">Liters</th>
              <th className="pb-3">Gallons</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr
                key={i}
                className={`border-b border-gray-100 ${
                  i === selectedIndex
                    ? "bg-teal-50 font-medium"
                    : "hover:bg-gray-50"
                }`}
              >
                <td className="py-3 pr-4">
                  <span className="font-semibold">{r.substance.formula}</span>
                  <span className="ml-1 text-xs text-gray-400">
                    ({r.substance.name})
                  </span>
                </td>
                <td className="py-3 pr-4 font-mono">
                  {formatNumber(r.moles)}
                </td>
                <td className="py-3 pr-4 font-mono">
                  {formatNumber(r.grams)}
                </td>
                <td className="py-3 pr-4 font-mono">
                  {formatNumber(r.kilograms)}
                </td>
                <td className="py-3 pr-4 font-mono">
                  {formatNumber(r.pounds)}
                </td>
                <td className="py-3 pr-4 font-mono">
                  {r.liters !== null ? formatNumber(r.liters) : "--"}
                </td>
                <td className="py-3 font-mono">
                  {r.gallons !== null ? formatNumber(r.gallons) : "--"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
