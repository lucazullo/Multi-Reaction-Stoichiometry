"use client";

import { useRef } from "react";
import type { ReactionNode, SubstanceTotals } from "@/lib/types";

interface SystemEquationSummaryProps {
  totals: SubstanceTotals[];
  nodes: ReactionNode[];
}

/**
 * Format a coefficient for display.
 * Returns "" for 1, "2" for 2, "1.5" for 1.5, "2/3" for ~0.667, etc.
 */
function formatCoeff(n: number): string {
  if (Math.abs(n - 1) < 0.001) return "";

  // Check common fractions
  const fractions: [number, string][] = [
    [0.5, "\u00BD"], [1/3, "\u2153"], [2/3, "\u2154"],
    [0.25, "\u00BC"], [0.75, "\u00BE"],
    [1.5, "3/2"], [2.5, "5/2"], [3.5, "7/2"],
  ];
  for (const [val, sym] of fractions) {
    if (Math.abs(n - val) < 0.001) return sym;
  }

  // Check if close to integer
  const rounded = Math.round(n);
  if (Math.abs(n - rounded) / n < 0.01) return String(rounded);

  // Otherwise show 2 decimal places, trimmed
  return parseFloat(n.toFixed(2)).toString();
}

/**
 * Build the overall system equation directly from the system totals.
 * Uses actual moles (which are already mass-balanced from the calculation engine)
 * and normalizes to the smallest coefficient.
 */
function buildOverallEquation(totals: SubstanceTotals[]): {
  left: string;
  right: string;
  excessStr: string;
} {
  const reactants = totals.filter(
    (t) => (t.role === "net-reactant" || t.role === "deficit") && t.totalMoles > 1e-10
  );
  const products = totals.filter(
    (t) => t.role === "net-product" && t.totalMoles > 1e-10
  );
  const excess = totals.filter(
    (t) => t.role === "excess" && t.totalMoles > 1e-10
  );

  // Collect all non-zero substances with their moles
  const allSubstances = [
    ...reactants.map((r) => ({ formula: r.formula, moles: r.totalMoles })),
    ...products.map((p) => ({ formula: p.formula, moles: p.totalMoles })),
    ...excess.map((e) => ({ formula: e.formula, moles: e.totalMoles })),
  ];

  if (allSubstances.length === 0) {
    return { left: "", right: "", excessStr: "" };
  }

  // Find smallest mole value to normalize
  const minMoles = Math.min(...allSubstances.map((s) => s.moles));

  // Build coefficient map
  const coeffMap = new Map<string, number>();
  for (const s of allSubstances) {
    coeffMap.set(s.formula, s.moles / minMoles);
  }

  const formatSide = (substances: SubstanceTotals[]) =>
    substances
      .filter((s) => s.totalMoles > 1e-10)
      .map((s) => {
        const coeff = coeffMap.get(s.formula) ?? 1;
        const coeffStr = formatCoeff(coeff);
        return `${coeffStr}${s.formula}`;
      })
      .join(" + ");

  return {
    left: formatSide(reactants),
    right: formatSide(products),
    excessStr: formatSide(excess),
  };
}

export default function SystemEquationSummary({
  totals,
  nodes,
}: SystemEquationSummaryProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const intermediates = totals.filter((t) => t.role === "intermediate");
  const excess = totals.filter((t) => t.role === "excess" && t.totalMoles > 1e-10);

  const { left, right, excessStr } = buildOverallEquation(totals);

  const handleDownloadPNG = () => {
    const padding = 40;
    const lines: Array<{ text: string; size: number; font: string; color: string; bold?: boolean }> = [];

    lines.push({ text: "Overall System Equation", size: 20, font: "sans-serif", color: "#1f2937", bold: true });
    lines.push({ text: "", size: 8, font: "sans-serif", color: "" });

    const eqText = right
      ? `${left}  \u2192  ${right}`
      : left;
    lines.push({ text: eqText, size: 22, font: "monospace", color: "#1f2937" });
    lines.push({ text: "", size: 12, font: "sans-serif", color: "" });

    if (excessStr) {
      lines.push({ text: `Excess:  ${excessStr}`, size: 14, font: "sans-serif", color: "#b45309" });
    }

    if (intermediates.length > 0) {
      lines.push({ text: `Intermediates (cancelled):  ${intermediates.map((i) => i.formula).join(", ")}`, size: 14, font: "sans-serif", color: "#6b7280" });
    }

    lines.push({ text: "", size: 16, font: "sans-serif", color: "" });
    lines.push({ text: "Individual Reactions", size: 16, font: "sans-serif", color: "#1f2937", bold: true });
    lines.push({ text: "", size: 4, font: "sans-serif", color: "" });

    nodes.forEach((node, i) => {
      lines.push({ text: `${i + 1}.  ${node.reaction.equation}`, size: 16, font: "monospace", color: "#374151" });
    });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;

    let maxWidth = 0;
    let totalHeight = padding * 2;
    for (const line of lines) {
      ctx.font = `${line.bold ? "bold " : ""}${line.size}px ${line.font}`;
      const w = ctx.measureText(line.text).width;
      if (w > maxWidth) maxWidth = w;
      totalHeight += line.size + 8;
    }

    canvas.width = Math.max(maxWidth + padding * 2, 600);
    canvas.height = totalHeight;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 2;
    ctx.roundRect(4, 4, canvas.width - 8, canvas.height - 8, 12);
    ctx.stroke();

    let y = padding + 4;
    for (const line of lines) {
      if (!line.text) { y += line.size; continue; }
      ctx.font = `${line.bold ? "bold " : ""}${line.size}px ${line.font}`;
      ctx.fillStyle = line.color;
      ctx.fillText(line.text, padding, y + line.size);
      y += line.size + 8;
    }

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "reaction-system-summary.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, "image/png");
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
              {left}
              {right && (
                <>
                  <span className="mx-3 text-gray-400">{"\u2192"}</span>
                  {right}
                </>
              )}
            </p>
            {excessStr && (
              <p className="font-mono text-lg text-amber-600 mt-1">
                + {excessStr} <span className="text-sm text-amber-500">(excess)</span>
              </p>
            )}
          </div>
        </div>

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
