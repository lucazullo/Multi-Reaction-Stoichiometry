import type {
  CalculationResult,
  EconomicsSummary,
  ThermodynamicsResult,
  EnergyUnit,
} from "./types";

const KJ_TO_BTU = 0.947817;

function esc(val: string | number | null): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function fmt(n: number | null): string {
  if (n === null) return "";
  if (n === 0) return "0";
  if (Math.abs(n) >= 0.01 && Math.abs(n) < 1e6) return n.toPrecision(4);
  return n.toExponential(3);
}

function ec(kJ: number, eu: EnergyUnit): number {
  return eu === "BTU" ? kJ * KJ_TO_BTU : kJ;
}

// Convert Unicode subscript/superscript characters to plain ASCII
// e.g. "H₂O" → "H2O", "CO₂" → "CO2", "Fe₂O₃" → "Fe2O3"
const SUBSCRIPT_MAP: Record<string, string> = {
  "\u2080": "0", "\u2081": "1", "\u2082": "2", "\u2083": "3", "\u2084": "4",
  "\u2085": "5", "\u2086": "6", "\u2087": "7", "\u2088": "8", "\u2089": "9",
};
const SUPERSCRIPT_MAP: Record<string, string> = {
  "\u2070": "0", "\u00B9": "1", "\u00B2": "2", "\u00B3": "3", "\u2074": "4",
  "\u2075": "5", "\u2076": "6", "\u2077": "7", "\u2078": "8", "\u2079": "9",
  "\u207A": "+", "\u207B": "-",
};

function plainFormula(formula: string): string {
  let result = formula;
  for (const [sub, digit] of Object.entries(SUBSCRIPT_MAP)) {
    result = result.replaceAll(sub, digit);
  }
  for (const [sup, char] of Object.entries(SUPERSCRIPT_MAP)) {
    result = result.replaceAll(sup, char);
  }
  // Also replace the arrow character
  result = result.replaceAll("\u2192", "->");
  return result;
}

// --- Individual table CSVs ---

export function generateQuantitiesCSV(results: CalculationResult[]): string {
  const rows: string[] = [];
  rows.push(
    ["Substance", "Formula", "Role", "Moles", "Grams", "Kilograms", "Pounds", "Liters", "Gallons"]
      .map(esc)
      .join(",")
  );
  for (const r of results) {
    rows.push(
      [
        r.substance.name, plainFormula(r.substance.formula), r.substance.role,
        fmt(r.moles), fmt(r.grams), fmt(r.kilograms), fmt(r.pounds),
        fmt(r.liters), fmt(r.gallons),
      ].map(esc).join(",")
    );
  }
  return rows.join("\n");
}

export function generateThermodynamicsCSV(
  thermodynamics: ThermodynamicsResult,
  energyUnit: EnergyUnit,
  selectedResult?: CalculationResult
): string {
  const eu = energyUnit;
  const rows: string[] = [];

  const label = thermodynamics.isExothermic ? "Exothermic" : "Endothermic";
  rows.push(`Reaction Type,${label}`);
  rows.push(`ΔHrxn (${eu}),${fmt(ec(thermodynamics.deltaH, eu))}`);
  rows.push("");

  // Specific energy
  if (selectedResult) {
    const sel = selectedResult;
    const selName = plainFormula(sel.substance.formula);
    rows.push(`Specific Energy per unit of ${selName}`);
    if (sel.moles > 0) rows.push(`${eu}/mol,${fmt(ec(thermodynamics.deltaH / sel.moles, eu))}`);
    if (sel.grams > 0) rows.push(`${eu}/g,${fmt(ec(thermodynamics.deltaH / sel.grams, eu))}`);
    if (sel.kilograms > 0) rows.push(`${eu}/kg,${fmt(ec(thermodynamics.deltaH / sel.kilograms, eu))}`);
    if (sel.pounds > 0) rows.push(`${eu}/lb,${fmt(ec(thermodynamics.deltaH / sel.pounds, eu))}`);
    if (sel.liters && sel.liters > 0) rows.push(`${eu}/L,${fmt(ec(thermodynamics.deltaH / sel.liters, eu))}`);
    if (sel.gallons && sel.gallons > 0) rows.push(`${eu}/gal,${fmt(ec(thermodynamics.deltaH / sel.gallons, eu))}`);
    rows.push("");
  }

  // Per-substance table
  rows.push(
    ["Substance", "Formula", "Role", "ΔHf° (kJ/mol)", "Moles", `Heat Contribution (${eu})`]
      .map(esc).join(",")
  );
  for (const row of thermodynamics.perSubstance) {
    rows.push(
      [
        row.substance.name, plainFormula(row.substance.formula), row.substance.role,
        fmt(row.enthalpyOfFormation), fmt(row.moles),
        fmt(ec(row.heatContribution, eu)),
      ].map(esc).join(",")
    );
  }
  rows.push(["", "", "", "", "Total ΔHrxn", fmt(ec(thermodynamics.deltaH, eu))].map(esc).join(","));

  return rows.join("\n");
}

export function generateEconomicsCSV(economics: EconomicsSummary): string {
  const rows: string[] = [];
  rows.push(
    ["Substance", "Formula", "Role", "Price/Unit", "Price Unit", "Total Cost/Price ($)"]
      .map(esc).join(",")
  );
  for (const e of economics.perSubstance) {
    rows.push(
      [
        e.substance.name, plainFormula(e.substance.formula), e.role,
        e.pricePerUnit !== null ? fmt(e.pricePerUnit) : "",
        e.pricePerUnit !== null ? `$/${e.priceUnit}` : "",
        fmt(e.totalCost),
      ].map(esc).join(",")
    );
  }
  rows.push("");
  rows.push(`Total Reactant Cost ($),${fmt(economics.reactantCost)}`);
  rows.push(`Total Product Value ($),${fmt(economics.productValue)}`);
  rows.push(`Net Delta ($),${fmt(economics.delta)}`);
  return rows.join("\n");
}

// --- Combined CSV with all tables ---

export function generateFullCSV(
  results: CalculationResult[],
  thermodynamics?: ThermodynamicsResult | null,
  economics?: EconomicsSummary | null,
  energyUnit?: EnergyUnit,
  selectedIndex?: number
): string {
  const sections: string[] = [];

  // Quantities
  sections.push("=== STOICHIOMETRY ===");
  sections.push(generateQuantitiesCSV(results));

  // Thermodynamics
  if (thermodynamics) {
    sections.push("");
    sections.push("=== THERMODYNAMICS ===");
    const selResult = selectedIndex !== undefined ? results[selectedIndex] : undefined;
    sections.push(generateThermodynamicsCSV(thermodynamics, energyUnit ?? "kJ", selResult));
  }

  // Economics
  if (economics) {
    sections.push("");
    sections.push("=== COST ANALYSIS ===");
    sections.push(generateEconomicsCSV(economics));
  }

  return sections.join("\n");
}

export function downloadCSV(csv: string, filename: string = "stoichiometry-results.csv") {
  // BOM for Excel UTF-8 recognition
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
