"use client";

import type { BalancedReaction, CalculationResult } from "@/lib/types";

interface InitialConcentrationsProps {
  reaction: BalancedReaction;
  /** Stoichiometric results from system calculation (used for defaults) */
  stoichResults: CalculationResult[] | undefined;
  volume: number; // L
  /** Current editable values: formula → mol/L */
  values: Record<string, number>;
  onChange: (values: Record<string, number>) => void;
}

/**
 * Derive default initial concentrations from stoichiometric results:
 * - Reactants: stoichiometric moles / volume
 * - Products: 0 (haven't reacted yet)
 */
export function deriveDefaults(
  reaction: BalancedReaction,
  stoichResults: CalculationResult[] | undefined,
  volume: number
): Record<string, number> {
  const defaults: Record<string, number> = {};

  for (const r of reaction.reactants) {
    const result = stoichResults?.find(
      (res) => res.substance.formula === r.formula && res.substance.role === "reactant"
    );
    defaults[r.formula] = result ? result.moles / volume : 0;
  }

  for (const p of reaction.products) {
    defaults[p.formula] = 0; // products start at zero
  }

  return defaults;
}

export default function InitialConcentrations({
  reaction,
  values,
  onChange,
}: InitialConcentrationsProps) {
  const allSpecies = [
    ...reaction.reactants.map((s) => ({ ...s, isReactant: true })),
    ...reaction.products.map((s) => ({ ...s, isReactant: false })),
  ];

  const handleChange = (formula: string, value: number) => {
    onChange({ ...values, [formula]: Math.max(0, value) });
  };

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-gray-600">Initial concentrations (mol/L)</label>
      <div className="flex flex-wrap gap-3">
        {allSpecies.map((s) => (
          <div key={s.formula} className="flex items-center gap-1.5">
            <span className={`text-xs font-mono ${s.isReactant ? "text-gray-700" : "text-gray-400"}`}>
              [{s.formula}]₀
            </span>
            <input
              type="number"
              step="any"
              min={0}
              value={values[s.formula] ?? 0}
              onChange={(e) => handleChange(s.formula, Number(e.target.value))}
              className="w-20 rounded border border-gray-300 px-1.5 py-0.5 text-xs font-mono"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
