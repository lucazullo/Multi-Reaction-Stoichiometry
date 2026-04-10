"use client";

import { useRef } from "react";
import type { ReactionNode, SubstanceTotals } from "@/lib/types";

interface SystemEquationSummaryProps {
  totals: SubstanceTotals[];
  nodes: ReactionNode[];
}

/**
 * Compute stoichiometric ratios: divide all moles by the smallest non-zero value,
 * then round to integers if within 2% tolerance.
 */
function computeRatios(substances: SubstanceTotals[]): Map<string, string> {
  const ratios = new Map<string, string>();
  const nonZero = substances.filter((s) => s.totalMoles > 1e-10);
  if (nonZero.length === 0) return ratios;

  const minMoles = Math.min(...nonZero.map((s) => s.totalMoles));

  for (const s of nonZero) {
    const raw = s.totalMoles / minMoles;
    const rounded = Math.round(raw);
    // If within 2% of an integer, use the integer
    const coeff =
      Math.abs(raw - rounded) / raw < 0.02
        ? rounded
        : parseFloat(raw.toFixed(1));
    ratios.set(s.formula, coeff === 1 ? "" : String(coeff));
  }

  return ratios;
}

function buildEquationSide(
  substances: SubstanceTotals[],
  ratios: Map<string, string>
): string {
  return substances
    .filter((s) => s.totalMoles > 1e-10)
    .map((s) => {
      const coeff = ratios.get(s.formula) ?? "";
      return `${coeff}${s.formula}`;
    })
    .join(" + ");
}

export default function SystemEquationSummary({
  totals,
  nodes,
}: SystemEquationSummaryProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const reactants = totals.filter(
    (t) => t.role === "net-reactant" || t.role === "deficit"
  );
  const products = totals.filter((t) => t.role === "net-product");
  const excess = totals.filter((t) => t.role === "excess");
  const intermediates = totals.filter((t) => t.role === "intermediate");

  const allForRatio = [...reactants, ...products, ...excess];
  const ratios = computeRatios(allForRatio);

  const leftSide = buildEquationSide(reactants, ratios);
  const rightSide = buildEquationSide(products, ratios);
  const excessSide = buildEquationSide(excess, ratios);

  const handleDownloadPNG = async () => {
    if (!panelRef.current) return;
    try {
      // Dynamic import to avoid SSR issues
      const html2canvasModule = await import("html2canvas");
      const html2canvas = html2canvasModule.default ?? html2canvasModule;
      const canvas = await html2canvas(panelRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });
      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "reaction-system-summary.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error("PNG export error:", err);
      alert("Failed to export PNG. Please try again.");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">
          System Summary
        </h2>
        <button
          onClick={handleDownloadPNG}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
            />
          </svg>
          Download PNG
        </button>
      </div>

      <div
        ref={panelRef}
        className="rounded-xl border border-gray-200 bg-white p-6 space-y-5"
      >
        {/* Overall Equation */}
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
            Overall System Equation
          </p>
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 text-center">
            <p className="font-mono text-xl tracking-wide text-gray-800">
              {leftSide}
              <span className="mx-3 text-gray-400">{"\u2192"}</span>
              {rightSide}
            </p>
          </div>
        </div>

        {/* Excess */}
        {excess.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              Excess
            </span>
            <span className="font-mono text-sm text-amber-700">
              {excess
                .map((e) => {
                  const coeff = ratios.get(e.formula) ?? "";
                  return `${coeff}${e.formula}`;
                })
                .join(", ")}
            </span>
          </div>
        )}

        {/* Intermediates */}
        {intermediates.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
              Intermediates
            </span>
            <span className="text-sm text-gray-500">
              {intermediates.map((i) => i.formula).join(", ")}
              <span className="ml-1 text-xs text-gray-400">
                (produced and fully consumed internally)
              </span>
            </span>
          </div>
        )}

        {/* Individual Reactions */}
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
            Individual Reactions
          </p>
          <div className="space-y-1">
            {nodes.map((node, i) => (
              <div key={node.id} className="flex items-start gap-2 text-sm">
                <span className="flex-shrink-0 w-6 text-right text-xs font-medium text-gray-400">
                  {i + 1}.
                </span>
                <span className="font-mono text-gray-700">
                  {node.reaction.equation}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
