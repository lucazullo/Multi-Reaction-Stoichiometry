"use client";

import { useState } from "react";
import LoadingSpinner from "./LoadingSpinner";

const EXAMPLES = [
  "Hydrogen reacts with oxygen to form water",
  "Methane burns in oxygen",
  "Iron rusts in the presence of oxygen and water",
  "Photosynthesis: carbon dioxide and water produce glucose and oxygen",
];

interface ReactionInputProps {
  onSubmit: (description: string) => void;
  loading: boolean;
}

export default function ReactionInput({
  onSubmit,
  loading,
}: ReactionInputProps) {
  const [text, setText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && !loading) {
      onSubmit(text.trim());
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Describe a chemical reaction, e.g. 'hydrogen reacts with oxygen to form water'"
          className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none"
          disabled={loading}
          maxLength={500}
        />
        <button
          type="submit"
          disabled={loading || !text.trim()}
          className="rounded-lg bg-teal-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Parsing..." : "Balance"}
        </button>
      </form>

      {loading && <LoadingSpinner />}

      <div className="space-y-2">
        <p className="text-xs text-gray-500">Try an example:</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              onClick={() => {
                setText(example);
                if (!loading) onSubmit(example);
              }}
              disabled={loading}
              className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600 transition hover:bg-teal-50 hover:border-teal-300 hover:text-teal-700 disabled:opacity-50"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
