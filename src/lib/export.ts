import type {
  CalculationResult,
  EconomicsSummary,
  EnergyUnit,
  EquilibriumResult,
  KineticsResult,
  ReactionSystem,
  SelectivityResult,
  SubstanceTotals,
  SystemCalculationResult,
  SystemEconomics,
  SystemThermodynamics,
  ThermodynamicsResult,
} from "./types";
// EconomicsSummary still used for single-reaction generateEconomicsCSV
import { plainFormula } from "./utils";

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

// --- Individual table CSVs ---

export function generateQuantitiesCSV(results: CalculationResult[]): string {
  const rows: string[] = [];
  rows.push(
    ["Substance", "Formula", "Role", "Moles", "Grams", "Kilograms", "Pounds", "Liters", "Gallons"]
      .map(esc).join(",")
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

// --- Single-reaction combined CSV ---

export function generateFullCSV(
  results: CalculationResult[],
  thermodynamics?: ThermodynamicsResult | null,
  economics?: EconomicsSummary | null,
  energyUnit?: EnergyUnit,
  selectedIndex?: number
): string {
  const sections: string[] = [];

  sections.push("=== STOICHIOMETRY ===");
  sections.push(generateQuantitiesCSV(results));

  if (thermodynamics) {
    sections.push("");
    sections.push("=== THERMODYNAMICS ===");
    const selResult = selectedIndex !== undefined ? results[selectedIndex] : undefined;
    sections.push(generateThermodynamicsCSV(thermodynamics, energyUnit ?? "kJ", selResult));
  }

  if (economics) {
    sections.push("");
    sections.push("=== COST ANALYSIS ===");
    sections.push(generateEconomicsCSV(economics));
  }

  return sections.join("\n");
}

// --- Multi-reaction system CSV ---

export function generateTotalsCSV(totals: SubstanceTotals[]): string {
  const rows: string[] = [];
  rows.push(["Substance", "Formula", "Net Role", "Produced (mol)", "Consumed (mol)", "Net (mol)", "Net (g)", "Net (kg)", "Net (lb)"].map(esc).join(","));
  for (const t of totals) {
    rows.push(
      [t.name, plainFormula(t.formula), t.role, fmt(t.produced), fmt(t.consumed), fmt(t.totalMoles), fmt(t.totalGrams), fmt(t.totalKilograms), fmt(t.totalPounds)]
        .map(esc).join(",")
    );
  }
  return rows.join("\n");
}

export function generateSystemEconCSV(econ: SystemEconomics): string {
  const rows: string[] = [];
  rows.push(["Substance", "Formula", "Role", "Quantity (kg)", "Quantity (lb)", "Quantity (tonne)", "Quantity (short ton)", "Price/Unit", "Unit", "Total Cost/Price ($)"].map(esc).join(","));
  for (const e of econ.perSubstance) {
    rows.push([
      e.name, plainFormula(e.formula), e.role,
      fmt(e.quantityKg), fmt(e.quantityLb), fmt(e.quantityTonnes), fmt(e.quantityTons),
      e.pricePerUnit !== null ? fmt(e.pricePerUnit) : "",
      e.pricePerUnit !== null ? `$/${e.priceUnit}` : "",
      fmt(e.totalValue),
    ].map(esc).join(","));
  }
  rows.push("");
  rows.push(`Total Feedstock Cost ($),${fmt(econ.feedstockCost)}`);
  rows.push(`Total Product/Excess Value ($),${fmt(econ.productValue)}`);
  if (econ.intermediateValue > 0) {
    rows.push(`Internal Transfer Value ($),${fmt(econ.intermediateValue)}`);
  }
  rows.push(`Net Delta ($),${fmt(econ.delta)}`);
  return rows.join("\n");
}

export function generateSystemThermoSummaryCSV(
  thermo: SystemThermodynamics,
  eu: EnergyUnit,
  selectedResult?: { substance: { formula: string }; moles: number; grams: number; kilograms: number; pounds: number } | null
): string {
  const rows: string[] = [];
  const conv = eu === "BTU" ? KJ_TO_BTU : 1;
  const label = thermo.isExothermic ? "Exothermic" : "Endothermic";
  rows.push(`System Reaction Type,${label}`);
  rows.push(`Total ΔH (${eu}),${fmt(thermo.totalDeltaH * conv)}`);

  if (selectedResult) {
    const sel = selectedResult;
    const name = plainFormula(sel.substance.formula);
    rows.push("");
    rows.push(`Specific Energy per unit of ${name}`);
    if (sel.moles > 0) rows.push(`${eu}/mol,${fmt(thermo.totalDeltaH / sel.moles * conv)}`);
    if (sel.grams > 0) rows.push(`${eu}/g,${fmt(thermo.totalDeltaH / sel.grams * conv)}`);
    if (sel.kilograms > 0) rows.push(`${eu}/kg,${fmt(thermo.totalDeltaH / sel.kilograms * conv)}`);
    if (sel.pounds > 0) rows.push(`${eu}/lb,${fmt(thermo.totalDeltaH / sel.pounds * conv)}`);
  }
  return rows.join("\n");
}

export function generatePropertiesCSV(
  totals: SubstanceTotals[],
  substanceData: Array<{ formula: string; molarMass: number; state: string; densityLiquid: number | null; densityGas: number | null; hhv: number | null; lhv: number | null }>
): string {
  const rows: string[] = [];
  rows.push(["Substance", "Formula", "Role", "State", "MW (g/mol)", "Density (kg/L or kg/m3)", "HHV (kJ/kg)", "LHV (kJ/kg)"].map(esc).join(","));
  for (let i = 0; i < totals.length; i++) {
    const t = totals[i];
    const d = substanceData[i];
    const density = d?.densityLiquid ?? (d?.densityGas ? d.densityGas * 0.001 : null);
    rows.push([
      t.name, plainFormula(t.formula), t.role, d?.state ?? "",
      d ? fmt(d.molarMass) : "", density !== null ? fmt(density) : "",
      d?.hhv !== null ? fmt(d?.hhv ?? null) : "", d?.lhv !== null ? fmt(d?.lhv ?? null) : "",
    ].map(esc).join(","));
  }
  return rows.join("\n");
}

export function generateSystemFullCSV(
  system: ReactionSystem,
  systemResult: SystemCalculationResult,
  systemThermo?: SystemThermodynamics | null,
  systemEcon?: SystemEconomics | null,
  energyUnit?: EnergyUnit
): string {
  const eu = energyUnit ?? "kJ";
  const sections: string[] = [];

  // Per-reaction sections
  for (const node of system.nodes) {
    const results = systemResult.perReaction.get(node.id);
    if (!results) continue;

    sections.push(`=== REACTION: ${plainFormula(node.reaction.equation)} ===`);
    sections.push(`Description: ${node.label}`);
    sections.push(generateQuantitiesCSV(results));

    // v2: Literature lookup data
    if (node.reaction.lookupNotes) {
      sections.push("");
      sections.push(`Literature Notes: ${esc(node.reaction.lookupNotes)}`);
    }
    if (node.reaction.rateLaw?.source) {
      sections.push(`Kinetics Source: ${esc(node.reaction.rateLaw.source)} (${node.reaction.rateLaw.confidence ?? "unknown"} confidence)`);
    }
    if (node.reaction.equilibrium?.source) {
      sections.push(`Equilibrium Source: ${esc(node.reaction.equilibrium?.source)} (${node.reaction.equilibrium.confidence ?? "unknown"} confidence)`);
    }
    if (node.reaction.references && node.reaction.references.length > 0) {
      sections.push("");
      sections.push("References:");
      for (const ref of node.reaction.references) {
        sections.push(`  ${esc(ref.citation)}${ref.url ? ` — ${ref.url}` : ""} [${ref.dataType}]`);
      }
    }

    if (systemThermo) {
      const thermo = systemThermo.perReaction.get(node.id);
      if (thermo) {
        sections.push("");
        sections.push(generateThermodynamicsCSV(thermo, eu));
      }
    }

    sections.push("");
  }

  // System totals
  sections.push("=== SYSTEM TOTALS ===");
  sections.push(generateTotalsCSV(systemResult.totals));

  if (systemThermo) {
    sections.push("");
    const thermoLabel = systemThermo.isExothermic ? "Exothermic" : "Endothermic";
    sections.push(`System Reaction Type,${thermoLabel}`);
    sections.push(`System Total ΔH (${eu}),${fmt(ec(systemThermo.totalDeltaH, eu))}`);
  }

  if (systemEcon) {
    sections.push("");
    sections.push("=== SYSTEM ECONOMICS ===");
    sections.push(generateSystemEconCSV(systemEcon));
  }

  // Links
  if (system.links.length > 0) {
    sections.push("");
    sections.push("=== SERIES LINKS ===");
    sections.push(["From Reaction", "Product", "To Reaction", "Reactant", "Fraction"].map(esc).join(","));
    for (const link of system.links) {
      const fromNode = system.nodes.find((n) => n.id === link.fromReactionId);
      const toNode = system.nodes.find((n) => n.id === link.toReactionId);
      const product = fromNode?.reaction.products[link.fromProductIndex];
      const reactant = toNode?.reaction.reactants[link.toReactantIndex];
      rows_push_link(sections, fromNode?.label ?? "", product ? plainFormula(product.formula) : "", toNode?.label ?? "", reactant ? plainFormula(reactant.formula) : "", link.fraction);
    }
  }

  return sections.join("\n");
}

function rows_push_link(sections: string[], fromLabel: string, product: string, toLabel: string, reactant: string, fraction: number) {
  sections.push([fromLabel, product, toLabel, reactant, String(fraction)].map(esc).join(","));
}

// --- v2: Equilibrium CSV ---

export function generateEquilibriumCSV(
  result: EquilibriumResult,
  equation: string
): string {
  const rows: string[] = [];
  rows.push(`Reaction,${esc(equation)}`);
  rows.push(`Keq(T),${fmt(result.keqAtT)}`);
  rows.push(`Q (initial),${fmt(result.reactionQuotient)}`);
  rows.push(`Direction,${result.direction}`);
  rows.push("");
  rows.push(["Species", "Equilibrium Concentration (mol/L)"].map(esc).join(","));
  for (const [formula, conc] of Object.entries(result.equilibriumConcentrations)) {
    rows.push([plainFormula(formula), fmt(conc)].map(esc).join(","));
  }
  if (result.shifts.length > 0) {
    rows.push("");
    rows.push("=== LE CHATELIER ANALYSIS ===");
    rows.push(["Perturbation", "Direction", "Explanation"].map(esc).join(","));
    for (const s of result.shifts) {
      rows.push([s.perturbation, s.direction, s.explanation].map(esc).join(","));
    }
  }
  return rows.join("\n");
}

// --- v2: Kinetics CSV ---

export function generateKineticsCSV(
  result: KineticsResult,
  equation: string
): string {
  const rows: string[] = [];
  rows.push(`Reaction,${esc(equation)}`);
  rows.push(`k(T),${fmt(result.rateConstantAtT)}`);
  rows.push(`Initial rate,${fmt(result.rateAtT)}`);
  if (result.halfLife !== null) rows.push(`Half-life (s),${fmt(result.halfLife)}`);
  rows.push("");

  const formulas = Object.keys(result.concentrations);
  rows.push(["Time (s)", ...formulas.map((f) => `[${plainFormula(f)}] (mol/L)`)].map(esc).join(","));
  for (let i = 0; i < result.timePoints.length; i++) {
    const vals = [fmt(result.timePoints[i])];
    for (const f of formulas) {
      vals.push(fmt(result.concentrations[f]?.[i] ?? 0));
    }
    rows.push(vals.map(esc).join(","));
  }
  return rows.join("\n");
}

// --- v2: Selectivity CSV ---

export function generateSelectivityCSV(
  results: SelectivityResult[]
): string {
  const rows: string[] = [];
  for (const result of results) {
    rows.push(`Competing Set,${esc(result.competingSetId)}`);
    rows.push(`Selectivity,${(result.selectivity * 100).toFixed(1)}%`);
    rows.push(`Yield,${(result.yield * 100).toFixed(1)}%`);
    rows.push(`Atom Economy,${(result.atomEconomy * 100).toFixed(1)}%`);
    rows.push("");
    rows.push(`Desired Product,${esc(result.desiredProduct.formula)},${esc(result.desiredProduct.name)},${fmt(result.desiredProduct.moles)} mol`);
    rows.push("");
    if (result.coProducts.length > 0) {
      rows.push(["Co-product Formula", "Name", "Moles", "Source Reaction"].map(esc).join(","));
      for (const cp of result.coProducts) {
        rows.push([plainFormula(cp.formula), cp.name, fmt(cp.moles), cp.reactionLabel].map(esc).join(","));
      }
    }
    rows.push("");
  }
  return rows.join("\n");
}

export function downloadCSV(csv: string, filename: string = "stoichiometry-results.csv") {
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
