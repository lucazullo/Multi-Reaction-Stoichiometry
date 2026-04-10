"use client";

import { useState, useEffect } from "react";
import type { SessionMetadata } from "@/lib/session-storage";
import { listSessions, deleteSession as deleteSessionStorage } from "@/lib/session-storage";

interface SessionManagerProps {
  hasContent: boolean;
  currentSessionName: string | null; // name of the loaded session, null if new work
  onSave: (name: string) => void;    // save (new or overwrite)
  onLoad: (id: string) => void;
  onSessionLoaded: (name: string) => void; // notify parent of loaded session name
}

export default function SessionManager({
  hasContent,
  currentSessionName,
  onSave,
  onLoad,
  onSessionLoaded,
}: SessionManagerProps) {
  const [sessions, setSessions] = useState<SessionMetadata[]>([]);
  const [showSaveAs, setShowSaveAs] = useState(false);
  const [saveAsName, setSaveAsName] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [confirmLoadId, setConfirmLoadId] = useState<string | null>(null);
  const [confirmOverwriteName, setConfirmOverwriteName] = useState<string | null>(null);

  useEffect(() => {
    setSessions(listSessions());
  }, []);

  const refreshSessions = () => setSessions(listSessions());

  // Save (overwrite current session)
  const handleSaveOverwrite = () => {
    if (!currentSessionName) return;
    // Delete old, save new with same name
    const existing = sessions.find(
      (s) => s.name.toLowerCase() === currentSessionName.toLowerCase()
    );
    if (existing) deleteSessionStorage(existing.id);
    onSave(currentSessionName);
    refreshSessions();
  };

  // Save As (new name)
  const handleSaveAs = () => {
    const name = saveAsName.trim();
    if (!name) return;

    // Check collision
    const existing = sessions.find(
      (s) => s.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      setConfirmOverwriteName(name);
      return;
    }

    onSave(name);
    onSessionLoaded(name); // now working on this session
    setSaveAsName("");
    setShowSaveAs(false);
    refreshSessions();
  };

  const handleConfirmOverwrite = () => {
    if (!confirmOverwriteName) return;
    const existing = sessions.find(
      (s) => s.name.toLowerCase() === confirmOverwriteName.toLowerCase()
    );
    if (existing) deleteSessionStorage(existing.id);
    onSave(confirmOverwriteName);
    onSessionLoaded(confirmOverwriteName);
    setConfirmOverwriteName(null);
    setSaveAsName("");
    setShowSaveAs(false);
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
      doLoad(id);
    }
  };

  const doLoad = (id: string) => {
    const session = sessions.find((s) => s.id === id);
    onLoad(id);
    if (session) onSessionLoaded(session.name);
    setConfirmLoadId(null);
  };

  const handleConfirmLoad = () => {
    if (confirmLoadId) doLoad(confirmLoadId);
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
          {currentSessionName && (
            <span className="ml-2 text-xs font-normal text-gray-400">
              Working on: <span className="text-teal-600 font-medium">{currentSessionName}</span>
            </span>
          )}
        </button>

        {hasContent && (
          <div className="flex items-center gap-2">
            {currentSessionName && (
              <button
                onClick={handleSaveOverwrite}
                className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-teal-700"
                title={`Save over "${currentSessionName}"`}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                </svg>
                Save
              </button>
            )}
            <button
              onClick={() => { setShowSaveAs(!showSaveAs); setExpanded(true); setSaveAsName(""); }}
              className="flex items-center gap-1.5 rounded-lg border border-teal-300 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 transition hover:bg-teal-100"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Save As
            </button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="px-6 py-4 space-y-3">
          {/* Save As form */}
          {showSaveAs && (
            <div className="flex gap-2">
              <input
                type="text"
                value={saveAsName}
                onChange={(e) => setSaveAsName(e.target.value)}
                placeholder="Session name, e.g. 'Urea from natural gas'"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none"
                onKeyDown={(e) => e.key === "Enter" && handleSaveAs()}
                autoFocus
              />
              <button
                onClick={handleSaveAs}
                disabled={!saveAsName.trim()}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => setShowSaveAs(false)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Sessions list */}
          {sessions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-2">
              No saved sessions yet.
            </p>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 transition ${
                    currentSessionName === session.name
                      ? "border-teal-300 bg-teal-50"
                      : "border-gray-150 bg-gray-50 hover:bg-gray-100"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {session.name}
                      {currentSessionName === session.name && (
                        <span className="ml-2 text-xs text-teal-600">(current)</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {session.reactionCount} reaction{session.reactionCount !== 1 ? "s" : ""} — {formatDate(session.savedAt)}
                    </p>
                    <p className="text-xs text-gray-400 font-mono truncate">
                      {session.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    {currentSessionName !== session.name && (
                      <button
                        onClick={() => handleLoad(session.id)}
                        className="rounded-lg bg-teal-50 border border-teal-200 px-3 py-1.5 text-xs font-medium text-teal-700 transition hover:bg-teal-100"
                      >
                        Load
                      </button>
                    )}
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
              Loading will replace your current work. Unsaved changes will be lost.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmLoadId(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleConfirmLoad} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">Load</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm overwrite modal */}
      {confirmOverwriteName && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setConfirmOverwriteName(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-amber-700">Overwrite Session?</h3>
            <p className="text-sm text-gray-600">
              A session named <span className="font-semibold">&ldquo;{confirmOverwriteName}&rdquo;</span> already exists. Replace it?
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmOverwriteName(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleConfirmOverwrite} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700">Overwrite</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
