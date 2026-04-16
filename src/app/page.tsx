"use client";

import { useState } from "react";
import type {
  AppMode,
  BalancedReaction,
  CalculationInput,
  EnergyUnit,
  GraphLayout,
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
import BalanceCheckDisplay from "@/components/BalanceCheckDisplay";
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
import ModeToggle from "@/components/ModeToggle";
import PropertyWarnings from "@/components/PropertyWarnings";
import ConversionSlider from "@/components/ConversionSlider";
import LookupButton from "@/components/LookupButton";
import ReferencesPanel from "@/components/ReferencesPanel";
import EquilibriumPanel from "@/components/EquilibriumPanel";
import KineticsPanel from "@/components/KineticsPanel";
import ICETable from "@/components/ICETable";
import LeChatelierDisplay from "@/components/LeChatelierDisplay";
import ConcentrationChart from "@/components/ConcentrationChart";
import TemperatureInput from "@/components/TemperatureInput";
import CompetingReactionsEditor from "@/components/CompetingReactionsEditor";
import SelectivityDashboard from "@/components/SelectivityDashboard";
import InitialConcentrations, { deriveDefaults } from "@/components/InitialConcentrations";
import type { RateLaw, EquilibriumData, EquilibriumResult, KineticsResult, CompetingReactionSet, SelectivityResult, Reference } from "@/lib/types";
import { solveEquilibrium } from "@/lib/equilibrium";
import { integrateKinetics } from "@/lib/kinetics";
import { calculateSelectivity } from "@/lib/selectivity";
import { STANDARD_TEMPERATURE } from "@/lib/constants";
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

  // Graph layout (persisted positions + colors)
  const [graphLayout, setGraphLayout] = useState<GraphLayout>({ nodes: {}, edges: {} });

  // Session tracking
  const [currentSessionName, setCurrentSessionName] = useState<string | null>(null);
  const [savedPrices, setSavedPrices] = useState<Array<{ value: string; unit: string }>>([]);

  // Active tab
  const [activeTab, setActiveTab] = useState<"per-reaction" | "totals" | "thermo" | "economics" | "properties" | "kinetics" | "equilibrium" | "selectivity">("per-reaction");

  // v2: App mode
  const [mode, setMode] = useState<AppMode>("basic");
  const [calcTemperature, setCalcTemperature] = useState(STANDARD_TEMPERATURE);
  const [calcVolume, setCalcVolume] = useState(1); // liters, for equilibrium
  const [equilibriumResults, setEquilibriumResults] = useState<Map<string, EquilibriumResult>>(new Map());
  const [kineticsResults, setKineticsResults] = useState<Map<string, KineticsResult>>(new Map());
  const [kineticsErrors, setKineticsErrors] = useState<Map<string, string>>(new Map());
  const [kineticsTime, setKineticsTime] = useState(100); // seconds
  // Per-reaction editable initial concentrations: reactionId → { formula → mol/L }
  const [kineticsInitialConc, setKineticsInitialConc] = useState<Map<string, Record<string, number>>>(new Map());
  const [selectivityResults, setSelectivityResults] = useState<SelectivityResult[]>([]);

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

  const handleRateLawFound = (id: string, rateLaw: RateLaw, references: Reference[]) => {
    setSystem((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) =>
        n.id === id
          ? { ...n, reaction: { ...n.reaction, rateLaw, references } }
          : n
      ),
    }));
  };

  const handleCompetingSetsChange = (sets: CompetingReactionSet[]) => {
    setSystem((prev) => ({ ...prev, competingSets: sets.length > 0 ? sets : undefined }));
    setSelectivityResults([]);
  };

  const handleRateLawChange = (id: string, rateLaw: RateLaw | undefined) => {
    setSystem((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) =>
        n.id === id ? { ...n, reaction: { ...n.reaction, rateLaw } } : n
      ),
    }));
    setKineticsResults(new Map());
  };

  const handleEquilibriumChange = (id: string, equilibrium: EquilibriumData | undefined) => {
    setSystem((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) =>
        n.id === id ? { ...n, reaction: { ...n.reaction, equilibrium } } : n
      ),
    }));
    setEquilibriumResults(new Map());
    setKineticsResults(new Map()); // equilibrium affects kinetics too
    setKineticsErrors(new Map());
  };

  const handleEquilibriumFound = (id: string, equilibrium: EquilibriumData, references: Reference[]) => {
    setSystem((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) =>
        n.id === id
          ? { ...n, reaction: { ...n.reaction, equilibrium, references } }
          : n
      ),
    }));
    setSystemResult(null);
    setSystemThermo(null);
    setSystemEcon(null);
  };

  const handleConversionChange = (id: string, conversion: number) => {
    setSystem((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) =>
        n.id === id
          ? { ...n, reaction: { ...n.reaction, conversion: conversion >= 1 ? undefined : conversion } }
          : n
      ),
    }));
    // Clear results since conversion changed
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

  const handleEditReaction = (id: string, reaction: BalancedReaction) => {
    setSystem((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) =>
        n.id === id ? { ...n, reaction } : n
      ),
    }));
    // Clear stale results since stoichiometry changed
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
    setCurrentSessionName(null);
    setSavedPrices([]);
    setGraphLayout({ nodes: {}, edges: {} });
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
      savedPrices,
      undefined, // existingId
      graphLayout
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
      savedPrices,
      undefined, // existingId
      graphLayout
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
    setGraphLayout(snapshot.graphLayout ?? { nodes: {}, edges: {} });
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
      "reactioniq-system-report.csv"
    );
  };

  // --- Derived ---

  const isSingleReaction = system.nodes.length === 1 && system.links.length === 0;

  // --- Render ---

  return (
    <>
      <header className="bg-gradient-to-b from-slate-50 to-slate-100 border-b border-slate-200 px-6 py-8 text-center relative">
        <button
          onClick={() => setShowHelp(true)}
          className="absolute top-4 right-4 flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
          </svg>
          Help
        </button>
        <img src="/logo.png" alt="ReactionIQ" className="mx-auto mb-3 h-28 w-auto" />
        <p className="text-sm text-slate-500">
          Advanced reaction engineering: stoichiometry, kinetics, equilibria, selectivity, thermodynamics, and economics.
        </p>
        <div className="mt-4 flex justify-center">
          <ModeToggle mode={mode} onChange={setMode} />
        </div>
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
                  <ReactionCard node={node} index={i} onDelete={handleDeleteReaction} onRename={handleRenameReaction} onEditReaction={handleEditReaction} />
                  {mode === "advanced" && (
                    <div className="mx-4 -mt-1 mb-1 rounded-b-lg border border-t-0 border-gray-200 bg-gray-50 px-4 py-3 space-y-3">
                      <ConversionSlider
                        value={node.reaction.conversion ?? 1}
                        onChange={(v) => handleConversionChange(node.id, v)}
                      />
                      <KineticsPanel
                        rateLaw={node.reaction.rateLaw}
                        reaction={node.reaction}
                        onChange={(rl) => handleRateLawChange(node.id, rl)}
                      />
                      <EquilibriumPanel
                        equilibrium={node.reaction.equilibrium}
                        onChange={(eq) => handleEquilibriumChange(node.id, eq)}
                      />
                      <LookupButton
                        reaction={node.reaction}
                        onRateLawFound={(rl, refs) => handleRateLawFound(node.id, rl, refs)}
                        onEquilibriumFound={(eq, refs) => handleEquilibriumFound(node.id, eq, refs)}
                        onNotesFound={(notes) => {
                          setSystem((prev) => ({
                            ...prev,
                            nodes: prev.nodes.map((n) =>
                              n.id === node.id ? { ...n, reaction: { ...n.reaction, lookupNotes: notes } } : n
                            ),
                          }));
                        }}
                      />
                      {node.reaction.lookupNotes && (
                        <div className="rounded-lg bg-sky-50 border border-sky-200 px-3 py-2">
                          <p className="text-[10px] font-medium text-sky-700 mb-0.5">Literature notes</p>
                          <p className="text-xs text-sky-900">{node.reaction.lookupNotes}</p>
                        </div>
                      )}
                      {node.reaction.references && node.reaction.references.length > 0 && (
                        <ReferencesPanel references={node.reaction.references} />
                      )}
                    </div>
                  )}
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
              <ReactionNetworkGraph system={system} graphLayout={graphLayout} onLayoutChange={setGraphLayout} />
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
            <div className="flex gap-1 rounded-lg bg-gray-100 p-1 flex-wrap">
              {(
                [
                  ["per-reaction", "Per Reaction", false],
                  ["totals", "System Totals", false],
                  ["properties", "Properties", false],
                  ["thermo", "Thermodynamics", false],
                  ["kinetics", "Kinetics", true],
                  ["equilibrium", "Equilibrium", true],
                  ["selectivity", "Selectivity", true],
                  ["economics", "Economics", false],
                ] as const
              )
                .filter(([, , advancedOnly]) => !advancedOnly || mode === "advanced")
                .map(([key, label]) => (
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

                {/* Balance Check */}
                <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-800">Balance Check</h2>
                  </div>
                  <BalanceCheckDisplay balanceCheck={systemResult.balanceCheck} />
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
                {systemResult.propertyWarnings && systemResult.propertyWarnings.length > 0 && (
                  <div className="mt-4">
                    <PropertyWarnings warnings={systemResult.propertyWarnings} />
                  </div>
                )}
              </section>
            )}

            {/* Kinetics tab (v2 advanced) */}
            {activeTab === "kinetics" && mode === "advanced" && (
              <div className="space-y-4">
                {/* Controls */}
                <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-800">Kinetics Analysis</h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <TemperatureInput valueK={calcTemperature} onChange={setCalcTemperature} />
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium text-gray-600">Integration time (s)</label>
                      <input
                        type="number"
                        step="any"
                        min={0.001}
                        value={kineticsTime}
                        onChange={(e) => setKineticsTime(Math.max(0.001, Number(e.target.value)))}
                        className="w-24 rounded border border-gray-300 px-2 py-1 text-xs font-mono"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium text-gray-600">Volume (L)</label>
                      <input
                        type="number"
                        step="any"
                        min={0.001}
                        value={calcVolume}
                        onChange={(e) => setCalcVolume(Math.max(0.001, Number(e.target.value)))}
                        className="w-20 rounded border border-gray-300 px-2 py-1 text-xs font-mono"
                      />
                    </div>
                    <button
                      onClick={() => {
                        // Populate defaults for any reaction that doesn't have user-edited values yet
                        const updatedConc = new Map(kineticsInitialConc);
                        for (const node of system.nodes) {
                          if (!node.reaction.rateLaw) continue;
                          if (!updatedConc.has(node.id)) {
                            const rxnResults = systemResult?.perReaction.get(node.id);
                            updatedConc.set(node.id, deriveDefaults(node.reaction, rxnResults, calcVolume));
                          }
                        }
                        setKineticsInitialConc(updatedConc);

                        const newResults = new Map<string, KineticsResult>();
                        const newErrors = new Map<string, string>();
                        for (const node of system.nodes) {
                          if (!node.reaction.rateLaw) continue;
                          const initialConc = updatedConc.get(node.id);
                          if (!initialConc) {
                            newErrors.set(node.id, "No initial concentrations available. Run 'Calculate System' first.");
                            continue;
                          }
                          try {
                            const kinResult = integrateKinetics(node.reaction, initialConc, calcTemperature, kineticsTime);
                            kinResult.reactionId = node.id;
                            newResults.set(node.id, kinResult);
                          } catch (err) {
                            const msg = err instanceof Error ? err.message : "Kinetics calculation failed";
                            newErrors.set(node.id, msg);
                          }
                        }
                        setKineticsResults(newResults);
                        setKineticsErrors(newErrors);
                      }}
                      disabled={!systemResult}
                      className="rounded-lg bg-teal-600 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-teal-700 disabled:opacity-50"
                    >
                      Run Kinetics
                    </button>
                  </div>
                </section>

                {/* Per-reaction kinetics results */}
                {system.nodes.map((node, i) => {
                  if (!node.reaction.rateLaw) return null;
                  const kinResult = kineticsResults.get(node.id);
                  const rxnResults = systemResult?.perReaction.get(node.id);
                  // Get or derive initial concentrations for this reaction
                  const currentConc = kineticsInitialConc.get(node.id)
                    ?? deriveDefaults(node.reaction, rxnResults, calcVolume);

                  return (
                    <section key={node.id} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                      <h3 className="mb-3 text-sm font-semibold text-gray-600">
                        Reaction {i + 1}: <span className="text-gray-800">{node.reaction.equation}</span>
                      </h3>
                      <div className="mb-4">
                        <InitialConcentrations
                          reaction={node.reaction}
                          stoichResults={rxnResults}
                          volume={calcVolume}
                          values={currentConc}
                          onChange={(vals) => {
                            const updated = new Map(kineticsInitialConc);
                            updated.set(node.id, vals);
                            setKineticsInitialConc(updated);
                          }}
                        />
                      </div>
                      {kineticsErrors.get(node.id) && (
                        <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-xs text-red-800">
                          <strong>Error:</strong> {kineticsErrors.get(node.id)}
                        </div>
                      )}
                      {kinResult ? (
                        <ConcentrationChart result={kinResult} reaction={node.reaction} />
                      ) : !kineticsErrors.get(node.id) ? (
                        <p className="text-xs text-gray-400">Click &quot;Run Kinetics&quot; above to see concentration profiles.</p>
                      ) : null}
                    </section>
                  );
                })}

                {!system.nodes.some((n) => n.reaction.rateLaw) && (
                  <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                    <p className="text-sm text-gray-500">
                      Add rate law parameters to reactions to see concentration-vs-time profiles, rate constants, and half-lives.
                    </p>
                  </section>
                )}
              </div>
            )}

            {/* Equilibrium tab (v2 advanced) */}
            {activeTab === "equilibrium" && mode === "advanced" && (
              <div className="space-y-4">
                {/* Temperature and volume controls */}
                <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-800">Equilibrium Analysis</h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <TemperatureInput valueK={calcTemperature} onChange={setCalcTemperature} />
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium text-gray-600">Volume (L)</label>
                      <input
                        type="number"
                        step="any"
                        min={0.001}
                        value={calcVolume}
                        onChange={(e) => setCalcVolume(Math.max(0.001, Number(e.target.value)))}
                        className="w-20 rounded border border-gray-300 px-2 py-1 text-xs font-mono"
                      />
                    </div>
                    <button
                      onClick={() => {
                        const newResults = new Map<string, EquilibriumResult>();
                        for (const node of system.nodes) {
                          if (!node.reaction.equilibrium || !systemResult) continue;
                          const rxnResults = systemResult.perReaction.get(node.id);
                          if (!rxnResults) continue;
                          const initialMoles: Record<string, number> = {};
                          for (const r of rxnResults) {
                            initialMoles[r.substance.formula] = r.moles;
                          }
                          try {
                            const eqResult = solveEquilibrium(node.reaction, initialMoles, calcVolume, calcTemperature);
                            eqResult.reactionId = node.id;
                            newResults.set(node.id, eqResult);
                          } catch {
                            // skip reactions where solver fails
                          }
                        }
                        setEquilibriumResults(newResults);
                      }}
                      disabled={!systemResult}
                      className="rounded-lg bg-teal-600 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-teal-700 disabled:opacity-50"
                    >
                      Calculate Equilibrium
                    </button>
                  </div>
                </section>

                {/* Per-reaction equilibrium results */}
                {system.nodes.map((node, i) => {
                  if (!node.reaction.equilibrium) return null;
                  const eqResult = equilibriumResults.get(node.id);
                  const rxnResults = systemResult?.perReaction.get(node.id);

                  return (
                    <section key={node.id} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                      <h3 className="mb-3 text-sm font-semibold text-gray-600">
                        Reaction {i + 1}: <span className="text-gray-800">{node.reaction.equation}</span>
                      </h3>

                      {eqResult ? (
                        <div className="space-y-4">
                          {/* Summary */}
                          <div className={`rounded-lg p-3 ${
                            eqResult.direction === "forward" ? "bg-green-50 border border-green-200" :
                            eqResult.direction === "reverse" ? "bg-orange-50 border border-orange-200" :
                            "bg-gray-50 border border-gray-200"
                          }`}>
                            <div className="flex items-center gap-4 text-xs">
                              <span className="font-medium">K<sub>eq</sub>(T) = <span className="font-mono">{eqResult.keqAtT.toPrecision(4)}</span></span>
                              <span className="font-medium">Q = <span className="font-mono">{eqResult.reactionQuotient.toPrecision(4)}</span></span>
                              <span className={`font-semibold ${
                                eqResult.direction === "forward" ? "text-green-700" :
                                eqResult.direction === "reverse" ? "text-orange-700" :
                                "text-gray-600"
                              }`}>
                                {eqResult.direction === "forward" ? "→ Shifts forward" :
                                 eqResult.direction === "reverse" ? "← Shifts reverse" :
                                 "At equilibrium"}
                              </span>
                            </div>
                          </div>

                          {/* ICE Table */}
                          {rxnResults && (
                            <ICETable
                              reaction={node.reaction}
                              initialConcentrations={Object.fromEntries(
                                rxnResults.map((r) => [r.substance.formula, r.moles / calcVolume])
                              )}
                              result={eqResult}
                            />
                          )}

                          {/* Le Chatelier */}
                          <LeChatelierDisplay shifts={eqResult.shifts} />
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">Click &quot;Calculate Equilibrium&quot; above to see results.</p>
                      )}
                    </section>
                  );
                })}

                {/* No equilibrium data message */}
                {!system.nodes.some((n) => n.reaction.equilibrium) && (
                  <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                    <p className="text-sm text-gray-500">
                      Add equilibrium constants to reactions to see ICE tables, equilibrium concentrations, and Le Chatelier analysis.
                    </p>
                  </section>
                )}
              </div>
            )}

            {/* Selectivity tab (v2 advanced) */}
            {activeTab === "selectivity" && mode === "advanced" && (
              <div className="space-y-4">
                <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-lg font-semibold text-gray-800">Selectivity &amp; Competing Reactions</h2>
                  <CompetingReactionsEditor
                    nodes={system.nodes}
                    competingSets={system.competingSets ?? []}
                    onChange={handleCompetingSetsChange}
                  />
                </section>

                {(system.competingSets ?? []).length > 0 && systemResult && (
                  <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-gray-800">Selectivity Results</h2>
                      <button
                        onClick={() => {
                          const results: SelectivityResult[] = [];
                          for (const set of system.competingSets ?? []) {
                            // Find total moles of shared reactant from system results
                            let sharedMoles = 0;
                            for (const [, rxnResults] of systemResult.perReaction) {
                              for (const r of rxnResults) {
                                if (r.substance.formula === set.sharedReactantFormula && r.substance.role === "reactant") {
                                  sharedMoles = Math.max(sharedMoles, r.moles);
                                }
                              }
                            }
                            if (sharedMoles > 0) {
                              try {
                                results.push(calculateSelectivity(system, set, sharedMoles));
                              } catch {
                                // skip failed calculations
                              }
                            }
                          }
                          setSelectivityResults(results);
                        }}
                        className="rounded-lg bg-teal-600 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-teal-700"
                      >
                        Calculate Selectivity
                      </button>
                    </div>
                    <SelectivityDashboard results={selectivityResults} />
                  </section>
                )}
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
        <p>ReactionIQ — v2.10 — April 2026</p>
        <p>Powered by Claude AI for reaction parsing and literature lookup</p>
        <p>
          Questions, suggestions, bug reports, or feature requests?{" "}
          <a
            href="mailto:luca.zullo@verdenero.com?subject=ReactionIQ%20Enquiry"
            className="text-teal-600 hover:text-teal-700 underline"
          >
            luca.zullo@verdenero.com
          </a>
        </p>
      </footer>
    </>
  );
}
