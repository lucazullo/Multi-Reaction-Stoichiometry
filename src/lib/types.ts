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
}

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

export interface SystemCalculationResult {
  perReaction: Map<string, CalculationResult[]>;
  totals: SubstanceTotals[];
  debugInfo?: string;
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
