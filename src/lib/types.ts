export type PhysicalState = "solid" | "liquid" | "gas" | "aqueous";

export interface Substance {
  formula: string;
  name: string;
  coefficient: number;
  molarMass: number; // g/mol
  state: PhysicalState;
  density: number | null; // g/mL (= kg/L) at 25°C for solids/liquids; null if unknown
  densityGas: number | null; // kg/m³ at STP (0°C, 1 atm) for gases; null for non-gases
  hhv: number | null; // Higher Heating Value in kJ/kg; null if not combustible
  lhv: number | null; // Lower Heating Value in kJ/kg; null if not combustible
  enthalpyOfFormation: number; // kJ/mol, standard ΔHf°
  role: "reactant" | "product";
}

export interface BalancedReaction {
  equation: string; // e.g. "2H₂ + O₂ → 2H₂O"
  reactants: Substance[];
  products: Substance[];
  // --- v2 additions (all optional — undefined = v1 behavior) ---
  rateLaw?: RateLaw;
  equilibrium?: EquilibriumData;
  conversion?: number; // 0–1 fractional conversion of limiting reactant; undefined = 1.0 (complete)
  references?: Reference[]; // literature sources for kinetic/equilibrium data
  lookupNotes?: string; // additional caveats/notes from literature lookup
}

// --- v2: Kinetics ---

export type DataConfidence = "high" | "medium" | "low";

export interface RateLaw {
  expression: string;              // display string, e.g. "k[A][B]"
  order: number;                   // overall reaction order
  partialOrders: Record<string, number>; // formula → partial order
  rateConstant: number;            // k at referenceTemperature
  rateConstantUnit: string;        // e.g. "L/(mol·s)" for 2nd order
  referenceTemperature: number;    // K, typically 298.15
  activationEnergy: number;        // Ea in kJ/mol
  preExponentialFactor: number;    // A (same units as k)
  source?: string;                 // literature source description
  confidence?: DataConfidence;     // confidence in the data
}

export interface KineticsResult {
  reactionId: string;
  timePoints: number[];                    // seconds
  concentrations: Record<string, number[]>; // formula → [c] at each time point
  halfLife: number | null;                 // seconds, if applicable
  reversible: boolean;                     // true if equilibrium was considered
  keqAtT: number | null;                   // Keq(T) used, if reversible
  kReverseAtT: number | null;              // k_reverse at T, if reversible
  rateAtT: number;                         // rate at calculation temperature
  rateConstantAtT: number;                 // k(T) via Arrhenius
}

// --- v2: Equilibrium ---

export interface EquilibriumData {
  keq: number;                   // equilibrium constant at referenceTemperature
  referenceTemperature: number;  // K
  deltaH: number;                // kJ/mol — for van't Hoff temperature dependence
  source?: string;               // literature source description
  confidence?: DataConfidence;   // confidence in the data
}

export interface LeChatelierShift {
  perturbation: string;          // e.g. "Increase temperature"
  direction: "forward" | "reverse";
  explanation: string;
}

export interface EquilibriumResult {
  reactionId: string;
  keqAtT: number;                                  // Keq at calculation temperature
  equilibriumConcentrations: Record<string, number>; // formula → [c]_eq in mol/L
  reactionQuotient: number;                         // Q for current state
  direction: "forward" | "reverse" | "at-equilibrium";
  shifts: LeChatelierShift[];
}

// --- v2: Selectivity ---

export interface CompetingReactionSet {
  id: string;
  label: string;                   // e.g. "Ethylene oxidation pathways"
  primaryReactionId: string;       // desired reaction
  competingReactionIds: string[];  // undesired side reactions
  sharedReactantFormula: string;   // key shared reactant that splits between them
  allocations: Record<string, number>; // reactionId → fraction (0–1), must sum ≤ 1.0
}

export interface SelectivityResult {
  competingSetId: string;
  desiredProduct: { formula: string; name: string; moles: number };
  coProducts: Array<{
    formula: string;
    name: string;
    moles: number;
    fromReactionId: string;
    reactionLabel: string;
  }>;
  selectivity: number;   // moles desired / (moles desired + moles undesired)
  yield: number;         // moles desired / moles reactant fed
  atomEconomy: number;   // MW desired × coeff / sum(MW all products × coeff)
}

// --- v2: Literature References ---

export interface Reference {
  citation: string;      // e.g. "Smith, J. et al. (2024). J. Phys. Chem. A, 128(3), 456-462"
  url: string | null;    // link to online source (DOI, NIST page, etc.)
  dataType: string;      // what this reference supports, e.g. "rate constant", "Keq"
}

// --- v2: Literature Lookup API ---

export interface LookupRequest {
  equation: string;
  reactants: string[];
  products: string[];
  useWebSearch: boolean;
  requestedData: ("kinetics" | "equilibrium" | "thermodynamic")[];
}

export interface LookupResponse {
  success: boolean;
  rateLaw?: RateLaw & { source: string; confidence: "high" | "medium" | "low" };
  equilibrium?: EquilibriumData & { source: string; confidence: "high" | "medium" | "low" };
  references: Reference[];
  additionalNotes?: string;
  error?: string;
}

export type MassUnit = "g" | "kg" | "lb";
export type VolumeUnit = "L" | "gal";
export type AmountUnit = "mol" | MassUnit | VolumeUnit;

export interface CalculationInput {
  substanceIndex: number;
  amount: number;
  unit: AmountUnit;
}

export interface CalculationResult {
  substance: Substance;
  moles: number;
  grams: number;
  kilograms: number;
  pounds: number;
  liters: number | null;
  gallons: number | null;
}

export type EnergyUnit = "kJ" | "BTU";

export interface PriceEntry {
  price: number | null; // null = not specified = $0
  unit: AmountUnit;
}

export interface EconomicsResult {
  substance: Substance;
  pricePerUnit: number | null;
  priceUnit: AmountUnit;
  totalCost: number;
  role: "reactant" | "product";
}

export interface EconomicsSummary {
  perSubstance: EconomicsResult[];
  reactantCost: number;
  productValue: number;
  delta: number; // productValue - reactantCost (positive = profit)
}

export interface ThermodynamicsResult {
  deltaH: number; // total ΔHrxn for the batch in kJ
  isExothermic: boolean;
  perSubstance: Array<{
    substance: Substance;
    moles: number;
    enthalpyOfFormation: number; // kJ/mol
    heatContribution: number; // kJ
  }>;
}

// --- Multi-Reaction System Types ---

export interface ReactionNode {
  id: string;
  reaction: BalancedReaction;
  label: string; // user's original description
  displayName?: string; // optional user-given name, e.g. "Boudouard Reaction"
}

export interface SeriesLink {
  id: string;
  fromReactionId: string;
  fromProductIndex: number;
  toReactionId: string;
  toReactantIndex: number;
  fraction: number; // 0–1, default 1.0
}

export interface ReactionSystem {
  nodes: ReactionNode[];
  links: SeriesLink[];
  // --- v2 additions ---
  competingSets?: CompetingReactionSet[];
}

/** Handle position for edge connection points */
export type HandleSide = "top" | "bottom" | "left" | "right";

/** Persisted node layout */
export interface GraphNodeLayout {
  x: number;
  y: number;
  color?: string; // custom border/accent color (hex)
}

/** Persisted edge handle overrides (which side of source/target node) */
export interface GraphEdgeLayout {
  sourceSide?: HandleSide;
  targetSide?: HandleSide;
}

/** Full graph layout — node positions/colors + edge connection points */
export interface GraphLayout {
  nodes: Record<string, GraphNodeLayout>;
  edges: Record<string, GraphEdgeLayout>;
}

// --- v2: System-level result types ---

export interface SystemKineticsResult {
  perReaction: Map<string, KineticsResult>;
}

export interface SystemEquilibriumResult {
  perReaction: Map<string, EquilibriumResult>;
}

export interface SystemSelectivityResult {
  perSet: Map<string, SelectivityResult>;
}

export type AppMode = "basic" | "advanced";

export interface SubstanceTotals {
  formula: string;
  name: string;
  role: "net-reactant" | "net-product" | "intermediate" | "excess" | "deficit";
  totalMoles: number;
  totalGrams: number;
  totalKilograms: number;
  totalPounds: number;
  totalTons: number;      // short tons (US), 1 ton = 907.185 kg
  totalTonnes: number;    // metric tonnes, 1 tonne = 1000 kg
  totalLiters: number | null;  // only for liquids
  totalGallons: number | null; // only for liquids
  isLiquid: boolean;
  produced: number; // total moles produced across all reactions
  consumed: number; // total moles consumed across all reactions
  note?: string;
}

export interface AtomBalance {
  atom: string;
  produced: number;  // total atoms produced across all reactions
  consumed: number;  // total atoms consumed across all reactions
  delta: number;     // produced - consumed (should be ~0)
  balanced: boolean; // |delta| / max(produced, consumed) < tolerance
}

export interface MassBalance {
  totalMassIn: number;   // grams of all reactants consumed
  totalMassOut: number;  // grams of all products produced
  delta: number;         // out - in (should be ~0)
  deltaPercent: number;  // delta as % of totalMassIn
  balanced: boolean;     // |deltaPercent| < tolerance
}

export interface BalanceCheck {
  atoms: AtomBalance[];
  mass: MassBalance;
  allBalanced: boolean;
}

export interface SystemCalculationResult {
  perReaction: Map<string, CalculationResult[]>;
  balanceCheck: BalanceCheck;
  totals: SubstanceTotals[];
  debugInfo?: string;
  propertyWarnings?: Array<{ formula: string; field: string; message: string; severity: "error" | "warning" }>;
}

export interface SystemThermodynamics {
  perReaction: Map<string, ThermodynamicsResult>;
  totalDeltaH: number;
  isExothermic: boolean;
}

export interface SystemEconomics {
  perSubstance: SystemEconLine[];
  feedstockCost: number;
  productValue: number;    // net-products + excess
  delta: number;           // productValue - feedstockCost
}

export interface SystemEconLine {
  formula: string;
  name: string;
  role: SubstanceTotals["role"];
  quantity: number;        // net moles
  quantityGrams: number;
  quantityKg: number;
  quantityLb: number;
  pricePerUnit: number | null;
  priceUnit: AmountUnit;
  totalValue: number;      // price × quantity in chosen unit
}

// --- API Types ---

export interface ParseReactionRequest {
  description: string;
}

export interface ParseReactionResponse {
  success: boolean;
  data?: BalancedReaction;
  error?: string;
}
