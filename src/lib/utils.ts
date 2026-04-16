// Unicode subscript/superscript → plain ASCII
const SUBSCRIPT_MAP: Record<string, string> = {
  "\u2080": "0", "\u2081": "1", "\u2082": "2", "\u2083": "3", "\u2084": "4",
  "\u2085": "5", "\u2086": "6", "\u2087": "7", "\u2088": "8", "\u2089": "9",
};
const SUPERSCRIPT_MAP: Record<string, string> = {
  "\u2070": "0", "\u00B9": "1", "\u00B2": "2", "\u00B3": "3", "\u2074": "4",
  "\u2075": "5", "\u2076": "6", "\u2077": "7", "\u2078": "8", "\u2079": "9",
  "\u207A": "+", "\u207B": "-",
};

/** Convert Unicode subscripts/superscripts to plain ASCII, e.g. "H₂O" → "H2O" */
export function plainFormula(formula: string): string {
  let result = formula;
  for (const [sub, digit] of Object.entries(SUBSCRIPT_MAP)) {
    result = result.replaceAll(sub, digit);
  }
  for (const [sup, char] of Object.entries(SUPERSCRIPT_MAP)) {
    result = result.replaceAll(sup, char);
  }
  result = result.replaceAll("\u2192", "->");
  return result;
}

/** Normalize formula for identity matching across reactions. Strips Unicode, trims, uppercase-preserving. */
export function normalizeFormula(formula: string): string {
  return plainFormula(formula).trim();
}

/**
 * Parse a chemical formula into atom counts.
 * e.g. "C18H32O2" → {C: 18, H: 32, O: 2}
 * Handles parentheses: "Ca(OH)2" → {Ca: 1, O: 2, H: 2}
 * Input should be plain ASCII (run through plainFormula first).
 */
export function parseAtoms(formula: string): Map<string, number> {
  const plain = plainFormula(formula).trim();
  const atoms = new Map<string, number>();

  function addAtom(symbol: string, count: number) {
    atoms.set(symbol, (atoms.get(symbol) ?? 0) + count);
  }

  function parse(str: string, multiplier: number): void {
    let i = 0;
    while (i < str.length) {
      if (str[i] === "(") {
        // Find matching close paren
        let depth = 1;
        let j = i + 1;
        while (j < str.length && depth > 0) {
          if (str[j] === "(") depth++;
          if (str[j] === ")") depth--;
          j++;
        }
        // j is now past the closing paren
        // Read trailing number
        let numStr = "";
        while (j < str.length && str[j] >= "0" && str[j] <= "9") {
          numStr += str[j];
          j++;
        }
        const groupMult = numStr ? parseInt(numStr) : 1;
        parse(str.slice(i + 1, j - numStr.length - 1), multiplier * groupMult);
        i = j;
      } else if (str[i] >= "A" && str[i] <= "Z") {
        // Element symbol: uppercase letter optionally followed by lowercase
        let symbol = str[i];
        i++;
        while (i < str.length && str[i] >= "a" && str[i] <= "z") {
          symbol += str[i];
          i++;
        }
        // Read trailing number
        let numStr = "";
        while (i < str.length && str[i] >= "0" && str[i] <= "9") {
          numStr += str[i];
          i++;
        }
        const count = numStr ? parseInt(numStr) : 1;
        addAtom(symbol, count * multiplier);
      } else {
        i++; // skip unexpected characters
      }
    }
  }

  parse(plain, 1);
  return atoms;
}

// --- Reaction-level balance check (Level 1) ---

export interface ReactionBalanceResult {
  balanced: boolean;
  imbalances: Array<{ atom: string; left: number; right: number; delta: number }>;
}

/**
 * Check whether a single reaction is atom-balanced.
 * Compares total atoms on the reactant side vs the product side,
 * accounting for stoichiometric coefficients.
 */
export function checkReactionBalance(
  reactants: Array<{ formula: string; coefficient: number }>,
  products: Array<{ formula: string; coefficient: number }>
): ReactionBalanceResult {
  const leftAtoms = new Map<string, number>();
  const rightAtoms = new Map<string, number>();

  for (const r of reactants) {
    const atoms = parseAtoms(r.formula);
    for (const [atom, count] of atoms) {
      leftAtoms.set(atom, (leftAtoms.get(atom) ?? 0) + count * r.coefficient);
    }
  }
  for (const p of products) {
    const atoms = parseAtoms(p.formula);
    for (const [atom, count] of atoms) {
      rightAtoms.set(atom, (rightAtoms.get(atom) ?? 0) + count * p.coefficient);
    }
  }

  const allAtoms = new Set([...leftAtoms.keys(), ...rightAtoms.keys()]);
  const imbalances: ReactionBalanceResult["imbalances"] = [];

  for (const atom of allAtoms) {
    const left = leftAtoms.get(atom) ?? 0;
    const right = rightAtoms.get(atom) ?? 0;
    if (Math.abs(left - right) > 1e-4) {
      imbalances.push({ atom, left, right, delta: right - left });
    }
  }

  return { balanced: imbalances.length === 0, imbalances };
}

/**
 * IUPAC 2021 standard atomic weights (abridged).
 * Covers all elements likely to appear in reaction engineering.
 */
const ATOMIC_WEIGHTS: Record<string, number> = {
  H: 1.008, He: 4.0026, Li: 6.941, Be: 9.0122, B: 10.81, C: 12.011,
  N: 14.007, O: 15.999, F: 18.998, Ne: 20.180, Na: 22.990, Mg: 24.305,
  Al: 26.982, Si: 28.085, P: 30.974, S: 32.06, Cl: 35.45, Ar: 39.948,
  K: 39.098, Ca: 40.078, Sc: 44.956, Ti: 47.867, V: 50.942, Cr: 51.996,
  Mn: 54.938, Fe: 55.845, Co: 58.933, Ni: 58.693, Cu: 63.546, Zn: 65.38,
  Ga: 69.723, Ge: 72.630, As: 74.922, Se: 78.971, Br: 79.904, Kr: 83.798,
  Rb: 85.468, Sr: 87.62, Y: 88.906, Zr: 91.224, Nb: 92.906, Mo: 95.95,
  Ru: 101.07, Rh: 102.91, Pd: 106.42, Ag: 107.87, Cd: 112.41, In: 114.82,
  Sn: 118.71, Sb: 121.76, Te: 127.60, I: 126.90, Xe: 131.29, Cs: 132.91,
  Ba: 137.33, La: 138.91, Ce: 140.12, Pt: 195.08, Au: 196.97, Hg: 200.59,
  Tl: 204.38, Pb: 207.2, Bi: 208.98, U: 238.03, W: 183.84, Ta: 180.95,
};

/**
 * Compute molar mass from a chemical formula using standard atomic weights.
 * Returns null if any element in the formula is not in the table.
 */
export function computeMolarMass(formula: string): number | null {
  const atoms = parseAtoms(formula);
  let mw = 0;
  for (const [symbol, count] of atoms) {
    const weight = ATOMIC_WEIGHTS[symbol];
    if (weight === undefined) return null; // unknown element
    mw += weight * count;
  }
  return Math.round(mw * 100) / 100; // round to 2 decimal places
}
