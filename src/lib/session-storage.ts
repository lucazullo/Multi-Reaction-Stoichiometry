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
  data: SerializedSystemResult
): SystemCalculationResult {
  return {
    perReaction: new Map(data.perReaction),
    totals: data.totals,
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

export function loadSession(id: string): LoadedSession | null {
  try {
    const key = SESSION_PREFIX + id;
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const data = JSON.parse(raw);

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
