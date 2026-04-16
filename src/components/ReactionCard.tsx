"use client";

import { useState, useMemo } from "react";
import type { BalancedReaction, ReactionNode } from "@/lib/types";
import { checkReactionBalance } from "@/lib/utils";
import EquationDisplay from "./EquationDisplay";
import StoichiometryEditor from "./StoichiometryEditor";

/** Default tolerance: imbalances below this are silently accepted */
const AUTO_ACCEPT_TOLERANCE = 1e-4;

interface ReactionCardProps {
  node: ReactionNode;
  index: number;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onEditReaction?: (id: string, reaction: BalancedReaction) => void;
}

export default function ReactionCard({
  node,
  index,
  onDelete,
  onRename,
  onEditReaction,
}: ReactionCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [namingMode, setNamingMode] = useState(false);
  const [nameInput, setNameInput] = useState(node.displayName ?? "");
  const [editingStoich, setEditingStoich] = useState(false);
  const [balanceAccepted, setBalanceAccepted] = useState(false);

  const balanceCheck = useMemo(
    () => checkReactionBalance(node.reaction.reactants, node.reaction.products),
    [node.reaction.reactants, node.reaction.products]
  );

  // Show warning only if there are imbalances the user hasn't accepted
  const showBalanceWarning = !balanceCheck.balanced && !balanceAccepted;

  const displayTitle = node.displayName
    ? `Reaction ${index + 1} \u2014 ${node.displayName}`
    : `Reaction ${index + 1}`;

  const handleSaveName = () => {
    onRename(node.id, nameInput.trim());
    setNamingMode(false);
  };

  const handleSaveStoich = (updatedReaction: BalancedReaction) => {
    onEditReaction?.(node.id, updatedReaction);
    setEditingStoich(false);
    setBalanceAccepted(false); // re-evaluate after edit
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900 flex-shrink-0"
          >
            <svg
              className={`h-4 w-4 transition-transform ${collapsed ? "" : "rotate-90"}`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            {displayTitle}
          </button>
          <span className="font-normal text-gray-400 text-xs truncate max-w-xs">
            {node.label}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {onEditReaction && (
            <button
              onClick={() => setEditingStoich(!editingStoich)}
              className={`transition p-1 ${editingStoich ? "text-amber-600" : "text-gray-400 hover:text-amber-600"}`}
              title="Edit stoichiometry"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
              </svg>
            </button>
          )}
          <button
            onClick={() => { setNamingMode(!namingMode); setNameInput(node.displayName ?? ""); }}
            className="text-gray-400 hover:text-teal-600 transition p-1"
            title="Name this reaction"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(node.id)}
            className="text-gray-400 hover:text-red-500 transition p-1"
            title="Remove reaction"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Rename bar */}
      {namingMode && (
        <div className="flex gap-2 px-6 py-2 bg-gray-50 border-b border-gray-100">
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="e.g. Boudouard Reaction"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none"
            onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
            autoFocus
          />
          <button
            onClick={handleSaveName}
            className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700"
          >
            Save
          </button>
          <button
            onClick={() => setNamingMode(false)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Normal view */}
      {!collapsed && !editingStoich && (
        <div className="p-6">
          <EquationDisplay reaction={node.reaction} />
          {showBalanceWarning && (
            <div className="mt-3 rounded-lg bg-amber-50 border border-amber-300 p-3">
              <div className="flex items-start gap-2">
                <span className="text-amber-600 flex-shrink-0 mt-0.5">{"\u26A0\uFE0F"}</span>
                <div className="text-sm flex-1">
                  <p className="font-semibold text-amber-800">Unbalanced equation</p>
                  <p className="text-amber-700 mt-1">
                    {balanceCheck.imbalances.map((im) => (
                      <span key={im.atom} className="inline-block mr-3">
                        <span className="font-mono font-semibold">{im.atom}</span>:{" "}
                        <span className="text-amber-500 font-mono">
                          {im.delta > 0 ? "+" : ""}{im.delta.toPrecision(4)}
                        </span>
                      </span>
                    ))}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <p className="text-amber-600 text-xs">
                      This will cause a mass balance discrepancy.
                    </p>
                    <button
                      onClick={() => setBalanceAccepted(true)}
                      className="text-xs font-medium text-amber-700 hover:text-amber-900 underline"
                    >
                      Accept
                    </button>
                    {onEditReaction && (
                      <button
                        onClick={() => setEditingStoich(true)}
                        className="text-xs font-medium text-amber-700 hover:text-amber-900 underline"
                      >
                        Fix stoichiometry
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stoichiometry editor */}
      {!collapsed && editingStoich && (
        <div className="p-6">
          <StoichiometryEditor
            reaction={node.reaction}
            onSave={handleSaveStoich}
            onCancel={() => setEditingStoich(false)}
          />
        </div>
      )}
    </div>
  );
}
