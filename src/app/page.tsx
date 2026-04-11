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
  generateTotalsCSV,
  generateSystemFullCSV,
  generateSystemEconCSV,
  generateSystemThermoSummaryCSV,
  generatePropertiesCSV,
  downloadCSV,
} from "@/lib/export";
import { normalizeFormula } from "@/lib/utils";
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
import ReactionNetworkGraph from "@/components/ReactionNetworkGraph";
import ValidationWarnings from "@/components/ValidationWarnings";
import { validateSystem } from "@/lib/topology-validator";
import SystemEconomicsDisplay from "@/components/SystemEconomicsDisplay";
import PhysicalPropertiesTable from "@/components/PhysicalPropertiesTable";
import DownloadButton from "@/components/DownloadButton";
import ErrorMessage from "@/components/ErrorMessage";
import HelpModal from "@/components/HelpModal";
import SessionManager from "@/components/SessionManager";
import {
  createSnapshot,
  saveSession,
  loadSession,
  exportSessionToFile,
} from "@/lib/session-storage";

let nextNodeId = 0;
let nextLinkId = 0;

export default function Home() {
  // System state
  const [system, setSystem] = useState<ReactionSystem>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLinkEditor, setShowLinkEditor] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Calculation results
  const [systemResult, setSystemResult] = useState<SystemCalculationResult | null>(null);
  const [systemThermo, setSystemThermo] = useState<SystemThermodynamics | null>(null);
  const [systemEcon, setSystemEcon] = useState<SystemEconomics | null>(null);
  const [energyUnit, setEnergyUnit] = useState<EnergyUnit>("kJ");
  const [startReactionId, setStartReactionId] = useState<string | null>(null);
  const [startInput, setStartInput] = useState<CalculationInput | null>(null);

  // Session tracking
  const [currentSessionName, setCurrentSessionName] = useState<string | null>(null);
  const [savedPrices, setSavedPrices] = useState<Array<{ value: string; unit: string }>>([]);

  // Active tab
  const [activeTab, setActiveTab] = useState<"per-reaction" | "totals" | "thermo" | "economics" | "properties">("per-reaction");

  // --- Handlers ---

  // insertAt: index to insert before, undefined = append at end
  const [insertAtIndex, setInsertAtIndex] = useState<number | null>(null);

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

      setSystem((prev) => {
        const nodes = [...prev.nodes];
        if (insertAtIndex !== null && insertAtIndex >= 0 && insertAtIndex <= nodes.length) {
          nodes.splice(insertAtIndex, 0, node);
        } else {
          nodes.push(node);
        }
        return { ...prev, nodes };
      });
      setInsertAtIndex(null);
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

  const handleRenameReaction = (id: string, name: string) => {
    setSystem((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) =>
        n.id === id ? { ...n, displayName: name || undefined } : n
      ),
    }));
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
    setCurrentSessionName(null);
    setSavedPrices([]);
    nextNodeId = 0;
    nextLinkId = 0;
  };

  // --- Save/Load ---

  const handleSaveSession = (name: string) => {
    const snapshot = createSnapshot(
      name,
      system,
      systemResult,
      systemThermo,
      systemEcon,
      energyUnit,
      startReactionId,
      startInput,
      nextNodeId,
      nextLinkId,
      savedPrices
    );
    saveSession(snapshot);
  };

  const handleSaveToFile = (name: string) => {
    const snapshot = createSnapshot(
      name,
      system,
      systemResult,
      systemThermo,
      systemEcon,
      energyUnit,
      startReactionId,
      startInput,
      nextNodeId,
      nextLinkId,
      savedPrices
    );
    saveSession(snapshot);
    // Export immediately after saving
    exportSessionToFile(snapshot.metadata.id);
  };

  const handleLoadSession = (id: string) => {
    const snapshot = loadSession(id);
    if (!snapshot) return;

    setSystem(snapshot.system);
    setSystemResult(snapshot.systemResult);
    setSystemThermo(snapshot.systemThermo);
    setSystemEcon(snapshot.systemEcon);
    setEnergyUnit(snapshot.energyUnit);
    setStartReactionId(snapshot.startReactionId);
    setStartInput(snapshot.startInput);
    setSavedPrices(snapshot.savedPrices ?? []);
    setError(null);
    setActiveTab(snapshot.systemResult ? "per-reaction" : "per-reaction");
    nextNodeId = snapshot.nextNodeId;
    nextLinkId = snapshot.nextLinkId;
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
      <header className="bg-gradient-to-r from-slate-800 via-teal-900 to-slate-800 px-6 py-10 text-center text-white relative">
        <button
          onClick={() => setShowHelp(true)}
          className="absolute top-4 right-4 flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90 transition hover:bg-white/20"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
          </svg>
          Help
        </button>
        <img src="/logo.png" alt="Logo" className="mx-auto mb-3 h-16 w-16 invert" />
        <h1 className="text-3xl font-bold tracking-tight">
          Multi-Reaction Stoichiometry Calculator
        </h1>
        <p className="mt-2 text-sm text-teal-200">
          Build parallel and sequential reaction systems. Calculate quantities, thermodynamics, and economics across the full chain.
        </p>
      </header>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-4 px-4 py-8">
        {/* Sessions */}
        <SessionManager
          hasContent={system.nodes.length > 0}
          currentSessionName={currentSessionName}
          onSave={handleSaveSession}
          onSaveToFile={handleSaveToFile}
          onLoad={handleLoadSession}
          onSessionLoaded={setCurrentSessionName}
        />

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

        {/* Reaction Cards + Links + Insert buttons */}
        {system.nodes.length > 0 && (
          <section className="space-y-2">
            {system.nodes.map((node, i) => {
              const incomingLinks = system.links.filter((l) => l.toReactionId === node.id);

              return (
                <div key={node.id}>
                  {/* Insert-before button */}
                  {insertAtIndex === i ? (
                    <div className="rounded-xl border-2 border-dashed border-teal-300 bg-teal-50 p-4 mb-2">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-teal-700">Insert reaction before Reaction {i + 1}</p>
                        <button onClick={() => setInsertAtIndex(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                      </div>
                      <ReactionInput onSubmit={handleAddReaction} loading={loading} />
                    </div>
                  ) : (
                    <div className="flex justify-center py-1">
                      <button
                        onClick={() => setInsertAtIndex(i)}
                        className="flex items-center gap-1 rounded-full border border-dashed border-gray-300 bg-white px-3 py-0.5 text-xs text-gray-400 transition hover:border-teal-400 hover:text-teal-600 hover:bg-teal-50"
                        title={`Insert reaction before Reaction ${i + 1}`}
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        insert
                      </button>
                    </div>
                  )}

                  {incomingLinks.map((link) => (
                    <LinkBadge key={link.id} link={link} nodes={system.nodes} onDelete={handleDeleteLink} />
                  ))}
                  <ReactionCard node={node} index={i} onDelete={handleDeleteReaction} onRename={handleRenameReaction} />
                </div>
              );
            })}
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

        {/* Validation Warnings */}
        {system.nodes.length >= 2 && (
          <ValidationWarnings warnings={validateSystem(system)} />
        )}

        {/* Reaction Network Graph (collapsible) */}
        {system.nodes.length >= 2 && (
          <details className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <summary className="px-6 py-3 bg-slate-50 border-b border-gray-200 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-slate-100 transition">
              Reaction Network
            </summary>
            <div className="p-4">
              <ReactionNetworkGraph system={system} />
            </div>
          </details>
        )}

        {/* System Input */}
        {system.nodes.length > 0 && (
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">
              {isSingleReaction ? "Calculate Quantities" : "Calculate System"}
            </h2>
            <SystemInput
              nodes={system.nodes}
              onCalculate={handleCalculateSystem}
              initialReactionId={startReactionId}
              initialInput={startInput}
            />
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
                  ["properties", "Properties"],
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
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-800">Detailed Mass Balance</h2>
                    <DownloadButton onClick={() => downloadCSV(generateTotalsCSV(systemResult.totals), "system-totals.csv")} />
                  </div>
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
                    <div className="flex items-center gap-2">
                    <DownloadButton onClick={() => {
                      const selResults = startReactionId ? systemResult.perReaction.get(startReactionId) : null;
                      const selResult = selResults && startInput ? selResults[startInput.substanceIndex] : null;
                      downloadCSV(generateSystemThermoSummaryCSV(systemThermo, energyUnit, selResult), "system-thermodynamics.csv");
                    }} />
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

                  {/* Specific energy per unit of selected substance */}
                  {startReactionId && startInput && (() => {
                    const selResults = systemResult.perReaction.get(startReactionId);
                    const selResult = selResults?.[startInput.substanceIndex];
                    if (!selResult) return null;
                    const dH = systemThermo.totalDeltaH;
                    const conv = energyUnit === "BTU" ? 0.947817 : 1;
                    const fmtE = (n: number) => n === 0 ? "0" : Math.abs(n) >= 0.01 && Math.abs(n) < 1e6 ? n.toPrecision(4) : n.toExponential(3);
                    return (
                      <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <p className="mb-2 text-sm font-medium text-gray-700">
                          System energy per unit of <span className="font-semibold text-teal-700">{selResult.substance.formula}</span> ({selResult.substance.name}):
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-sm">
                          {selResult.moles > 0 && <div className="flex justify-between"><span className="text-gray-500">{energyUnit}/mol:</span><span className="font-mono">{fmtE(dH / selResult.moles * conv)}</span></div>}
                          {selResult.grams > 0 && <div className="flex justify-between"><span className="text-gray-500">{energyUnit}/g:</span><span className="font-mono">{fmtE(dH / selResult.grams * conv)}</span></div>}
                          {selResult.kilograms > 0 && <div className="flex justify-between"><span className="text-gray-500">{energyUnit}/kg:</span><span className="font-mono">{fmtE(dH / selResult.kilograms * conv)}</span></div>}
                          {selResult.pounds > 0 && <div className="flex justify-between"><span className="text-gray-500">{energyUnit}/lb:</span><span className="font-mono">{fmtE(dH / selResult.pounds * conv)}</span></div>}
                        </div>
                      </div>
                    );
                  })()}
                </section>

                {/* Per-reaction thermodynamics */}
                {system.nodes.map((node, i) => {
                  const thermo = systemThermo.perReaction.get(node.id);
                  const results = systemResult.perReaction.get(node.id);
                  if (!thermo || !results) return null;
                  const selIdx = node.id === startReactionId ? (startInput?.substanceIndex ?? 0) : 0;
                  return (
                    <section key={node.id} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-600">
                          Reaction {i + 1}: <span className="text-gray-800">{node.reaction.equation}</span>
                        </h3>
                        <DownloadButton onClick={() => downloadCSV(generateThermodynamicsCSV(thermo, energyUnit, results[selIdx]), `thermo-rxn${i+1}.csv`)} />
                      </div>
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

            {/* Properties tab */}
            {activeTab === "properties" && (
              <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-800">Physical Properties</h2>
                  <DownloadButton onClick={() => {
                    const substMap = new Map<string, { formula: string; molarMass: number; state: string; densityLiquid: number | null; densityGas: number | null; hhv: number | null; lhv: number | null }>();
                    for (const node of system.nodes) {
                      for (const s of [...node.reaction.reactants, ...node.reaction.products]) {
                        const key = normalizeFormula(s.formula);
                        if (!substMap.has(key)) substMap.set(key, { formula: s.formula, molarMass: s.molarMass, state: s.state, densityLiquid: s.density, densityGas: s.densityGas ?? null, hhv: s.hhv ?? null, lhv: s.lhv ?? null });
                      }
                    }
                    const data = systemResult.totals.map(t => substMap.get(normalizeFormula(t.formula)) ?? { formula: t.formula, molarMass: 0, state: "", densityLiquid: null, densityGas: null, hhv: null, lhv: null });
                    downloadCSV(generatePropertiesCSV(systemResult.totals, data), "physical-properties.csv");
                  }} />
                </div>
                <PhysicalPropertiesTable
                  totals={systemResult.totals}
                  system={system}
                />
              </section>
            )}

            {/* Economics tab */}
            {activeTab === "economics" && (
              <div className="space-y-4">
                <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-lg font-semibold text-gray-800">System Economics</h2>
                  <SystemEconomicsPanel
                    totals={systemResult.totals}
                    onCalculate={handleSystemEconomics}
                    initialPrices={savedPrices.length > 0 ? savedPrices : undefined}
                    onPricesChange={setSavedPrices}
                  />
                </section>

                {systemEcon && (
                  <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-gray-800">Cost Analysis</h2>
                      <DownloadButton onClick={() => downloadCSV(generateSystemEconCSV(systemEcon), "system-economics.csv")} />
                    </div>
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
        <p>Version 1.14b — April 2026</p>
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
