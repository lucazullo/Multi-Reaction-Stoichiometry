"use client";

import { useState } from "react";
import type {
  CalculationInput,
  EnergyUnit,
  ParseReactionResponse,
  ReactionNode,
  ReactionSystem,
  SeriesLink,
  SystemCalculationResult,
  SystemEconomics,
  SystemThermodynamics,
} from "@/lib/types";
import {
  calculateSystem,
  calculateSystemThermodynamics,
} from "@/lib/system-calculation";
import {
  generateQuantitiesCSV,
  generateThermodynamicsCSV,
  generateEconomicsCSV,
  generateFullCSV,
  generateSystemFullCSV,
  downloadCSV,
} from "@/lib/export";
import ReactionInput from "@/components/ReactionInput";
import ReactionCard from "@/components/ReactionCard";
import LinkBadge from "@/components/LinkBadge";
import LinkEditor from "@/components/LinkEditor";
import SystemInput from "@/components/SystemInput";
import SystemTotalsTable from "@/components/SystemTotalsTable";
import SystemEquationSummary from "@/components/SystemEquationSummary";
import ResultsTable from "@/components/ResultsTable";
import ThermodynamicsDisplay from "@/components/ThermodynamicsDisplay";
import SystemEconomicsPanel from "@/components/SystemEconomicsPanel";
import SystemEconomicsDisplay from "@/components/SystemEconomicsDisplay";
import DownloadButton from "@/components/DownloadButton";
import ErrorMessage from "@/components/ErrorMessage";

let nextNodeId = 0;
let nextLinkId = 0;

export default function Home() {
  // System state
  const [system, setSystem] = useState<ReactionSystem>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLinkEditor, setShowLinkEditor] = useState(false);

  // Calculation results
  const [systemResult, setSystemResult] = useState<SystemCalculationResult | null>(null);
  const [systemThermo, setSystemThermo] = useState<SystemThermodynamics | null>(null);
  const [systemEcon, setSystemEcon] = useState<SystemEconomics | null>(null);
  const [energyUnit, setEnergyUnit] = useState<EnergyUnit>("kJ");
  const [startReactionId, setStartReactionId] = useState<string | null>(null);
  const [startInput, setStartInput] = useState<CalculationInput | null>(null);

  // Active tab
  const [activeTab, setActiveTab] = useState<"per-reaction" | "totals" | "thermo" | "economics">("per-reaction");

  // --- Handlers ---

  const handleAddReaction = async (description: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/parse-reaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      const data: ParseReactionResponse = await res.json();

      if (!data.success || !data.data) {
        setError(data.error || "Failed to parse the reaction.");
        return;
      }

      const node: ReactionNode = {
        id: `rxn-${nextNodeId++}`,
        reaction: data.data,
        label: description,
      };

      setSystem((prev) => ({ ...prev, nodes: [...prev.nodes, node] }));
      // Clear previous results when adding new reaction
      setSystemResult(null);
      setSystemThermo(null);
      setSystemEcon(null);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReaction = (id: string) => {
    setSystem((prev) => ({
      nodes: prev.nodes.filter((n) => n.id !== id),
      links: prev.links.filter((l) => l.fromReactionId !== id && l.toReactionId !== id),
    }));
    setSystemResult(null);
    setSystemThermo(null);
    setSystemEcon(null);
  };

  const handleAddLink = (link: Omit<SeriesLink, "id">) => {
    const newLink: SeriesLink = { ...link, id: `link-${nextLinkId++}` };
    setSystem((prev) => ({ ...prev, links: [...prev.links, newLink] }));
    setSystemResult(null);
    setSystemThermo(null);
    setSystemEcon(null);
  };

  const handleDeleteLink = (linkId: string) => {
    setSystem((prev) => ({
      ...prev,
      links: prev.links.filter((l) => l.id !== linkId),
    }));
    setSystemResult(null);
  };

  const handleCalculateSystem = (reactionId: string, input: CalculationInput) => {
    setError(null);
    try {
      const result = calculateSystem(system, reactionId, input);
      setSystemResult(result);
      setStartReactionId(reactionId);
      setStartInput(input);

      const thermo = calculateSystemThermodynamics(system, result.perReaction);
      setSystemThermo(thermo);

      setSystemEcon(null);
      setActiveTab("per-reaction");
    } catch (err) {
      setError(err instanceof Error ? err.message : "System calculation error.");
    }
  };

  const handleSystemEconomics = (econ: SystemEconomics) => {
    setSystemEcon(econ);
  };

  const handleReset = () => {
    setSystem({ nodes: [], links: [] });
    setSystemResult(null);
    setSystemThermo(null);
    setSystemEcon(null);
    setError(null);
    nextNodeId = 0;
    nextLinkId = 0;
  };

  // --- Downloads ---

  const handleDownloadPerReaction = (reactionId: string) => {
    const results = systemResult?.perReaction.get(reactionId);
    if (!results) return;
    const node = system.nodes.find((n) => n.id === reactionId);
    downloadCSV(generateQuantitiesCSV(results), `stoich-${node?.label.slice(0, 20) ?? reactionId}.csv`);
  };

  const handleDownloadSystemReport = () => {
    if (!systemResult) return;
    downloadCSV(
      generateSystemFullCSV(system, systemResult, systemThermo, systemEcon, energyUnit),
      "stoichiometry-system-report.csv"
    );
  };

  // --- Derived ---

  const isSingleReaction = system.nodes.length === 1 && system.links.length === 0;

  // --- Render ---

  return (
    <>
      <header className="bg-gradient-to-r from-slate-800 via-teal-900 to-slate-800 px-6 py-10 text-center text-white">
        <h1 className="text-3xl font-bold tracking-tight">
          Multi-Reaction Stoichiometry Calculator
        </h1>
        <p className="mt-2 text-sm text-teal-200">
          Build parallel and sequential reaction systems. Calculate quantities, thermodynamics, and economics across the full chain.
        </p>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-4 px-4 py-8">
        {/* Add Reaction */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              {system.nodes.length === 0 ? "Add a Reaction" : "Add Another Reaction"}
            </h2>
            {system.nodes.length > 0 && (
              <button onClick={handleReset} className="text-xs text-gray-400 hover:text-gray-600 transition">
                Reset all
              </button>
            )}
          </div>
          <ReactionInput onSubmit={handleAddReaction} loading={loading} />
        </section>

        {error && <ErrorMessage message={error} />}

        {/* Reaction Cards + Links */}
        {system.nodes.length > 0 && (
          <section className="space-y-2">
            {system.nodes.map((node, i) => {
              // Find links that go INTO this reaction
              const incomingLinks = system.links.filter((l) => l.toReactionId === node.id);

              return (
                <div key={node.id}>
                  {incomingLinks.map((link) => (
                    <LinkBadge key={link.id} link={link} nodes={system.nodes} onDelete={handleDeleteLink} />
                  ))}
                  <ReactionCard node={node} index={i} onDelete={handleDeleteReaction} />
                </div>
              );
            })}

            {/* Show outgoing links from last reaction that don't point to any shown reaction */}
            {system.links
              .filter((l) => !system.nodes.some((n) => n.id === l.toReactionId && system.nodes.indexOf(n) > system.nodes.findIndex((nn) => nn.id === l.fromReactionId)))
              .filter((l) => !system.links.some((other) => other.toReactionId === l.toReactionId && other !== l))
              .length === 0 && null}
          </section>
        )}

        {/* Link Management */}
        {system.nodes.length >= 2 && (
          <div className="flex justify-center">
            <button
              onClick={() => setShowLinkEditor(true)}
              className="flex items-center gap-2 rounded-lg border border-dashed border-purple-300 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-700 transition hover:bg-purple-100"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.813a4.5 4.5 0 00-1.242-7.244l4.5-4.5a4.5 4.5 0 016.364 6.364l-1.757 1.757" />
              </svg>
              Add Series Link Between Reactions
            </button>
          </div>
        )}

        {showLinkEditor && (
          <LinkEditor
            nodes={system.nodes}
            onAdd={handleAddLink}
            onClose={() => setShowLinkEditor(false)}
          />
        )}

        {/* System Input */}
        {system.nodes.length > 0 && (
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">
              {isSingleReaction ? "Calculate Quantities" : "Calculate System"}
            </h2>
            <SystemInput nodes={system.nodes} onCalculate={handleCalculateSystem} />
          </section>
        )}

        {/* Results */}
        {systemResult && (
          <>
            {/* Tab bar */}
            <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
              {(
                [
                  ["per-reaction", "Per Reaction"],
                  ["totals", "System Totals"],
                  ["thermo", "Thermodynamics"],
                  ["economics", "Economics"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                    activeTab === key
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Per-Reaction tab */}
            {activeTab === "per-reaction" && (
              <div className="space-y-4">
                {system.nodes.map((node, i) => {
                  const results = systemResult.perReaction.get(node.id);
                  if (!results) return (
                    <section key={node.id} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm opacity-50">
                      <h3 className="text-sm font-semibold text-gray-600">
                        Reaction {i + 1}: {node.label}
                      </h3>
                      <p className="text-xs text-gray-400 mt-1">Not calculated (no input connected)</p>
                    </section>
                  );
                  return (
                    <section key={node.id} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-600">
                          Reaction {i + 1}: <span className="text-gray-800">{node.reaction.equation}</span>
                        </h3>
                        <DownloadButton onClick={() => handleDownloadPerReaction(node.id)} />
                      </div>
                      <ResultsTable results={results} selectedIndex={node.id === startReactionId ? (startInput?.substanceIndex ?? 0) : 0} />
                    </section>
                  );
                })}
              </div>
            )}

            {/* System Totals tab */}
            {activeTab === "totals" && (
              <div className="space-y-4">
                <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <SystemEquationSummary
                    totals={systemResult.totals}
                    nodes={system.nodes}
                  />
                </section>

                <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-lg font-semibold text-gray-800">Detailed Mass Balance</h2>
                  <SystemTotalsTable totals={systemResult.totals} />
                </section>
              </div>
            )}

            {/* Thermodynamics tab */}
            {activeTab === "thermo" && systemThermo && (
              <div className="space-y-4">
                {/* System-wide summary */}
                <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-800">System Thermodynamics</h2>
                    <div className="flex rounded-lg border border-gray-300 bg-white overflow-hidden text-sm">
                      <button
                        onClick={() => setEnergyUnit("kJ")}
                        className={`px-3 py-1.5 font-medium transition ${energyUnit === "kJ" ? "bg-teal-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
                      >kJ</button>
                      <button
                        onClick={() => setEnergyUnit("BTU")}
                        className={`px-3 py-1.5 font-medium transition ${energyUnit === "BTU" ? "bg-teal-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
                      >BTU</button>
                    </div>
                  </div>
                  <div className={`rounded-lg p-4 ${systemThermo.isExothermic ? "bg-orange-50 border border-orange-200" : "bg-blue-50 border border-blue-200"}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{systemThermo.isExothermic ? "\uD83D\uDD25" : "\u2744\uFE0F"}</span>
                      <div>
                        <p className={`font-semibold ${systemThermo.isExothermic ? "text-orange-800" : "text-blue-800"}`}>
                          {systemThermo.isExothermic ? "Net Exothermic" : "Net Endothermic"}
                        </p>
                        <p className={`text-sm font-mono ${systemThermo.isExothermic ? "text-orange-600" : "text-blue-600"}`}>
                          Total ΔH = {(energyUnit === "BTU" ? systemThermo.totalDeltaH * 0.947817 : systemThermo.totalDeltaH).toPrecision(4)} {energyUnit}
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Per-reaction thermodynamics */}
                {system.nodes.map((node, i) => {
                  const thermo = systemThermo.perReaction.get(node.id);
                  const results = systemResult.perReaction.get(node.id);
                  if (!thermo || !results) return null;
                  const selIdx = node.id === startReactionId ? (startInput?.substanceIndex ?? 0) : 0;
                  return (
                    <section key={node.id} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                      <h3 className="mb-4 text-sm font-semibold text-gray-600">
                        Reaction {i + 1}: <span className="text-gray-800">{node.reaction.equation}</span>
                      </h3>
                      <ThermodynamicsDisplay
                        thermodynamics={thermo}
                        energyUnit={energyUnit}
                        onEnergyUnitChange={setEnergyUnit}
                        selectedResult={results[selIdx]}
                      />
                    </section>
                  );
                })}
              </div>
            )}

            {/* Economics tab */}
            {activeTab === "economics" && (
              <div className="space-y-4">
                <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-lg font-semibold text-gray-800">System Economics</h2>
                  <SystemEconomicsPanel
                    totals={systemResult.totals}
                    onCalculate={handleSystemEconomics}
                  />
                </section>

                {systemEcon && (
                  <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-4 text-lg font-semibold text-gray-800">Cost Analysis</h2>
                    <SystemEconomicsDisplay economics={systemEcon} />
                  </section>
                )}
              </div>
            )}

            {/* Download Full Report */}
            <div className="flex justify-center pt-2">
              <button
                onClick={handleDownloadSystemReport}
                className="flex items-center gap-2 rounded-lg bg-slate-700 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Download Full System Report (CSV)
              </button>
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-gray-100 py-6 text-center text-xs text-gray-400 space-y-1">
        <p>Version 1.01 — April 2026</p>
        <p>Powered by Claude AI for reaction parsing</p>
        <p>
          Questions or suggestions?{" "}
          <a
            href="mailto:lucazullo@gmail.com"
            className="text-teal-600 hover:text-teal-700 underline"
          >
            lucazullo@gmail.com
          </a>
        </p>
      </footer>
    </>
  );
}
