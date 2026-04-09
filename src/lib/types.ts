export type PhysicalState = "solid" | "liquid" | "gas" | "aqueous";

export interface Substance {
  formula: string;
  name: string;
  coefficient: number;
  molarMass: number; // g/mol
  state: PhysicalState;
  density: number | null; // g/mL, only for liquids
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

export interface ParseReactionRequest {
  description: string;
}

export interface ParseReactionResponse {
  success: boolean;
  data?: BalancedReaction;
  error?: string;
}
