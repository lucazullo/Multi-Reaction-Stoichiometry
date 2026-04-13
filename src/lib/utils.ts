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
