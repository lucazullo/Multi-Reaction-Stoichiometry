import type { MassUnit, VolumeUnit } from "./types";

export const MASS_TO_GRAMS: Record<MassUnit, number> = {
  g: 1,
  kg: 1000,
  lb: 453.592,
};

export const VOLUME_TO_ML: Record<VolumeUnit, number> = {
  L: 1000,
  gal: 3785.41,
};

export const UNIT_LABELS: Record<string, string> = {
  mol: "Moles",
  g: "Grams",
  kg: "Kilograms",
  lb: "Pounds",
  L: "Liters",
  gal: "Gallons",
  MMBTU: "MMBTU",
};

// Weight conversions
export const KG_PER_SHORT_TON = 907.185;  // US short ton
export const KG_PER_METRIC_TONNE = 1000;  // metric tonne

// Methane higher heating value: 1 MMBTU = 19.01 kg CH₄ at standard conditions
export const METHANE_KG_PER_MMBTU = 19.01;

// --- v2: Physical constants ---
export const R_GAS = 8.314e-3; // kJ/(mol·K) — gas constant (note: kJ, not J, to match ΔH units)
export const R_GAS_J = 8.314;  // J/(mol·K) — gas constant in J for Arrhenius
export const STANDARD_TEMPERATURE = 298.15; // K (25°C)
