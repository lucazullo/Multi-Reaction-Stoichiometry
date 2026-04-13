import type {
  CalculationInput,
  EnergyUnit,
  ReactionSystem,
  SystemCalculationResult,
  SystemEconomics,
  SystemThermodynamics,
  CalculationResult,
  ThermodynamicsResult,
} from "./types";

// --- Session Types ---

export interface SessionMetadata {
  id: string;
  name: string;
  savedAt: string; // ISO date
  reactionCount: number;
  description: string; // auto-generated from equations
}

export interface SessionSnapshot {
  metadata: SessionMetadata;
  system: ReactionSystem;
  systemResult: SerializedSystemResult | null;
  systemThermo: SerializedSystemThermo | null;
  systemEcon: SystemEconomics | null;
  energyUnit: EnergyUnit;
  startReactionId: string | null;
  startInput: CalculationInput | null;
  nextNodeId: number;
  nextLinkId: number;
  savedPrices?: Array<{ value: string; unit: string }>;
}

// Serialized versions with Map → entries array
interface SerializedSystemResult {
  perReaction: Array<[string, CalculationResult[]]>;
  totals: SystemCalculationResult["totals"];
}

interface SerializedSystemThermo {
  perReaction: Array<[string, ThermodynamicsResult]>;
  totalDeltaH: number;
  isExothermic: boolean;
}

/** What loadSession() returns — with Maps reconstructed */
export interface LoadedSession {
  metadata: SessionMetadata;
  system: ReactionSystem;
  systemResult: SystemCalculationResult | null;
  systemThermo: SystemThermodynamics | null;
  systemEcon: SystemEconomics | null;
  energyUnit: EnergyUnit;
  startReactionId: string | null;
  startInput: CalculationInput | null;
  nextNodeId: number;
  nextLinkId: number;
  savedPrices?: Array<{ value: string; unit: string }>;
}

// --- Keys ---

const SESSIONS_INDEX_KEY = "stoich-sessions";
const SESSION_PREFIX = "stoich-session-";

// --- Serialization Helpers ---

function serializeResult(
  result: SystemCalculationResult
): SerializedSystemResult {
  return {
    perReaction: Array.from(result.perReaction.entries()),
    totals: result.totals,
  };
}

function deserializeResult(
  data: SerializedSystemResult & { balanceCheck?: SystemCalculationResult["balanceCheck"] }
): SystemCalculationResult {
  return {
    perReaction: new Map(data.perReaction),
    totals: data.totals,
    balanceCheck: data.balanceCheck ?? {
      atoms: [],
      mass: { totalMassIn: 0, totalMassOut: 0, delta: 0, deltaPercent: 0, balanced: true },
      allBalanced: true,
    },
  };
}

function serializeThermo(
  thermo: SystemThermodynamics
): SerializedSystemThermo {
  return {
    perReaction: Array.from(thermo.perReaction.entries()),
    totalDeltaH: thermo.totalDeltaH,
    isExothermic: thermo.isExothermic,
  };
}

function deserializeThermo(
  data: SerializedSystemThermo
): SystemThermodynamics {
  return {
    perReaction: new Map(data.perReaction),
    totalDeltaH: data.totalDeltaH,
    isExothermic: data.isExothermic,
  };
}

// --- CRUD ---

export function listSessions(): SessionMetadata[] {
  try {
    const raw = localStorage.getItem(SESSIONS_INDEX_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SessionMetadata[];
  } catch {
    return [];
  }
}

export function saveSession(snapshot: SessionSnapshot): void {
  // Save the session data
  const key = SESSION_PREFIX + snapshot.metadata.id;
  const serialized = {
    ...snapshot,
    systemResult: snapshot.systemResult
      ? serializeResult(snapshot.systemResult as unknown as SystemCalculationResult)
      : null,
    systemThermo: snapshot.systemThermo
      ? serializeThermo(snapshot.systemThermo as unknown as SystemThermodynamics)
      : null,
  };
  localStorage.setItem(key, JSON.stringify(serialized));

  // Update the index
  const sessions = listSessions().filter(
    (s) => s.id !== snapshot.metadata.id
  );
  sessions.unshift(snapshot.metadata);
  localStorage.setItem(SESSIONS_INDEX_KEY, JSON.stringify(sessions));
}

// Ensure substances from older sessions have new fields
function migrateSubstance(s: Record<string, unknown>): void {
  if (s.densityGas === undefined) s.densityGas = null;
  if (s.hhv === undefined) s.hhv = null;
  if (s.lhv === undefined) s.lhv = null;
  if (s.enthalpyOfFormation === undefined) s.enthalpyOfFormation = 0;
}

function migrateSystem(system: ReactionSystem): void {
  for (const node of system.nodes) {
    for (const s of [...node.reaction.reactants, ...node.reaction.products]) {
      migrateSubstance(s as unknown as Record<string, unknown>);
    }
  }
}

export function loadSession(id: string): LoadedSession | null {
  try {
    const key = SESSION_PREFIX + id;
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const data = JSON.parse(raw);

    // Migrate older sessions to include new fields
    if (data.system) migrateSystem(data.system);

    // Reconstruct Maps from serialized entries
    return {
      ...data,
      systemResult: data.systemResult
        ? deserializeResult(data.systemResult)
        : null,
      systemThermo: data.systemThermo
        ? deserializeThermo(data.systemThermo)
        : null,
    } as LoadedSession;
  } catch {
    return null;
  }
}

export function deleteSession(id: string): void {
  localStorage.removeItem(SESSION_PREFIX + id);
  const sessions = listSessions().filter((s) => s.id !== id);
  localStorage.setItem(SESSIONS_INDEX_KEY, JSON.stringify(sessions));
}

// --- File Export/Import ---

/** Export a session as a JSON file download.
 *  Uses File System Access API (Save As dialog) in Chrome/Edge,
 *  falls back to regular download in Safari/Firefox. */
export async function exportSessionToFile(id: string): Promise<void> {
  const key = SESSION_PREFIX + id;
  const raw = localStorage.getItem(key);
  if (!raw) return;

  const data = JSON.parse(raw);
  const filename = `${(data.metadata?.name ?? "session").replace(/[^a-zA-Z0-9_-]/g, "_")}.stoich.json`;
  const content = JSON.stringify(data, null, 2);
  const blob = new Blob([content], { type: "application/json" });

  // Try File System Access API (shows Save As dialog — Chrome/Edge only)
  if ("showSaveFilePicker" in window) {
    try {
      const handle = await (window as unknown as { showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: "Stoichiometry Session",
          accept: { "application/json": [".stoich.json", ".json"] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch {
      // User cancelled or API failed — fall through to regular download
    }
  }

  // Fallback: regular download (goes to browser's download folder)
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Import a session from a JSON file and save to localStorage.
 *  Returns the session metadata on success, null on failure. */
export function importSessionFromFile(file: File): Promise<SessionMetadata | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);

        // Validate basic structure
        if (!data.metadata || !data.system || !data.system.nodes) {
          resolve(null);
          return;
        }

        // Assign a new ID to avoid collisions
        const newId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        data.metadata.id = newId;
        data.metadata.savedAt = new Date().toISOString();

        // Migrate older formats
        if (data.system) migrateSystem(data.system);

        // Save to localStorage
        const key = SESSION_PREFIX + newId;
        localStorage.setItem(key, JSON.stringify(data));

        // Update index
        const sessions = listSessions();
        sessions.unshift(data.metadata as SessionMetadata);
        localStorage.setItem(SESSIONS_INDEX_KEY, JSON.stringify(sessions));

        resolve(data.metadata as SessionMetadata);
      } catch {
        resolve(null);
      }
    };
    reader.onerror = () => resolve(null);
    reader.readAsText(file);
  });
}

// --- Snapshot Creation Helper ---

export function createSnapshot(
  name: string,
  system: ReactionSystem,
  systemResult: SystemCalculationResult | null,
  systemThermo: SystemThermodynamics | null,
  systemEcon: SystemEconomics | null,
  energyUnit: EnergyUnit,
  startReactionId: string | null,
  startInput: CalculationInput | null,
  nextNodeId: number,
  nextLinkId: number,
  savedPrices?: Array<{ value: string; unit: string }>,
  existingId?: string
): SessionSnapshot {
  const equations = system.nodes
    .map((n) => n.reaction.equation)
    .join(" | ");
  const description =
    equations.length > 80 ? equations.slice(0, 77) + "..." : equations;

  return {
    metadata: {
      id: existingId ?? `session-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      savedAt: new Date().toISOString(),
      reactionCount: system.nodes.length,
      description,
    },
    system,
    systemResult: systemResult
      ? serializeResult(systemResult)
      : null,
    systemThermo: systemThermo
      ? serializeThermo(systemThermo)
      : null,
    systemEcon,
    energyUnit,
    startReactionId,
    startInput,
    nextNodeId,
    nextLinkId,
    savedPrices,
  };
}
