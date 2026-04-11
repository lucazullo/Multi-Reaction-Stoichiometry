"use client";

import { useState } from "react";
import type { ReactionNode } from "@/lib/types";
import EquationDisplay from "./EquationDisplay";

interface ReactionCardProps {
  node: ReactionNode;
  index: number;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

export default function ReactionCard({
  node,
  index,
  onDelete,
  onRename,
}: ReactionCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(node.displayName ?? "");

  const displayTitle = node.displayName
    ? `Reaction ${index + 1} — ${node.displayName}`
    : `Reaction ${index + 1}`;

  const handleSaveName = () => {
    onRename(node.id, nameInput.trim());
    setEditing(false);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
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
          <button
            onClick={() => { setEditing(!editing); setNameInput(node.displayName ?? ""); }}
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
      {editing && (
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
            onClick={() => setEditing(false)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      )}
      {!collapsed && (
        <div className="p-6">
          <EquationDisplay reaction={node.reaction} />
        </div>
      )}
    </div>
  );
}
