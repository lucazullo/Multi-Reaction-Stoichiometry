"use client";

import type { AppMode } from "@/lib/types";

interface ModeToggleProps {
  mode: AppMode;
  onChange: (mode: AppMode) => void;
}

export default function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex rounded-lg border border-gray-300 bg-white overflow-hidden text-sm">
        <button
          onClick={() => onChange("basic")}
          className={`px-3 py-1.5 font-medium transition ${
            mode === "basic"
              ? "bg-teal-600 text-white"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          Basic
        </button>
        <button
          onClick={() => onChange("advanced")}
          className={`px-3 py-1.5 font-medium transition ${
            mode === "advanced"
              ? "bg-teal-600 text-white"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          Advanced
        </button>
      </div>
    </div>
  );
}
