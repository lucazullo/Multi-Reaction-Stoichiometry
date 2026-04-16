"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { KineticsResult, BalancedReaction } from "@/lib/types";

interface ConcentrationChartProps {
  result: KineticsResult;
  reaction: BalancedReaction;
}

// Distinct colors for up to 10 species
const COLORS = [
  "#0d9488", // teal-600
  "#dc2626", // red-600
  "#2563eb", // blue-600
  "#d97706", // amber-600
  "#7c3aed", // violet-600
  "#059669", // emerald-600
  "#db2777", // pink-600
  "#4f46e5", // indigo-600
  "#ca8a04", // yellow-600
  "#0891b2", // cyan-600
];

function formatTime(seconds: number): string {
  if (seconds < 1) return `${(seconds * 1000).toPrecision(3)} ms`;
  if (seconds < 60) return `${seconds.toPrecision(3)} s`;
  if (seconds < 3600) return `${(seconds / 60).toPrecision(3)} min`;
  return `${(seconds / 3600).toPrecision(3)} h`;
}

export default function ConcentrationChart({ result, reaction }: ConcentrationChartProps) {
  const allSpecies = [
    ...reaction.reactants.map((r) => r.formula),
    ...reaction.products.map((p) => p.formula),
  ];

  // Build data array for Recharts: [{time, formula1, formula2, ...}, ...]
  // Sample every Nth point to keep chart responsive
  const maxPoints = 100;
  const step = Math.max(1, Math.floor(result.timePoints.length / maxPoints));

  const data = [];
  for (let i = 0; i < result.timePoints.length; i += step) {
    const point: Record<string, number> = { time: result.timePoints[i] };
    for (const formula of allSpecies) {
      point[formula] = result.concentrations[formula]?.[i] ?? 0;
    }
    data.push(point);
  }

  // Ensure last point is included
  const lastIdx = result.timePoints.length - 1;
  if (data.length === 0 || data[data.length - 1].time !== result.timePoints[lastIdx]) {
    const point: Record<string, number> = { time: result.timePoints[lastIdx] };
    for (const formula of allSpecies) {
      point[formula] = result.concentrations[formula]?.[lastIdx] ?? 0;
    }
    data.push(point);
  }

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="time"
            tickFormatter={formatTime}
            label={{ value: "Time", position: "insideBottomRight", offset: -5, fontSize: 11 }}
            tick={{ fontSize: 10 }}
          />
          <YAxis
            label={{ value: "Concentration (mol/L)", angle: -90, position: "insideLeft", offset: 0, fontSize: 11 }}
            tick={{ fontSize: 10 }}
            tickFormatter={(v: number) => v.toPrecision(3)}
          />
          <Tooltip
            formatter={(value, name) => [Number(value).toPrecision(4) + " mol/L", String(name)]}
            labelFormatter={(label) => `t = ${formatTime(Number(label))}`}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {allSpecies.map((formula, i) => (
            <Line
              key={formula}
              type="monotone"
              dataKey={formula}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={false}
              name={formula}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Warning if no reaction is happening */}
      {result.rateAtT < 1e-15 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-xs text-amber-800">
          <strong>No measurable reaction.</strong> The initial rate is effectively zero.
          <details className="mt-1">
            <summary className="cursor-pointer font-medium">Diagnostics</summary>
            <ul className="mt-1 ml-4 list-disc space-y-0.5">
              <li>k(T) = {result.rateConstantAtT.toExponential(3)}</li>
              <li>Initial concentrations: {allSpecies.map(f => `[${f}]₀ = ${(result.concentrations[f]?.[0] ?? 0).toExponential(3)}`).join(", ")}</li>
              <li>Check: initial concentrations are non-zero for all species in the rate law</li>
              <li>Check: rate constant k and activation energy are correct for this reaction</li>
              <li>Check: integration time is long enough</li>
            </ul>
          </details>
        </div>
      )}

      {/* Summary stats */}
      <div className="flex flex-wrap gap-4 text-xs">
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <span className="text-gray-500">k<sub>fwd</sub>(T) = </span>
          <span className="font-mono font-medium">{result.rateConstantAtT.toExponential(3)}</span>
        </div>
        {result.reversible && result.kReverseAtT !== null && (
          <div className="rounded-lg bg-blue-50 px-3 py-2">
            <span className="text-blue-500">k<sub>rev</sub>(T) = </span>
            <span className="font-mono font-medium text-blue-700">{result.kReverseAtT.toExponential(3)}</span>
          </div>
        )}
        {result.reversible && result.keqAtT !== null && (
          <div className="rounded-lg bg-blue-50 px-3 py-2">
            <span className="text-blue-500">K<sub>eq</sub>(T) = </span>
            <span className="font-mono font-medium text-blue-700">{result.keqAtT.toExponential(3)}</span>
          </div>
        )}
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <span className="text-gray-500">Initial rate = </span>
          <span className="font-mono font-medium">{result.rateAtT.toExponential(3)} mol/(L·s)</span>
        </div>
        {result.halfLife !== null && (
          <div className="rounded-lg bg-gray-50 px-3 py-2">
            <span className="text-gray-500">t<sub>½</sub> = </span>
            <span className="font-mono font-medium">{formatTime(result.halfLife)}</span>
          </div>
        )}
        <div className={`rounded-lg px-3 py-2 ${result.reversible ? "bg-blue-50" : "bg-gray-50"}`}>
          <span className={result.reversible ? "text-blue-600 font-medium" : "text-gray-400"}>
            {result.reversible ? "⇌ Reversible (equilibrium-constrained)" : "→ Irreversible"}
          </span>
        </div>
      </div>
    </div>
  );
}
