"use client";

import { useState, useMemo, useCallback } from "react";
import type { BalancedReaction, Substance } from "@/lib/types";
import { checkReactionBalance, computeMolarMass } from "@/lib/utils";
import {
  calcDegreesOfFreedom,
  solveCoefficients,
} from "@/lib/balance-solver";

interface StoichiometryEditorProps {
  reaction: BalancedReaction;
  onSave: (reaction: BalancedReaction) => void;
  onCancel: () => void;
}

type EditorMode = "formulas" | "coefficients";

interface EditRow {
  coefficient: string;
  formula: string;
  name: string;
  locked: boolean;
}

function buildEquation(reactants: Substance[], products: Substance[]): string {
  const fmt = (s: Substance) =>
    s.coefficient === 1 ? s.formula : `${s.coefficient}${s.formula}`;
  return (
    reactants.map(fmt).join(" + ") + " \u2192 " + products.map(fmt).join(" + ")
  );
}

function fmtCoeff(n: number): string {
  if (Number.isInteger(n)) return String(n);
  // Show up to 4 decimal places, strip trailing zeros
  return n.toFixed(4).replace(/\.?0+$/, "");
}

export default function StoichiometryEditor({
  reaction,
  onSave,
  onCancel,
}: StoichiometryEditorProps) {
  const [mode, setMode] = useState<EditorMode>("coefficients");

  const initRows = useCallback(
    (substances: Substance[]): EditRow[] =>
      substances.map((s) => ({
        coefficient: String(s.coefficient),
        formula: s.formula,
        name: s.name,
        locked: false,
      })),
    []
  );

  const [editReactants, setEditReactants] = useState<EditRow[]>(() =>
    initRows(reaction.reactants)
  );
  const [editProducts, setEditProducts] = useState<EditRow[]>(() =>
    initRows(reaction.products)
  );
  const [solverError, setSolverError] = useState<string | null>(null);

  const allRows = useMemo(
    () => [...editReactants, ...editProducts],
    [editReactants, editProducts]
  );

  // Live balance check
  const liveBalance = useMemo(() => {
    const toSubs = (rows: EditRow[]) =>
      rows.map((r) => ({
        formula: r.formula,
        coefficient: parseFloat(r.coefficient) || 0,
      }));
    return checkReactionBalance(toSubs(editReactants), toSubs(editProducts));
  }, [editReactants, editProducts]);

  // Degrees of freedom for coefficient mode
  const dof = useMemo(() => {
    const substances = allRows.map((r) => ({ formula: r.formula }));
    const lockedCount = allRows.filter((r) => r.locked).length;
    return calcDegreesOfFreedom(substances, lockedCount);
  }, [allRows]);

  // Build live equation preview
  const previewEquation = useMemo(() => {
    const fmtSide = (rows: EditRow[]) =>
      rows
        .map((r) => {
          const c = parseFloat(r.coefficient) || 1;
          return c === 1 ? r.formula : `${fmtCoeff(c)}${r.formula}`;
        })
        .join(" + ");
    return fmtSide(editReactants) + " \u2192 " + fmtSide(editProducts);
  }, [editReactants, editProducts]);

  const updateRow = (
    side: "reactants" | "products",
    idx: number,
    field: keyof EditRow,
    value: string | boolean
  ) => {
    const setter = side === "reactants" ? setEditReactants : setEditProducts;
    setter((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r))
    );
    setSolverError(null);
  };

  const handleAutoBalance = () => {
    setSolverError(null);

    const nReactants = editReactants.length;
    const substances = [
      ...editReactants.map((r) => ({ formula: r.formula, isProduct: false })),
      ...editProducts.map((r) => ({ formula: r.formula, isProduct: true })),
    ];

    const locked = new Map<number, number>();
    allRows.forEach((r, i) => {
      if (r.locked) {
        locked.set(i, parseFloat(r.coefficient) || 1);
      }
    });

    const result = solveCoefficients({ substances, locked });

    if (!result.success) {
      setSolverError(result.error ?? "Could not solve.");
      return;
    }

    // Apply solved coefficients
    setEditReactants((prev) =>
      prev.map((r, i) => ({
        ...r,
        coefficient: fmtCoeff(result.coefficients[i]),
      }))
    );
    setEditProducts((prev) =>
      prev.map((r, i) => ({
        ...r,
        coefficient: fmtCoeff(result.coefficients[nReactants + i]),
      }))
    );
  };

  const handleSave = () => {
    const updatedReactants: Substance[] = reaction.reactants.map((s, i) => {
      const row = editReactants[i];
      const newFormula = row.formula.trim() || s.formula;
      const newCoeff = parseFloat(row.coefficient) || s.coefficient;
      const mw = computeMolarMass(newFormula);
      return {
        ...s,
        formula: newFormula,
        name: row.name.trim() || s.name,
        coefficient: newCoeff,
        molarMass: mw ?? s.molarMass,
      };
    });

    const updatedProducts: Substance[] = reaction.products.map((s, i) => {
      const row = editProducts[i];
      const newFormula = row.formula.trim() || s.formula;
      const newCoeff = parseFloat(row.coefficient) || s.coefficient;
      const mw = computeMolarMass(newFormula);
      return {
        ...s,
        formula: newFormula,
        name: row.name.trim() || s.name,
        coefficient: newCoeff,
        molarMass: mw ?? s.molarMass,
      };
    });

    onSave({
      ...reaction,
      reactants: updatedReactants,
      products: updatedProducts,
      equation: buildEquation(updatedReactants, updatedProducts),
    });
  };

  const renderSubstanceRow = (
    row: EditRow,
    idx: number,
    side: "reactants" | "products",
    color: string
  ) => {
    const isCoeffMode = mode === "coefficients";
    const mw = computeMolarMass(row.formula);

    return (
      <div key={idx} className="flex items-center gap-2">
        {/* Lock toggle (coefficient mode only) */}
        {isCoeffMode && (
          <button
            onClick={() => updateRow(side, idx, "locked", !row.locked)}
            className={`flex-shrink-0 w-6 h-6 rounded border text-xs font-bold flex items-center justify-center transition ${
              row.locked
                ? "bg-amber-100 border-amber-400 text-amber-700"
                : "bg-gray-50 border-gray-300 text-gray-400 hover:border-gray-400"
            }`}
            title={row.locked ? "Unlock coefficient" : "Lock coefficient (user-specified)"}
          >
            {row.locked ? "\uD83D\uDD12" : "\uD83D\uDD13"}
          </button>
        )}

        {/* Coefficient */}
        <input
          type="number"
          value={row.coefficient}
          onChange={(e) => updateRow(side, idx, "coefficient", e.target.value)}
          className={`w-16 rounded-lg border px-2 py-1.5 text-sm text-center font-mono focus:outline-none ${
            isCoeffMode && !row.locked
              ? "border-gray-200 bg-gray-50 text-gray-400"
              : `border-gray-300 focus:border-${color}-500 focus:ring-1 focus:ring-${color}-500`
          }`}
          min="0"
          step="any"
          title="Coefficient"
          readOnly={isCoeffMode && !row.locked}
        />

        {/* Formula */}
        <input
          type="text"
          value={row.formula}
          onChange={(e) => updateRow(side, idx, "formula", e.target.value)}
          className={`w-40 rounded-lg border px-2 py-1.5 text-sm font-mono focus:outline-none ${
            isCoeffMode
              ? "border-gray-200 bg-gray-50 text-gray-500"
              : `border-gray-300 focus:border-${color}-500 focus:ring-1 focus:ring-${color}-500`
          }`}
          title="Formula"
          readOnly={isCoeffMode}
        />

        {/* Name */}
        <input
          type="text"
          value={row.name}
          onChange={(e) => updateRow(side, idx, "name", e.target.value)}
          className={`flex-1 rounded-lg border px-2 py-1.5 text-sm text-gray-600 focus:outline-none ${
            isCoeffMode
              ? "border-gray-200 bg-gray-50"
              : `border-gray-300 focus:border-${color}-500 focus:ring-1 focus:ring-${color}-500`
          }`}
          title="Name"
          readOnly={isCoeffMode}
        />

        {/* Molar mass */}
        <span className="text-xs text-gray-400 w-20 text-right flex-shrink-0">
          {mw?.toFixed(2) ?? "?"} g/mol
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Mode tabs */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
        {(
          [
            ["coefficients", "Balance Coefficients"],
            ["formulas", "Edit Formulas"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => { setMode(key); setSolverError(null); }}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              mode === key
                ? "bg-white text-gray-800 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Mode description */}
      <p className="text-xs text-gray-500">
        {mode === "coefficients"
          ? "Lock the coefficients you know, then auto-balance the rest. Formulas are read-only in this mode."
          : "Edit chemical formulas, names, and coefficients directly."}
      </p>

      {/* Live equation preview */}
      <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-center">
        <p className="font-mono text-lg text-gray-700">{previewEquation}</p>
      </div>

      {/* Live balance indicator */}
      <div
        className={`rounded-lg p-2 text-xs text-center font-medium ${
          liveBalance.balanced
            ? "bg-green-50 border border-green-200 text-green-700"
            : "bg-amber-50 border border-amber-200 text-amber-700"
        }`}
      >
        {liveBalance.balanced
          ? "\u2713 Balanced"
          : liveBalance.imbalances.map((im) => (
              <span key={im.atom} className="inline-block mr-3">
                <span className="font-mono font-semibold">{im.atom}</span>:{" "}
                {im.left} {"\u2192"} {im.right} ({im.delta > 0 ? "+" : ""}
                {im.delta})
              </span>
            ))}
      </div>

      {/* Coefficient mode: degrees of freedom & auto-balance */}
      {mode === "coefficients" && (
        <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              <span className="font-medium">{dof.lockedCount}</span> of{" "}
              <span className="font-medium">{dof.totalSubstances}</span>{" "}
              coefficients locked
              {" \u2022 "}
              <span className="font-medium">{dof.atomCount}</span> atom types
              {" \u2022 "}
              <span className="font-medium">{dof.freeUnknowns}</span> unknowns
            </div>
            <button
              onClick={handleAutoBalance}
              disabled={!dof.canSolve}
              className={`rounded-lg px-4 py-1.5 text-xs font-medium transition ${
                dof.canSolve
                  ? "bg-teal-600 text-white hover:bg-teal-700"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              Auto-balance
            </button>
          </div>
          {dof.needToLock > 0 && (
            <p className="text-xs text-amber-600">
              Lock {dof.needToLock} more coefficient{dof.needToLock > 1 ? "s" : ""} to enable auto-balance.
            </p>
          )}
          {dof.canSolve && dof.freeUnknowns > 0 && !solverError && (
            <p className="text-xs text-teal-600">
              Ready to solve {dof.freeUnknowns} unknown{dof.freeUnknowns > 1 ? "s" : ""} from {dof.atomCount} atom balance equation{dof.atomCount > 1 ? "s" : ""}.
            </p>
          )}
          {solverError && (
            <p className="text-xs text-red-600">{solverError}</p>
          )}
        </div>
      )}

      {/* Reactants */}
      <div>
        <p className="text-xs font-medium text-blue-600 mb-2">Reactants</p>
        <div className="space-y-2">
          {editReactants.map((row, i) =>
            renderSubstanceRow(row, i, "reactants", "blue")
          )}
        </div>
      </div>

      {/* Arrow */}
      <div className="text-center text-gray-400 text-lg">{"\u2192"}</div>

      {/* Products */}
      <div>
        <p className="text-xs font-medium text-green-600 mb-2">Products</p>
        <div className="space-y-2">
          {editProducts.map((row, i) =>
            renderSubstanceRow(row, i, "products", "green")
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-2">
        <button
          onClick={handleSave}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          Save Changes
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
