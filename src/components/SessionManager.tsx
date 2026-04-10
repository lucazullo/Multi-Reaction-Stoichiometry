"use client";

import { useState, useEffect } from "react";
import type { SessionMetadata } from "@/lib/session-storage";
import { listSessions, deleteSession as deleteSessionStorage } from "@/lib/session-storage";

interface SessionManagerProps {
  hasContent: boolean; // whether there's anything to save
  onSave: (name: string) => void;
  onLoad: (id: string) => void;
}

export default function SessionManager({
  hasContent,
  onSave,
  onLoad,
}: SessionManagerProps) {
  const [sessions, setSessions] = useState<SessionMetadata[]>([]);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [confirmLoadId, setConfirmLoadId] = useState<string | null>(null);

  // Load session list on mount and after changes
  useEffect(() => {
    setSessions(listSessions());
  }, []);

  const refreshSessions = () => setSessions(listSessions());

  const handleSave = () => {
    if (!saveName.trim()) return;
    onSave(saveName.trim());
    setSaveName("");
    setShowSaveForm(false);
    refreshSessions();
  };

  const handleDelete = (id: string) => {
    deleteSessionStorage(id);
    refreshSessions();
  };

  const handleLoad = (id: string) => {
    if (hasContent) {
      setConfirmLoadId(id);
    } else {
      onLoad(id);
      setConfirmLoadId(null);
    }
  };

  const handleConfirmLoad = () => {
    if (confirmLoadId) {
      onLoad(confirmLoadId);
      setConfirmLoadId(null);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-slate-50 border-b border-gray-200">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm font-semibold text-gray-700"
        >
          <svg
            className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          Saved Sessions
          {sessions.length > 0 && (
            <span className="rounded-full bg-teal-100 text-teal-700 px-2 py-0.5 text-xs font-medium">
              {sessions.length}
            </span>
          )}
        </button>

        {hasContent && (
          <button
            onClick={() => { setShowSaveForm(!showSaveForm); setExpanded(true); }}
            className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-teal-700"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
            </svg>
            Save Current
          </button>
        )}
      </div>

      {expanded && (
        <div className="px-6 py-4 space-y-3">
          {/* Save form */}
          {showSaveForm && (
            <div className="flex gap-2">
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Session name, e.g. 'Urea from natural gas'"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none"
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                autoFocus
              />
              <button
                onClick={handleSave}
                disabled={!saveName.trim()}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => setShowSaveForm(false)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Sessions list */}
          {sessions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-2">
              No saved sessions yet. Set up a reaction system and click "Save Current".
            </p>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between rounded-lg border border-gray-150 bg-gray-50 px-4 py-3 hover:bg-gray-100 transition"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {session.name}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {session.reactionCount} reaction{session.reactionCount !== 1 ? "s" : ""} — {formatDate(session.savedAt)}
                    </p>
                    <p className="text-xs text-gray-400 font-mono truncate">
                      {session.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    <button
                      onClick={() => handleLoad(session.id)}
                      className="rounded-lg bg-teal-50 border border-teal-200 px-3 py-1.5 text-xs font-medium text-teal-700 transition hover:bg-teal-100"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => handleDelete(session.id)}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirm load modal */}
      {confirmLoadId && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setConfirmLoadId(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-800">Load Session?</h3>
            <p className="text-sm text-gray-600">
              Loading a saved session will replace your current work. Any unsaved changes will be lost.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmLoadId(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmLoad}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
              >
                Load
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
