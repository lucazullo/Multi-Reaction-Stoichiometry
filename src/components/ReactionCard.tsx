"use client";

import { useState } from "react";
import type { ReactionNode } from "@/lib/types";
import EquationDisplay from "./EquationDisplay";

interface ReactionCardProps {
  node: ReactionNode;
  index: number;
  onDelete: (id: string) => void;
}

export default function ReactionCard({
  node,
  index,
  onDelete,
}: ReactionCardProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-b border-gray-200">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900"
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
          Reaction {index + 1}
          <span className="font-normal text-gray-400 text-xs ml-1 truncate max-w-xs">
            {node.label}
          </span>
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
      {!collapsed && (
        <div className="p-6">
          <EquationDisplay reaction={node.reaction} />
        </div>
      )}
    </div>
  );
}
