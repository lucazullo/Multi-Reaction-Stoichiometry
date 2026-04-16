"use client";

import type { SelectivityResult } from "@/lib/types";

interface SelectivityDashboardProps {
  results: SelectivityResult[];
}

function pct(v: number): string {
  return (v * 100).toFixed(1) + "%";
}

function fmt(n: number): string {
  if (n === 0) return "0";
  if (Math.abs(n) >= 0.01 && Math.abs(n) < 1e6) return n.toPrecision(4);
  return n.toExponential(3);
}

export default function SelectivityDashboard({ results }: SelectivityDashboardProps) {
  if (results.length === 0) return null;

  return (
    <div className="space-y-4">
      {results.map((result) => (
        <div key={result.competingSetId} className="space-y-3">
          {/* Metrics summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-center">
              <p className="text-[10px] text-green-600 font-medium">Selectivity</p>
              <p className="text-lg font-bold text-green-800">{pct(result.selectivity)}</p>
            </div>
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-center">
              <p className="text-[10px] text-blue-600 font-medium">Yield</p>
              <p className="text-lg font-bold text-blue-800">{pct(result.yield)}</p>
            </div>
            <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 text-center">
              <p className="text-[10px] text-purple-600 font-medium">Atom Economy</p>
              <p className="text-lg font-bold text-purple-800">{pct(result.atomEconomy)}</p>
            </div>
          </div>

          {/* Desired product */}
          <div className="rounded-lg bg-green-50 border border-green-200 p-3">
            <h4 className="text-xs font-semibold text-green-700 mb-1">Desired Product</h4>
            <div className="flex items-center gap-3">
              <span className="text-sm font-mono font-medium text-green-800">{result.desiredProduct.formula}</span>
              <span className="text-xs text-green-600">{result.desiredProduct.name}</span>
              <span className="text-xs font-mono text-green-700">{fmt(result.desiredProduct.moles)} mol</span>
            </div>
          </div>

          {/* Co-products */}
          {result.coProducts.length > 0 && (
            <div className="rounded-lg bg-orange-50 border border-orange-200 p-3">
              <h4 className="text-xs font-semibold text-orange-700 mb-2">Co-products (undesired)</h4>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-orange-200">
                    <th className="py-1 text-left text-orange-600">Formula</th>
                    <th className="py-1 text-left text-orange-600">Name</th>
                    <th className="py-1 text-right text-orange-600">Moles</th>
                    <th className="py-1 text-left text-orange-600 pl-3">Source Reaction</th>
                  </tr>
                </thead>
                <tbody>
                  {result.coProducts.map((cp, i) => (
                    <tr key={i} className="border-b border-orange-100">
                      <td className="py-1 font-mono">{cp.formula}</td>
                      <td className="py-1 text-gray-600">{cp.name}</td>
                      <td className="py-1 text-right font-mono">{fmt(cp.moles)}</td>
                      <td className="py-1 pl-3 text-gray-500 truncate max-w-[200px]">{cp.reactionLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
