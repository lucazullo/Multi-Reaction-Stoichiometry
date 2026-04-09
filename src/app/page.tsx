"use client";

import { useState } from "react";
import type {
  BalancedReaction,
  CalculationInput,
  CalculationResult,
  EconomicsSummary,
  EnergyUnit,
  ParseReactionResponse,
  PriceEntry,
  ThermodynamicsResult,
} from "@/lib/types";
import {
  calculateStoichiometry,
  calculateEconomics,
  calculateThermodynamics,
} from "@/lib/conversion";
import {
  generateQuantitiesCSV,
  generateThermodynamicsCSV,
  generateEconomicsCSV,
  generateFullCSV,
  downloadCSV,
} from "@/lib/export";
import ReactionInput from "@/components/ReactionInput";
import EquationDisplay from "@/components/EquationDisplay";
import SubstanceSelector from "@/components/SubstanceSelector";
import ResultsTable from "@/components/ResultsTable";
import ErrorMessage from "@/components/ErrorMessage";
import PriceInputs from "@/components/PriceInputs";
import EconomicsDisplay from "@/components/EconomicsDisplay";
import ThermodynamicsDisplay from "@/components/ThermodynamicsDisplay";
import DownloadButton from "@/components/DownloadButton";

export default function Home() {
  const [reaction, setReaction] = useState<BalancedReaction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CalculationResult[] | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [thermodynamics, setThermodynamics] =
    useState<ThermodynamicsResult | null>(null);
  const [economics, setEconomics] = useState<EconomicsSummary | null>(null);
  const [energyUnit, setEnergyUnit] = useState<EnergyUnit>("kJ");

  const handleParseReaction = async (description: string) => {
    setLoading(true);
    setError(null);
    setReaction(null);
    setResults(null);
    setThermodynamics(null);
    setEconomics(null);

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

      setReaction(data.data);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCalculate = (input: CalculationInput) => {
    if (!reaction) return;
    try {
      const res = calculateStoichiometry(reaction, input);
      setResults(res);
      setSelectedIndex(input.substanceIndex);

      const thermo = calculateThermodynamics(reaction, res);
      setThermodynamics(thermo);

      setEconomics(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Calculation error.");
    }
  };

  const handleEconomicsCalculate = (prices: Map<number, PriceEntry>) => {
    if (!results) return;
    try {
      const econ = calculateEconomics(results, prices);
      setEconomics(econ);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Economics calculation error.");
    }
  };

  const handleDownloadQuantities = () => {
    if (!results) return;
    downloadCSV(generateQuantitiesCSV(results), "stoichiometry-quantities.csv");
  };

  const handleDownloadThermodynamics = () => {
    if (!thermodynamics || !results) return;
    const selResult = results[selectedIndex];
    downloadCSV(
      generateThermodynamicsCSV(thermodynamics, energyUnit, selResult),
      "stoichiometry-thermodynamics.csv"
    );
  };

  const handleDownloadEconomics = () => {
    if (!economics) return;
    downloadCSV(generateEconomicsCSV(economics), "stoichiometry-economics.csv");
  };

  const handleDownloadAll = () => {
    if (!results) return;
    const csv = generateFullCSV(
      results,
      thermodynamics,
      economics,
      energyUnit,
      selectedIndex
    );
    downloadCSV(csv, "stoichiometry-full-report.csv");
  };

  const handleReset = () => {
    setReaction(null);
    setResults(null);
    setError(null);
    setSelectedIndex(0);
    setThermodynamics(null);
    setEconomics(null);
  };

  return (
    <>
      <header className="bg-gradient-to-r from-slate-800 via-teal-900 to-slate-800 px-6 py-10 text-center text-white">
        <h1 className="text-3xl font-bold tracking-tight">
          Stoichiometry Calculator
        </h1>
        <p className="mt-2 text-sm text-teal-200">
          Describe a reaction in plain English. Get a balanced equation and
          calculate quantities in any unit.
        </p>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <ReactionInput onSubmit={handleParseReaction} loading={loading} />
        </section>

        {error && (
          <section>
            <ErrorMessage message={error} />
          </section>
        )}

        {reaction && (
          <>
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-800">
                  Balanced Equation
                </h2>
                <button
                  onClick={handleReset}
                  className="text-xs text-gray-400 hover:text-gray-600 transition"
                >
                  Start over
                </button>
              </div>
              <EquationDisplay reaction={reaction} />
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-800">
                Calculate Quantities
              </h2>
              <SubstanceSelector
                reaction={reaction}
                onCalculate={handleCalculate}
              />
            </section>

            {results && (
              <>
                <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-800">
                      Results
                    </h2>
                    <DownloadButton onClick={handleDownloadQuantities} />
                  </div>
                  <ResultsTable
                    results={results}
                    selectedIndex={selectedIndex}
                  />
                </section>

                {thermodynamics && results[selectedIndex] && (
                  <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-gray-800">
                        Thermodynamics
                      </h2>
                      <DownloadButton onClick={handleDownloadThermodynamics} />
                    </div>
                    <ThermodynamicsDisplay
                      thermodynamics={thermodynamics}
                      energyUnit={energyUnit}
                      onEnergyUnitChange={setEnergyUnit}
                      selectedResult={results[selectedIndex]}
                    />
                  </section>
                )}

                <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-lg font-semibold text-gray-800">
                    Economics
                  </h2>
                  <PriceInputs
                    reaction={reaction}
                    onCalculate={handleEconomicsCalculate}
                  />
                </section>

                {economics && (
                  <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-gray-800">
                        Cost Analysis
                      </h2>
                      <DownloadButton onClick={handleDownloadEconomics} />
                    </div>
                    <EconomicsDisplay economics={economics} />
                  </section>
                )}

                {/* Download All */}
                <div className="flex justify-center">
                  <button
                    onClick={handleDownloadAll}
                    className="flex items-center gap-2 rounded-lg bg-slate-700 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    <svg
                      className="h-4 w-4"
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
                    Download Full Report (CSV)
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </main>

      <footer className="border-t border-gray-100 py-4 text-center text-xs text-gray-400">
        Powered by Claude AI for reaction parsing
      </footer>
    </>
  );
}
