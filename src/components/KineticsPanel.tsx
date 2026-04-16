"use client";

import { useState, useRef } from "react";
import type { RateLaw, BalancedReaction } from "@/lib/types";

interface KineticsPanelProps {
  rateLaw: RateLaw | undefined;
  reaction: BalancedReaction;
  onChange: (data: RateLaw | undefined) => void;
}

export default function KineticsPanel({ rateLaw, reaction, onChange }: KineticsPanelProps) {
  const [enabled, setEnabled] = useState(!!rateLaw);
  // Preserve data when toggling off so it can be restored
  const stashedRef = useRef<RateLaw | undefined>(rateLaw);

  // Keep stash in sync when data changes externally (e.g. from lookup)
  if (rateLaw) stashedRef.current = rateLaw;

  const defaultPartialOrders: Record<string, number> = {};
  for (const r of reaction.reactants) {
    defaultPartialOrders[r.formula] = r.coefficient;
  }

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    if (!checked) {
      // Stash current data, then set undefined to disable in calculations
      if (rateLaw) stashedRef.current = rateLaw;
      onChange(undefined);
    } else {
      // Restore stashed data or create defaults
      onChange(stashedRef.current ?? {
        expression: "",
        order: reaction.reactants.reduce((sum, r) => sum + r.coefficient, 0),
        partialOrders: defaultPartialOrders,
        rateConstant: 1,
        rateConstantUnit: "1/s",
        referenceTemperature: 298.15,
        activationEnergy: 50,
        preExponentialFactor: 1e10,
      });
    }
  };

  const update = (patch: Partial<RateLaw>) => {
    if (!rateLaw) return;
    onChange({ ...rateLaw, ...patch });
  };

  const updatePartialOrder = (formula: string, order: number) => {
    if (!rateLaw) return;
    const newOrders = { ...rateLaw.partialOrders, [formula]: order };
    const totalOrder = Object.values(newOrders).reduce((s, v) => s + v, 0);
    onChange({ ...rateLaw, partialOrders: newOrders, order: totalOrder });
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
        Kinetics data
      </label>

      {enabled && rateLaw && (
        <div className="space-y-3 pl-5">
          {/* Rate constant and units */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">k (rate constant)</label>
              <input
                type="number"
                step="any"
                value={rateLaw.rateConstant}
                onChange={(e) => update({ rateConstant: Number(e.target.value) })}
                className="w-full rounded border border-gray-300 px-2 py-1 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Unit</label>
              <input
                type="text"
                value={rateLaw.rateConstantUnit}
                onChange={(e) => update({ rateConstantUnit: e.target.value })}
                className="w-full rounded border border-gray-300 px-2 py-1 text-xs font-mono"
                placeholder="e.g. 1/s, L/(mol·s)"
              />
            </div>
          </div>

          {/* Arrhenius parameters */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">E<sub>a</sub> (kJ/mol)</label>
              <input
                type="number"
                step="any"
                value={rateLaw.activationEnergy}
                onChange={(e) => update({ activationEnergy: Number(e.target.value) })}
                className="w-full rounded border border-gray-300 px-2 py-1 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">A (pre-exp.)</label>
              <input
                type="number"
                step="any"
                value={rateLaw.preExponentialFactor}
                onChange={(e) => update({ preExponentialFactor: Number(e.target.value) })}
                className="w-full rounded border border-gray-300 px-2 py-1 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">T<sub>ref</sub> (K)</label>
              <input
                type="number"
                step="any"
                value={rateLaw.referenceTemperature}
                onChange={(e) => update({ referenceTemperature: Number(e.target.value) })}
                className="w-full rounded border border-gray-300 px-2 py-1 text-xs font-mono"
              />
            </div>
          </div>

          {/* Partial orders */}
          <div>
            <label className="block text-[10px] text-gray-500 mb-1">Partial orders</label>
            <div className="flex flex-wrap gap-2">
              {reaction.reactants.map((r) => (
                <div key={r.formula} className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-600">[{r.formula}]</span>
                  <input
                    type="number"
                    step="0.1"
                    value={rateLaw.partialOrders[r.formula] ?? 0}
                    onChange={(e) => updatePartialOrder(r.formula, Number(e.target.value))}
                    className="w-14 rounded border border-gray-300 px-1.5 py-0.5 text-[10px] font-mono"
                  />
                </div>
              ))}
              <span className="text-[10px] text-gray-400 self-center">Overall: {rateLaw.order}</span>
            </div>
          </div>

          {/* Expression (display) */}
          <div>
            <label className="block text-[10px] text-gray-500 mb-0.5">Rate expression (display)</label>
            <input
              type="text"
              value={rateLaw.expression}
              onChange={(e) => update({ expression: e.target.value })}
              className="w-full rounded border border-gray-300 px-2 py-1 text-xs font-mono"
              placeholder="e.g. k[A]²[B]"
            />
          </div>

          {/* Source attribution (from literature lookup) */}
          {rateLaw.source && (
            <div className="flex items-center gap-2 mt-1">
              {rateLaw.confidence && (
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  rateLaw.confidence === "high" ? "bg-green-100 text-green-700" :
                  rateLaw.confidence === "medium" ? "bg-yellow-100 text-yellow-700" :
                  "bg-red-100 text-red-700"
                }`}>
                  {rateLaw.confidence} confidence
                </span>
              )}
              <span className="text-[10px] text-gray-500 italic">{rateLaw.source}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
