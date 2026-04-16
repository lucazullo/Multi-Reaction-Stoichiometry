"use client";

import { useState } from "react";
import type { BalancedReaction, LookupResponse, RateLaw, EquilibriumData, Reference } from "@/lib/types";
import { normalizeFormula } from "@/lib/utils";

interface LookupButtonProps {
  reaction: BalancedReaction;
  onRateLawFound: (rateLaw: RateLaw, references: Reference[]) => void;
  onEquilibriumFound: (equilibrium: EquilibriumData, references: Reference[]) => void;
  onNotesFound?: (notes: string) => void;
}

export default function LookupButton({ reaction, onRateLawFound, onEquilibriumFound, onNotesFound }: LookupButtonProps) {
  const [loading, setLoading] = useState(false);
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [result, setResult] = useState<LookupResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLookup = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/lookup-reaction-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equation: reaction.equation,
          reactants: reaction.reactants.map((r) => r.formula),
          products: reaction.products.map((p) => p.formula),
          useWebSearch,
          requestedData: ["kinetics", "equilibrium"],
        }),
      });
      const data: LookupResponse = await res.json();

      if (!data.success) {
        setError(data.error || "No data found.");
        return;
      }

      setResult(data);

      // Pass found data up to parent
      if (data.rateLaw) {
        // Keep source and confidence on the rateLaw object so they persist
        const { source, confidence, ...rest } = data.rateLaw;
        // Re-key partialOrders to match the reaction's Unicode formulas
        // Claude returns ASCII keys (e.g. "C2H5OH") but the app uses Unicode ("C₂H₅OH")
        if (rest.partialOrders) {
          const rekeyed: Record<string, number> = {};
          const allReactants = reaction.reactants;
          for (const [asciiKey, order] of Object.entries(rest.partialOrders)) {
            const normalizedKey = normalizeFormula(asciiKey);
            const match = allReactants.find(r => normalizeFormula(r.formula) === normalizedKey);
            rekeyed[match ? match.formula : asciiKey] = order;
          }
          rest.partialOrders = rekeyed;
        }
        onRateLawFound({ ...rest, source, confidence }, data.references);
      }
      if (data.equilibrium) {
        const { source, confidence, ...rest } = data.equilibrium;
        onEquilibriumFound({ ...rest, source, confidence }, data.references);
      }
      if (data.additionalNotes && onNotesFound) {
        onNotesFound(data.additionalNotes);
      }
    } catch {
      setError("Network error during lookup.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          onClick={handleLookup}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
        >
          {loading ? (
            <>
              <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
              </svg>
              Searching{useWebSearch ? " (web)" : ""}...
            </>
          ) : (
            <>
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              Look up parameters
            </>
          )}
        </button>

        <label className="flex items-center gap-1 text-[10px] text-gray-500">
          <input
            type="checkbox"
            checked={useWebSearch}
            onChange={(e) => setUseWebSearch(e.target.checked)}
            className="h-3 w-3 rounded border-gray-300 accent-teal-600"
          />
          Include web search
        </label>
      </div>

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
