"use client";

import { useState, useRef } from "react";
import type { EquilibriumData } from "@/lib/types";

interface EquilibriumPanelProps {
  equilibrium: EquilibriumData | undefined;
  onChange: (data: EquilibriumData | undefined) => void;
}

export default function EquilibriumPanel({ equilibrium, onChange }: EquilibriumPanelProps) {
  const [enabled, setEnabled] = useState(!!equilibrium);
  // Preserve data when toggling off so it can be restored
  const stashedRef = useRef<EquilibriumData | undefined>(equilibrium);

  // Keep stash in sync when data changes externally (e.g. from lookup)
  if (equilibrium) stashedRef.current = equilibrium;

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    if (!checked) {
      if (equilibrium) stashedRef.current = equilibrium;
      onChange(undefined);
    } else {
      onChange(stashedRef.current ?? { keq: 1, referenceTemperature: 298.15, deltaH: 0 });
    }
  };

  const update = (patch: Partial<EquilibriumData>) => {
    if (!equilibrium) return;
    onChange({ ...equilibrium, ...patch });
  };

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => handleToggle(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-gray-300 accent-teal-600"
        />
        Equilibrium data
      </label>

      {enabled && equilibrium && (
        <>
        <div className="grid grid-cols-3 gap-3 pl-5">
          <div>
            <label className="block text-[10px] text-gray-500 mb-0.5">K<sub>eq</sub></label>
            <input
              type="number"
              step="any"
              value={equilibrium.keq}
              onChange={(e) => update({ keq: Number(e.target.value) })}
              className="w-full rounded border border-gray-300 px-2 py-1 text-xs font-mono"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-0.5">T<sub>ref</sub> (K)</label>
            <input
              type="number"
              step="any"
              value={equilibrium.referenceTemperature}
              onChange={(e) => update({ referenceTemperature: Number(e.target.value) })}
              className="w-full rounded border border-gray-300 px-2 py-1 text-xs font-mono"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-0.5">ΔH (kJ/mol)</label>
            <input
              type="number"
              step="any"
              value={equilibrium.deltaH}
              onChange={(e) => update({ deltaH: Number(e.target.value) })}
              className="w-full rounded border border-gray-300 px-2 py-1 text-xs font-mono"
            />
          </div>
        </div>

          {/* Source attribution (from literature lookup) */}
          {equilibrium.source && (
            <div className="flex items-center gap-2 mt-1 pl-5">
              {equilibrium.confidence && (
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  equilibrium.confidence === "high" ? "bg-green-100 text-green-700" :
                  equilibrium.confidence === "medium" ? "bg-yellow-100 text-yellow-700" :
                  "bg-red-100 text-red-700"
                }`}>
                  {equilibrium.confidence} confidence
                </span>
              )}
              <span className="text-[10px] text-gray-500 italic">{equilibrium.source}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
