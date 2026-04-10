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

// Methane higher heating value: 1 MMBTU = 19.01 kg CH₄ at standard conditions
export const METHANE_KG_PER_MMBTU = 19.01;
