"use client";

import { useState } from "react";
import type { BalancedReaction } from "@/lib/types";
import dynamic from "next/dynamic";

// Lazy-load MoleculeStructure (only needed in structure view, avoids SSR issues)
const MoleculeStructure = dynamic(() => import("./MoleculeStructure"), {
  ssr: false,
});

interface EquationDisplayProps {
  reaction: BalancedReaction;
}

type ViewMode = "formula" | "structure";

export default function EquationDisplay({ reaction }: EquationDisplayProps) {
  const allSubstances = [...reaction.reactants, ...reaction.products];
  const hasAnySmiles = allSubstances.some((s) => s.smiles);

  const [view, setView] = useState<ViewMode>("formula");

  const equationText = reaction.equilibrium
    ? reaction.equation.replace(/→|⟶|->/, "⇌")
    : reaction.equation;

  const arrow = reaction.equilibrium ? "⇌" : "→";

  return (
    <div className="space-y-4">
      {/* Equation display box */}
      <div className="rounded-xl bg-gray-50 border border-gray-200 p-6 text-center relative">
        {/* Toggle button — only show if any substance has SMILES */}
        {hasAnySmiles && (
          <button
            onClick={() => setView(view === "formula" ? "structure" : "formula")}
            className="absolute top-2 right-2 rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 shadow-sm"
            title={view === "formula" ? "Show molecular structures" : "Show chemical formula"}
          >
            {view === "formula" ? (
              <span className="flex items-center gap-1">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                </svg>
                Structure
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                </svg>
                Formula
              </span>
            )}
          </button>
        )}

        {view === "formula" ? (
          <p className="font-mono text-2xl tracking-wide text-gray-800">
            {equationText}
          </p>
        ) : (
          /* Structure view: render each substance as a molecule diagram */
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {reaction.reactants.map((s, i) => (
              <div key={`r-${i}`} className="flex items-center gap-2">
                {i > 0 && <span className="text-xl text-gray-400 font-mono">+</span>}
                <div className="flex flex-col items-center">
                  {s.coefficient > 1 && (
                    <span className="text-xs font-mono text-gray-500 mb-0.5">{s.coefficient}</span>
                  )}
                  {s.smiles ? (
                    <MoleculeStructure smiles={s.smiles} width={120} height={100} />
                  ) : (
                    <span className="font-mono text-lg text-gray-800">{s.formula}</span>
                  )}
                  <span className="text-[10px] text-gray-400 mt-0.5">{s.formula}</span>
                </div>
              </div>
            ))}

            <span className="text-2xl text-gray-500 font-mono mx-2">{arrow}</span>

            {reaction.products.map((s, i) => (
              <div key={`p-${i}`} className="flex items-center gap-2">
                {i > 0 && <span className="text-xl text-gray-400 font-mono">+</span>}
                <div className="flex flex-col items-center">
                  {s.coefficient > 1 && (
                    <span className="text-xs font-mono text-gray-500 mb-0.5">{s.coefficient}</span>
                  )}
                  {s.smiles ? (
                    <MoleculeStructure smiles={s.smiles} width={120} height={100} />
                  ) : (
                    <span className="font-mono text-lg text-gray-800">{s.formula}</span>
                  )}
                  <span className="text-[10px] text-gray-400 mt-0.5">{s.formula}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Substance badges */}
      <div className="flex flex-wrap gap-2 justify-center">
        {allSubstances.map((s, i) => (
          <div
            key={i}
            className={`rounded-lg border px-3 py-2 text-xs ${
              s.role === "reactant"
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-green-200 bg-green-50 text-green-700"
            }`}
          >
            <span className="font-semibold">{s.formula}</span>
            <span className="mx-1 text-gray-400">|</span>
            <span>{s.name}</span>
            <span className="mx-1 text-gray-400">|</span>
            <span>{s.molarMass} g/mol</span>
            <span className="mx-1 text-gray-400">|</span>
            <span className="italic">{s.state}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
