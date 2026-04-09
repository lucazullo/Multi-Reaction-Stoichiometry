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
