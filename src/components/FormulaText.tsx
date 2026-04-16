import { Fragment } from "react";

/**
 * Render a chemical formula with proper HTML subscripts.
 * Handles both plain ASCII ("H2O", "C57H104O6") and Unicode subscript
 * formulas ("H₂O"). Parenthesised groups are supported: "Ca(OH)2".
 *
 * Numbers that follow an element symbol or closing paren become <sub>.
 * Leading numbers (coefficients) are left as-is.
 */

// Unicode subscript → ASCII digit
const SUB_MAP: Record<string, string> = {
  "\u2080": "0", "\u2081": "1", "\u2082": "2", "\u2083": "3", "\u2084": "4",
  "\u2085": "5", "\u2086": "6", "\u2087": "7", "\u2088": "8", "\u2089": "9",
};

function toAscii(formula: string): string {
  let s = formula;
  for (const [u, d] of Object.entries(SUB_MAP)) s = s.replaceAll(u, d);
  return s;
}

/**
 * Split a plain-ASCII formula into tokens: text segments and numeric segments
 * that should be rendered as subscripts.
 */
function tokenize(formula: string): Array<{ text: string; sub: boolean }> {
  const plain = toAscii(formula).trim();
  const tokens: Array<{ text: string; sub: boolean }> = [];

  let i = 0;

  // Skip leading coefficient (digits/dots at the very start before any letter)
  let leadCoeff = "";
  while (i < plain.length && (plain[i] >= "0" && plain[i] <= "9" || plain[i] === ".")) {
    leadCoeff += plain[i];
    i++;
  }
  if (leadCoeff) tokens.push({ text: leadCoeff, sub: false });

  while (i < plain.length) {
    const ch = plain[i];

    if (ch >= "A" && ch <= "Z") {
      // Element symbol: uppercase + optional lowercase
      let sym = ch;
      i++;
      while (i < plain.length && plain[i] >= "a" && plain[i] <= "z") {
        sym += plain[i];
        i++;
      }
      tokens.push({ text: sym, sub: false });

      // Trailing digits → subscript
      let num = "";
      while (i < plain.length && plain[i] >= "0" && plain[i] <= "9") {
        num += plain[i];
        i++;
      }
      if (num) tokens.push({ text: num, sub: true });
    } else if (ch === "(") {
      tokens.push({ text: "(", sub: false });
      i++;
    } else if (ch === ")") {
      tokens.push({ text: ")", sub: false });
      i++;
      // Trailing digits after ) → subscript
      let num = "";
      while (i < plain.length && plain[i] >= "0" && plain[i] <= "9") {
        num += plain[i];
        i++;
      }
      if (num) tokens.push({ text: num, sub: true });
    } else {
      // Pass through anything else (spaces, +, →, etc.)
      tokens.push({ text: ch, sub: false });
      i++;
    }
  }

  return tokens;
}

interface FormulaTextProps {
  /** Chemical formula string, plain ASCII or Unicode subscripts */
  formula: string;
  className?: string;
}

/**
 * Renders a chemical formula with proper <sub> subscripts.
 * Example: "C57H104O6" → C<sub>57</sub>H<sub>104</sub>O<sub>6</sub>
 */
export default function FormulaText({ formula, className }: FormulaTextProps) {
  const tokens = tokenize(formula);

  return (
    <span className={className}>
      {tokens.map((tok, i) =>
        tok.sub ? (
          <sub key={i}>{tok.text}</sub>
        ) : (
          <Fragment key={i}>{tok.text}</Fragment>
        )
      )}
    </span>
  );
}

/**
 * Convert a plain-ASCII formula to a string with Unicode subscripts.
 * Useful for contexts where JSX isn't available (e.g. <option>, canvas, CSV).
 * Example: "C57H104O6" → "C₅₇H₁₀₄O₆"
 */
const DIGIT_TO_SUB: Record<string, string> = {
  "0": "\u2080", "1": "\u2081", "2": "\u2082", "3": "\u2083", "4": "\u2084",
  "5": "\u2085", "6": "\u2086", "7": "\u2087", "8": "\u2088", "9": "\u2089",
};

export function unicodeFormula(formula: string): string {
  const tokens = tokenize(formula);
  return tokens
    .map((tok) => {
      if (!tok.sub) return tok.text;
      return tok.text.split("").map((d) => DIGIT_TO_SUB[d] ?? d).join("");
    })
    .join("");
}
