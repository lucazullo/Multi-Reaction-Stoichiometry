import type { BalanceCheck } from "@/lib/types";

interface BalanceCheckDisplayProps {
  balanceCheck: BalanceCheck;
}

function fmt(n: number): string {
  if (n === 0) return "0";
  if (Math.abs(n) >= 0.01 && Math.abs(n) < 1e6) return n.toPrecision(4);
  return n.toExponential(3);
}

function fmtMass(grams: number): { value: string; unit: string } {
  if (grams >= 1e6) return { value: (grams / 1e6).toPrecision(4), unit: "tonnes" };
  if (grams >= 1e3) return { value: (grams / 1e3).toPrecision(4), unit: "kg" };
  return { value: grams.toPrecision(4), unit: "g" };
}

export default function BalanceCheckDisplay({ balanceCheck }: BalanceCheckDisplayProps) {
  const { atoms, mass, allBalanced } = balanceCheck;

  return (
    <div className="space-y-4">
      {/* Overall status banner */}
      <div
        className={`rounded-lg p-3 flex items-center gap-2 ${
          allBalanced
            ? "bg-green-50 border border-green-200"
            : "bg-red-50 border border-red-200"
        }`}
      >
        <span className="text-lg">{allBalanced ? "\u2705" : "\u26A0\uFE0F"}</span>
        <span className={`text-sm font-semibold ${allBalanced ? "text-green-700" : "text-red-700"}`}>
          {allBalanced
            ? "Mass and atom balances close within tolerance"
            : "Balance discrepancy detected — check reactions and links"}
        </span>
      </div>

      {/* Mass balance summary */}
      <div>
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Mass Balance</h4>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-center">
            <p className="text-xs text-blue-500">Total Mass In</p>
            <p className="font-mono font-semibold text-blue-700">
              {fmtMass(mass.totalMassIn).value} {fmtMass(mass.totalMassIn).unit}
            </p>
          </div>
          <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-center">
            <p className="text-xs text-green-500">Total Mass Out</p>
            <p className="font-mono font-semibold text-green-700">
              {fmtMass(mass.totalMassOut).value} {fmtMass(mass.totalMassOut).unit}
            </p>
          </div>
          <div className={`rounded-lg p-3 text-center ${
            mass.balanced
              ? "bg-gray-50 border border-gray-200"
              : "bg-red-50 border border-red-200"
          }`}>
            <p className="text-xs text-gray-500">Delta</p>
            <p className={`font-mono font-semibold ${mass.balanced ? "text-gray-600" : "text-red-600"}`}>
              {mass.delta >= 0 ? "+" : ""}{fmtMass(Math.abs(mass.delta)).value} {fmtMass(Math.abs(mass.delta)).unit}
              <span className="text-xs ml-1">({mass.deltaPercent >= 0 ? "+" : ""}{mass.deltaPercent.toFixed(4)}%)</span>
            </p>
          </div>
        </div>
      </div>

      {/* Atom balance table */}
      <div>
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Atom Balance</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="pb-2 pr-4">Atom</th>
                <th className="pb-2 pr-4">In (mol-atoms)</th>
                <th className="pb-2 pr-4">Out (mol-atoms)</th>
                <th className="pb-2 pr-4">Delta</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {atoms.map((a) => (
                <tr key={a.atom} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-1.5 pr-4 font-semibold text-gray-700">{a.atom}</td>
                  <td className="py-1.5 pr-4 font-mono text-blue-600">{fmt(a.consumed)}</td>
                  <td className="py-1.5 pr-4 font-mono text-green-600">{fmt(a.produced)}</td>
                  <td className={`py-1.5 pr-4 font-mono ${a.balanced ? "text-gray-400" : "text-red-600 font-semibold"}`}>
                    {a.delta >= 0 ? "+" : ""}{fmt(a.delta)}
                  </td>
                  <td className="py-1.5">
                    {a.balanced ? (
                      <span className="text-green-600 text-xs">{"\u2713"} OK</span>
                    ) : (
                      <span className="text-red-600 text-xs font-semibold">{"\u2717"} Imbalance</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
