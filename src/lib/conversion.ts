import type {
  AmountUnit,
  BalancedReaction,
  CalculationInput,
  CalculationResult,
  EconomicsSummary,
  MassUnit,
  PriceEntry,
  Substance,
  ThermodynamicsResult,
  VolumeUnit,
} from "./types";
import { MASS_TO_GRAMS, VOLUME_TO_ML } from "./constants";

const MASS_UNITS = new Set<string>(["g", "kg", "lb"]);
const VOLUME_UNITS = new Set<string>(["L", "gal"]);

export function toMoles(
  amount: number,
  unit: AmountUnit,
  substance: Substance
): number {
  if (unit === "mol") return amount;

  if (MASS_UNITS.has(unit)) {
    const grams = amount * MASS_TO_GRAMS[unit as MassUnit];
    return grams / substance.molarMass;
  }

  if (VOLUME_UNITS.has(unit)) {
    if (!substance.density) {
      throw new Error(
        `Volume conversion not available for ${substance.name} (no density data)`
      );
    }
    const ml = amount * VOLUME_TO_ML[unit as VolumeUnit];
    const grams = ml * substance.density;
    return grams / substance.molarMass;
  }

  throw new Error(`Unknown unit: ${unit}`);
}

export function fromMoles(
  moles: number,
  substance: Substance
): CalculationResult {
  const grams = moles * substance.molarMass;
  const isLiquid = substance.state === "liquid" && substance.density;

  return {
    substance,
    moles,
    grams,
    kilograms: grams / 1000,
    pounds: grams / 453.592,
    liters: isLiquid ? grams / substance.density! / 1000 : null,
    gallons: isLiquid ? grams / substance.density! / 3785.41 : null,
  };
}

/**
 * Pure stoichiometric calculation (100% conversion).
 * The conversion factor (reaction.conversion) is applied downstream:
 * - In system-calculation.ts when propagating through links
 * - In applyConversion() for single-reaction display
 */
export function calculateStoichiometry(
  reaction: BalancedReaction,
  input: CalculationInput
): CalculationResult[] {
  const allSubstances = [...reaction.reactants, ...reaction.products];
  const selected = allSubstances[input.substanceIndex];

  if (!selected) throw new Error("Invalid substance index");

  const inputMoles = toMoles(input.amount, input.unit, selected);

  return allSubstances.map((substance) => {
    const targetMoles =
      inputMoles * (substance.coefficient / selected.coefficient);
    return fromMoles(targetMoles, substance);
  });
}

/**
 * v2: Apply fractional conversion to stoichiometric results.
 * Products are scaled by conversion. Reactants show consumed amount (= stoich × conversion).
 * Returns a new array — does not mutate.
 */
export function applyConversion(
  results: CalculationResult[],
  reaction: BalancedReaction
): CalculationResult[] {
  const conversion = reaction.conversion ?? 1.0;
  if (conversion >= 1.0) return results; // no change needed

  return results.map((r) => {
    if (r.substance.role === "product") {
      return fromMoles(r.moles * conversion, r.substance);
    }
    // Reactants: consumed = stoich × conversion
    return fromMoles(r.moles * conversion, r.substance);
  });
}

function getQuantityForUnit(result: CalculationResult, unit: AmountUnit): number {
  switch (unit) {
    case "mol": return result.moles;
    case "g": return result.grams;
    case "kg": return result.kilograms;
    case "lb": return result.pounds;
    case "L": return result.liters ?? 0;
    case "gal": return result.gallons ?? 0;
    default: return 0;
  }
}

export function calculateEconomics(
  results: CalculationResult[],
  prices: Map<number, PriceEntry>
): EconomicsSummary {
  let reactantCost = 0;
  let productValue = 0;

  const perSubstance = results.map((r, i) => {
    const priceEntry = prices.get(i);
    const hasPrice = priceEntry && priceEntry.price !== null && priceEntry.price > 0;
    const totalCost = hasPrice
      ? priceEntry.price! * getQuantityForUnit(r, priceEntry.unit)
      : 0;

    if (r.substance.role === "reactant") {
      reactantCost += totalCost;
    } else {
      productValue += totalCost;
    }

    return {
      substance: r.substance,
      pricePerUnit: hasPrice ? priceEntry.price! : null,
      priceUnit: priceEntry?.unit ?? "g",
      totalCost,
      role: r.substance.role,
    };
  });

  return {
    perSubstance,
    reactantCost,
    productValue,
    delta: productValue - reactantCost,
  };
}

export function calculateThermodynamics(
  reaction: BalancedReaction,
  results: CalculationResult[]
): ThermodynamicsResult {
  const allSubstances = [...reaction.reactants, ...reaction.products];

  // ΔHrxn = Σ(n × ΔHf° products) - Σ(n × ΔHf° reactants)
  // Using stoichiometric coefficients
  let deltaHPerMoleOfReaction = 0;
  for (const s of reaction.products) {
    deltaHPerMoleOfReaction += s.coefficient * s.enthalpyOfFormation;
  }
  for (const s of reaction.reactants) {
    deltaHPerMoleOfReaction -= s.coefficient * s.enthalpyOfFormation;
  }

  // Scale factor: how many "units of reaction" are we running?
  // Use the first reactant to determine scale
  const firstReactant = reaction.reactants[0];
  const firstResult = results.find(
    (r) => r.substance.formula === firstReactant.formula && r.substance.role === "reactant"
  );
  const scaleFactor = firstResult
    ? firstResult.moles / firstReactant.coefficient
    : 1;

  const totalDeltaH = deltaHPerMoleOfReaction * scaleFactor;

  const perSubstance = allSubstances.map((substance, i) => {
    const result = results[i];
    // Heat contribution: positive for products' formation, negative for reactants'
    const sign = substance.role === "product" ? 1 : -1;
    const heatContribution =
      sign * result.moles * substance.enthalpyOfFormation;

    return {
      substance,
      moles: result.moles,
      enthalpyOfFormation: substance.enthalpyOfFormation,
      heatContribution,
    };
  });

  return {
    deltaH: totalDeltaH,
    isExothermic: totalDeltaH < 0,
    perSubstance,
  };
}
