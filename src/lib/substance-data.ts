/**
 * Reference physical properties for common substances.
 * Sources: NIST WebBook, Perry's Chemical Engineers' Handbook (9th ed.),
 * CRC Handbook of Chemistry and Physics.
 *
 * These values override Claude API responses to guarantee consistency
 * and correctness across reactions and sessions.
 *
 * Key = normalised formula (plain ASCII, no Unicode subscripts).
 */

export interface SubstanceReference {
  name: string;
  state: "solid" | "liquid" | "gas" | "aqueous";
  density: number | null;          // g/mL (= kg/L) at 25 °C; null for gases
  enthalpyOfFormation: number;     // kJ/mol, standard state 25 °C 1 atm
  hhv: number | null;              // kJ/kg  (null = non-combustible)
  lhv: number | null;              // kJ/kg  (null = non-combustible)
}

/**
 * Look up a substance by normalised formula.
 * Returns undefined if no reference data exists.
 */
export function lookupSubstance(normalizedFormula: string): SubstanceReference | undefined {
  return SUBSTANCE_DB[normalizedFormula];
}

// ---------------------------------------------------------------------------
// Reference database
// ---------------------------------------------------------------------------

const SUBSTANCE_DB: Record<string, SubstanceReference> = {

  // ── Diatomic elements & noble gases ───────────────────────────────────
  H2:   { name: "hydrogen",        state: "gas",    density: null,  enthalpyOfFormation: 0,       hhv: 141800, lhv: 119960 },
  O2:   { name: "oxygen",          state: "gas",    density: null,  enthalpyOfFormation: 0,       hhv: null,   lhv: null },
  N2:   { name: "nitrogen",        state: "gas",    density: null,  enthalpyOfFormation: 0,       hhv: null,   lhv: null },
  Cl2:  { name: "chlorine",        state: "gas",    density: null,  enthalpyOfFormation: 0,       hhv: null,   lhv: null },
  F2:   { name: "fluorine",        state: "gas",    density: null,  enthalpyOfFormation: 0,       hhv: null,   lhv: null },
  Br2:  { name: "bromine",         state: "liquid", density: 3.10,  enthalpyOfFormation: 0,       hhv: null,   lhv: null },
  I2:   { name: "iodine",          state: "solid",  density: 4.93,  enthalpyOfFormation: 0,       hhv: null,   lhv: null },

  // ── Water & ice ───────────────────────────────────────────────────────
  H2O:  { name: "water",           state: "liquid", density: 0.997, enthalpyOfFormation: -285.83, hhv: null,   lhv: null },

  // ── Common inorganic gases ────────────────────────────────────────────
  CO2:  { name: "carbon dioxide",  state: "gas",    density: null,  enthalpyOfFormation: -393.51, hhv: null,   lhv: null },
  CO:   { name: "carbon monoxide", state: "gas",    density: null,  enthalpyOfFormation: -110.53, hhv: 10100,  lhv: 10100 },
  NO:   { name: "nitric oxide",    state: "gas",    density: null,  enthalpyOfFormation: 91.3,    hhv: null,   lhv: null },
  NO2:  { name: "nitrogen dioxide",state: "gas",    density: null,  enthalpyOfFormation: 33.2,    hhv: null,   lhv: null },
  N2O:  { name: "nitrous oxide",   state: "gas",    density: null,  enthalpyOfFormation: 82.05,   hhv: null,   lhv: null },
  SO2:  { name: "sulfur dioxide",  state: "gas",    density: null,  enthalpyOfFormation: -296.83, hhv: null,   lhv: null },
  SO3:  { name: "sulfur trioxide", state: "gas",    density: null,  enthalpyOfFormation: -395.72, hhv: null,   lhv: null },
  NH3:  { name: "ammonia",         state: "gas",    density: null,  enthalpyOfFormation: -45.94,  hhv: 22500,  lhv: 18600 },
  HCl:  { name: "hydrogen chloride", state: "gas",  density: null,  enthalpyOfFormation: -92.31,  hhv: null,   lhv: null },
  HF:   { name: "hydrogen fluoride", state: "gas",  density: null,  enthalpyOfFormation: -273.3,  hhv: null,   lhv: null },
  H2S:  { name: "hydrogen sulfide",  state: "gas",  density: null,  enthalpyOfFormation: -20.6,   hhv: 16500,  lhv: 15200 },
  HCN:  { name: "hydrogen cyanide",  state: "liquid", density: 0.687, enthalpyOfFormation: 108.9, hhv: 24400,  lhv: 23500 },

  // ── Carbon (allotropes) ───────────────────────────────────────────────
  C:    { name: "carbon (graphite)", state: "solid", density: 2.27,  enthalpyOfFormation: 0,      hhv: 32800,  lhv: 32800 },

  // ── Sulfur ────────────────────────────────────────────────────────────
  S:    { name: "sulfur",           state: "solid",  density: 2.07,  enthalpyOfFormation: 0,      hhv: 9300,   lhv: 9300 },
  S8:   { name: "sulfur (S8)",     state: "solid",  density: 2.07,  enthalpyOfFormation: 0,      hhv: 9300,   lhv: 9300 },

  // ── Common inorganic solids ───────────────────────────────────────────
  NaCl: { name: "sodium chloride",  state: "solid",  density: 2.16, enthalpyOfFormation: -411.12, hhv: null,   lhv: null },
  NaOH: { name: "sodium hydroxide", state: "solid",  density: 2.13, enthalpyOfFormation: -425.61, hhv: null,   lhv: null },
  KOH:  { name: "potassium hydroxide", state: "solid", density: 2.04, enthalpyOfFormation: -424.76, hhv: null, lhv: null },
  CaO:  { name: "calcium oxide",    state: "solid",  density: 3.34, enthalpyOfFormation: -635.09, hhv: null,   lhv: null },
  CaCO3:{ name: "calcium carbonate",state: "solid",  density: 2.71, enthalpyOfFormation: -1206.9, hhv: null,   lhv: null },
  Ca_OH_2: { name: "calcium hydroxide", state: "solid", density: 2.21, enthalpyOfFormation: -985.2, hhv: null, lhv: null },
  MgO:  { name: "magnesium oxide",  state: "solid",  density: 3.58, enthalpyOfFormation: -601.6,  hhv: null,   lhv: null },
  Al2O3:{ name: "aluminium oxide",  state: "solid",  density: 3.95, enthalpyOfFormation: -1675.7, hhv: null,   lhv: null },
  Fe2O3:{ name: "iron(III) oxide",  state: "solid",  density: 5.24, enthalpyOfFormation: -824.2,  hhv: null,   lhv: null },
  Fe3O4:{ name: "magnetite",        state: "solid",  density: 5.17, enthalpyOfFormation: -1118.4, hhv: null,   lhv: null },
  FeO:  { name: "iron(II) oxide",   state: "solid",  density: 5.74, enthalpyOfFormation: -272.0,  hhv: null,   lhv: null },
  SiO2: { name: "silicon dioxide",  state: "solid",  density: 2.65, enthalpyOfFormation: -910.7,  hhv: null,   lhv: null },
  TiO2: { name: "titanium dioxide", state: "solid",  density: 4.23, enthalpyOfFormation: -944.0,  hhv: null,   lhv: null },

  // ── Metals (standard state) ───────────────────────────────────────────
  Fe:   { name: "iron",             state: "solid",  density: 7.87, enthalpyOfFormation: 0,       hhv: 7400,   lhv: 7400 },
  Al:   { name: "aluminium",        state: "solid",  density: 2.70, enthalpyOfFormation: 0,       hhv: 31100,  lhv: 31100 },
  Cu:   { name: "copper",           state: "solid",  density: 8.96, enthalpyOfFormation: 0,       hhv: null,   lhv: null },
  Zn:   { name: "zinc",             state: "solid",  density: 7.13, enthalpyOfFormation: 0,       hhv: 5400,   lhv: 5400 },
  Na:   { name: "sodium",           state: "solid",  density: 0.97, enthalpyOfFormation: 0,       hhv: null,   lhv: null },
  Mg:   { name: "magnesium",        state: "solid",  density: 1.74, enthalpyOfFormation: 0,       hhv: 24700,  lhv: 24700 },

  // ── Acids ─────────────────────────────────────────────────────────────
  H2SO4: { name: "sulfuric acid",   state: "liquid", density: 1.83, enthalpyOfFormation: -814.0,  hhv: null,   lhv: null },
  HNO3:  { name: "nitric acid",     state: "liquid", density: 1.51, enthalpyOfFormation: -174.1,  hhv: null,   lhv: null },
  H3PO4: { name: "phosphoric acid", state: "liquid", density: 1.88, enthalpyOfFormation: -1271.7, hhv: null,   lhv: null },
  CH2O2: { name: "formic acid",     state: "liquid", density: 1.22, enthalpyOfFormation: -425.0,  hhv: 5530,   lhv: 5030 },
  C2H4O2:{ name: "acetic acid",     state: "liquid", density: 1.05, enthalpyOfFormation: -484.5,  hhv: 14570,  lhv: 13100 },

  // ── C1 hydrocarbons & oxygenates ─────────────────────────────────────
  CH4:  { name: "methane",          state: "gas",    density: null,  enthalpyOfFormation: -74.81,  hhv: 55530,  lhv: 50010 },
  CH3OH:{ name: "methanol",         state: "liquid", density: 0.791, enthalpyOfFormation: -239.2,  hhv: 22700,  lhv: 19930 },
  CH2O: { name: "formaldehyde",     state: "gas",    density: null,  enthalpyOfFormation: -108.6,  hhv: 19300,  lhv: 17300 },

  // ── C2 ────────────────────────────────────────────────────────────────
  C2H6:  { name: "ethane",          state: "gas",    density: null,  enthalpyOfFormation: -84.0,   hhv: 51880,  lhv: 47490 },
  C2H4:  { name: "ethylene",        state: "gas",    density: null,  enthalpyOfFormation: 52.4,    hhv: 50300,  lhv: 47160 },
  C2H2:  { name: "acetylene",       state: "gas",    density: null,  enthalpyOfFormation: 227.4,   hhv: 49910,  lhv: 48220 },
  C2H5OH:{ name: "ethanol",         state: "liquid", density: 0.789, enthalpyOfFormation: -277.6,  hhv: 29670,  lhv: 26810 },
  C2H6O: { name: "ethanol",         state: "liquid", density: 0.789, enthalpyOfFormation: -277.6,  hhv: 29670,  lhv: 26810 }, // alternate formula
  C2H4O: { name: "acetaldehyde",    state: "liquid", density: 0.788, enthalpyOfFormation: -166.2,  hhv: 27800,  lhv: 25100 },

  // ── C3 ────────────────────────────────────────────────────────────────
  C3H8:  { name: "propane",         state: "gas",    density: null,  enthalpyOfFormation: -104.7,  hhv: 50350,  lhv: 46350 },
  C3H6:  { name: "propylene",       state: "gas",    density: null,  enthalpyOfFormation: 20.0,    hhv: 48920,  lhv: 45780 },
  C3H6O: { name: "acetone",         state: "liquid", density: 0.784, enthalpyOfFormation: -248.4,  hhv: 31400,  lhv: 28600 },
  C3H8O: { name: "isopropanol",     state: "liquid", density: 0.786, enthalpyOfFormation: -318.1,  hhv: 33400,  lhv: 30400 },
  C3H8O3:{ name: "glycerol",        state: "liquid", density: 1.261, enthalpyOfFormation: -669.6,  hhv: 18000,  lhv: 16100 },

  // ── C4 ────────────────────────────────────────────────────────────────
  C4H10: { name: "n-butane",        state: "gas",    density: null,  enthalpyOfFormation: -125.6,  hhv: 49510,  lhv: 45720 },
  C4H8:  { name: "1-butene",        state: "gas",    density: null,  enthalpyOfFormation: -0.5,    hhv: 48430,  lhv: 45300 },
  C4H6:  { name: "1,3-butadiene",   state: "gas",    density: null,  enthalpyOfFormation: 110.0,   hhv: 47100,  lhv: 44100 },

  // ── C5–C8 alkanes ────────────────────────────────────────────────────
  C5H12: { name: "n-pentane",       state: "liquid", density: 0.626, enthalpyOfFormation: -146.4,  hhv: 49010,  lhv: 45350 },
  C6H14: { name: "n-hexane",        state: "liquid", density: 0.659, enthalpyOfFormation: -166.9,  hhv: 48680,  lhv: 45100 },
  C7H16: { name: "n-heptane",       state: "liquid", density: 0.684, enthalpyOfFormation: -187.7,  hhv: 48430,  lhv: 44920 },
  C8H18: { name: "n-octane",        state: "liquid", density: 0.703, enthalpyOfFormation: -208.4,  hhv: 48260,  lhv: 44790 },

  // ── C6 aromatics ──────────────────────────────────────────────────────
  C6H6:  { name: "benzene",         state: "liquid", density: 0.879, enthalpyOfFormation: 49.1,    hhv: 41830,  lhv: 40140 },
  C7H8:  { name: "toluene",         state: "liquid", density: 0.867, enthalpyOfFormation: 12.4,    hhv: 42440,  lhv: 40520 },
  C8H10: { name: "xylene (mixed)",  state: "liquid", density: 0.864, enthalpyOfFormation: -24.4,   hhv: 43000,  lhv: 41000 },

  // ── Longer-chain alkanes (HVO / Fischer-Tropsch) ─────────────────────
  C10H22: { name: "n-decane",        state: "liquid", density: 0.730, enthalpyOfFormation: -249.5,  hhv: 48000, lhv: 44600 },
  C12H26: { name: "n-dodecane",      state: "liquid", density: 0.749, enthalpyOfFormation: -290.9,  hhv: 47800, lhv: 44500 },
  C14H30: { name: "n-tetradecane",   state: "liquid", density: 0.763, enthalpyOfFormation: -332.1,  hhv: 47700, lhv: 44400 },
  C16H34: { name: "n-hexadecane",    state: "liquid", density: 0.773, enthalpyOfFormation: -374.8,  hhv: 47600, lhv: 44300 },
  C18H38: { name: "n-octadecane",    state: "solid",  density: 0.777, enthalpyOfFormation: -414.6,  hhv: 47500, lhv: 44200 },
  C20H42: { name: "n-eicosane",      state: "solid",  density: 0.789, enthalpyOfFormation: -455.8,  hhv: 47400, lhv: 44100 },

  // ── Common fatty acids ───────────────────────────────────────────────
  C16H32O2: { name: "palmitic acid",  state: "solid",  density: 0.853, enthalpyOfFormation: -891.5,  hhv: 39160, lhv: 36500 },
  C18H36O2: { name: "stearic acid",   state: "solid",  density: 0.847, enthalpyOfFormation: -884.7,  hhv: 39360, lhv: 36800 },
  C18H34O2: { name: "oleic acid",     state: "liquid", density: 0.895, enthalpyOfFormation: -764.8,  hhv: 39670, lhv: 37100 },
  C18H32O2: { name: "linoleic acid",  state: "liquid", density: 0.902, enthalpyOfFormation: -659.2,  hhv: 39470, lhv: 36900 },
  C18H30O2: { name: "linolenic acid", state: "liquid", density: 0.914, enthalpyOfFormation: -553.4,  hhv: 39260, lhv: 36700 },

  // ── Biodiesel / esters ───────────────────────────────────────────────
  C19H36O2: { name: "methyl oleate",  state: "liquid", density: 0.874, enthalpyOfFormation: -734.5,  hhv: 39500, lhv: 37000 },

  // ── Sugars ────────────────────────────────────────────────────────────
  C6H12O6:{ name: "glucose",         state: "solid",  density: 1.54,  enthalpyOfFormation: -1273.3, hhv: 15600,  lhv: 14200 },
  C12H22O11:{ name: "sucrose",       state: "solid",  density: 1.59,  enthalpyOfFormation: -2226.1, hhv: 16500,  lhv: 15400 },

  // ── Urea, common organics ────────────────────────────────────────────
  CH4N2O:{ name: "urea",             state: "solid",  density: 1.32,  enthalpyOfFormation: -333.1,  hhv: 10540,  lhv: 9210 },

  // ── Synthesis gas related ─────────────────────────────────────────────
  // CO already above
  // H2 already above
};

// ---------------------------------------------------------------------------
// Alias table: map Ca(OH)2 → Ca_OH_2 etc.
// parseAtoms produces "Ca1O2H2" regardless of how the formula was written,
// so we need to map common parenthesised formulas to their DB key.
// ---------------------------------------------------------------------------
const FORMULA_ALIASES: Record<string, string> = {
  "Ca(OH)2": "Ca_OH_2",
  "CaO2H2":  "Ca_OH_2",  // what normalizeFormula + parseAtoms might produce
};

/**
 * Look up with alias resolution.
 */
export function lookupSubstanceWithAlias(normalizedFormula: string): SubstanceReference | undefined {
  const alias = FORMULA_ALIASES[normalizedFormula];
  if (alias) return SUBSTANCE_DB[alias];
  return SUBSTANCE_DB[normalizedFormula];
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface PropertyWarning {
  formula: string;
  field: string;
  message: string;
  severity: "error" | "warning";
}

/**
 * Validate physical properties of a substance for internal consistency.
 * Returns an array of warnings (empty = all OK).
 */
export function validateSubstanceProperties(
  formula: string,
  props: {
    state: string;
    density: number | null;
    enthalpyOfFormation: number;
    hhv: number | null;
    lhv: number | null;
  }
): PropertyWarning[] {
  const warnings: PropertyWarning[] = [];

  // HHV must be > LHV (latent heat of water vaporisation)
  if (props.hhv !== null && props.lhv !== null && props.lhv > props.hhv) {
    warnings.push({
      formula,
      field: "hhv/lhv",
      message: `LHV (${props.lhv}) > HHV (${props.hhv}) — LHV must be less than or equal to HHV`,
      severity: "error",
    });
  }

  // Density should be positive
  if (props.density !== null && props.density <= 0) {
    warnings.push({
      formula,
      field: "density",
      message: `Density is ${props.density} — must be positive`,
      severity: "error",
    });
  }

  // Gases should not have liquid density
  if (props.state === "gas" && props.density !== null) {
    warnings.push({
      formula,
      field: "density",
      message: "Gas substance has liquid density set — should be null",
      severity: "warning",
    });
  }

  // Non-combustible check: common non-combustibles that should have null HHV/LHV
  const nonCombustible = ["H2O", "CO2", "N2", "O2", "SO2", "SO3", "NO2", "SiO2", "Al2O3",
    "Fe2O3", "CaO", "CaCO3", "NaCl", "H2SO4", "HNO3", "HCl", "HF", "NaOH", "KOH"];
  if (nonCombustible.includes(formula)) {
    if (props.hhv !== null) {
      warnings.push({
        formula,
        field: "hhv",
        message: `${formula} is non-combustible but has HHV = ${props.hhv}`,
        severity: "warning",
      });
    }
  }

  return warnings;
}
