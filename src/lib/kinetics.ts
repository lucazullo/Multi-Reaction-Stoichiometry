import type { BalancedReaction, EquilibriumData, KineticsResult, RateLaw } from "./types";
import { R_GAS_J } from "./constants";
import { normalizeFormula } from "./utils";
import { keqAtTemperature } from "./equilibrium";

/**
 * Build a lookup function that matches formula keys regardless of
 * Unicode vs ASCII representation (e.g. "C₂H₅OH" matches "C2H5OH").
 */
function buildConcLookup(concentrations: Record<string, number>): (formula: string) => number {
  // Build a normalized-key → value map
  const normalized = new Map<string, number>();
  for (const [key, val] of Object.entries(concentrations)) {
    normalized.set(normalizeFormula(key), val);
  }
  return (formula: string) => normalized.get(normalizeFormula(formula)) ?? 0;
}

/**
 * Compute k(T) from the user-provided k(Tref) and Ea using the
 * practical Arrhenius form:
 *   k(T) = k(Tref) * exp( -(Ea/R) * (1/T - 1/Tref) )
 *
 * This is the correct form when the user specifies a rate constant
 * at a reference temperature. The pre-exponential factor A is NOT
 * used directly — it's only stored for display/export purposes.
 *
 * Ea in kJ/mol, R_GAS_J in J/(mol·K), so convert Ea to J.
 */
export function arrheniusK(rateLaw: RateLaw, T: number): number {
  const EaJ = rateLaw.activationEnergy * 1000; // kJ → J
  const Tref = rateLaw.referenceTemperature;

  // If T equals Tref, just return kRef directly (avoid floating-point drift)
  if (Math.abs(T - Tref) < 0.01) return rateLaw.rateConstant;

  return rateLaw.rateConstant * Math.exp(-(EaJ / R_GAS_J) * (1 / T - 1 / Tref));
}

/**
 * Compute the reaction rate given concentrations and the rate law.
 * rate = k * product(C_i ^ partialOrder_i)
 * Uses normalized formula matching to handle Unicode vs ASCII keys.
 */
function computeRate(
  rateLaw: RateLaw,
  kT: number,
  concentrations: Record<string, number>
): number {
  const lookup = buildConcLookup(concentrations);
  let rate = kT;
  for (const [formula, order] of Object.entries(rateLaw.partialOrders)) {
    const conc = lookup(formula);
    if (conc <= 0 && order > 0) return 0;
    rate *= Math.pow(Math.max(0, conc), order);
  }
  return rate;
}

/**
 * Compute the reverse reaction rate when equilibrium data is available.
 * k_reverse = k_forward / Keq(T)
 * reverse rate = k_reverse × product([product_j]^coeff_j)
 *
 * Uses stoichiometric coefficients as the orders for the reverse rate law
 * (microscopic reversibility for elementary reactions).
 */
function computeReverseRate(
  reaction: BalancedReaction,
  kReverse: number,
  concentrations: Record<string, number>
): number {
  const lookup = buildConcLookup(concentrations);
  let rate = kReverse;
  for (const p of reaction.products) {
    const conc = lookup(p.formula);
    if (conc <= 0 && p.coefficient > 0) return 0;
    rate *= Math.pow(Math.max(0, conc), p.coefficient);
  }
  return rate;
}

/**
 * Compute dC/dt for each species.
 *
 * If equilibrium data is present:
 *   net rate = forward rate - reverse rate
 *   where k_reverse = k_forward / Keq(T)
 *   This ensures the system naturally approaches equilibrium.
 *
 * If no equilibrium data:
 *   net rate = forward rate only (irreversible reaction)
 */
function derivatives(
  reaction: BalancedReaction,
  rateLaw: RateLaw,
  kT: number,
  kReverse: number | null,
  concentrations: Record<string, number>
): Record<string, number> {
  const forwardRate = computeRate(rateLaw, kT, concentrations);
  const reverseRate = kReverse !== null
    ? computeReverseRate(reaction, kReverse, concentrations)
    : 0;
  const netRate = forwardRate - reverseRate;

  const dCdt: Record<string, number> = {};

  for (const r of reaction.reactants) {
    dCdt[r.formula] = -r.coefficient * netRate;
  }
  for (const p of reaction.products) {
    dCdt[p.formula] = p.coefficient * netRate;
  }

  return dCdt;
}

/**
 * 4th-order Runge-Kutta integrator for reaction kinetics.
 */
function rk4Step(
  reaction: BalancedReaction,
  rateLaw: RateLaw,
  kT: number,
  kReverse: number | null,
  state: Record<string, number>,
  dt: number
): Record<string, number> {
  const allFormulas = Object.keys(state);

  const add = (a: Record<string, number>, b: Record<string, number>, scale: number): Record<string, number> => {
    const result: Record<string, number> = {};
    for (const f of allFormulas) {
      result[f] = a[f] + b[f] * scale;
    }
    return result;
  };

  const k1 = derivatives(reaction, rateLaw, kT, kReverse, state);
  const k2 = derivatives(reaction, rateLaw, kT, kReverse, add(state, k1, dt / 2));
  const k3 = derivatives(reaction, rateLaw, kT, kReverse, add(state, k2, dt / 2));
  const k4 = derivatives(reaction, rateLaw, kT, kReverse, add(state, k3, dt));

  const next: Record<string, number> = {};
  for (const f of allFormulas) {
    next[f] = Math.max(0, state[f] + (dt / 6) * (k1[f] + 2 * k2[f] + 2 * k3[f] + k4[f]));
  }
  return next;
}

/**
 * Integrate kinetics for a reaction over time.
 *
 * @param reaction - The balanced reaction with rate law
 * @param initialConcentrations - formula → initial concentration in mol/L
 * @param temperature - Temperature in K
 * @param totalTime - Total integration time in seconds
 * @param numPoints - Number of output time points
 */
export function integrateKinetics(
  reaction: BalancedReaction,
  initialConcentrations: Record<string, number>,
  temperature: number,
  totalTime: number,
  numPoints: number = 200
): KineticsResult {
  const rateLaw = reaction.rateLaw;
  if (!rateLaw) throw new Error("No rate law data for this reaction");

  const kT = arrheniusK(rateLaw, temperature);
  const dt = totalTime / numPoints;

  // If equilibrium data is available, compute the reverse rate constant
  // k_reverse = k_forward / Keq(T)
  // This ensures the kinetics naturally approach equilibrium
  let kReverse: number | null = null;
  if (reaction.equilibrium) {
    const keq = keqAtTemperature(reaction.equilibrium, temperature);
    if (keq > 0 && isFinite(keq)) {
      kReverse = kT / keq;
    }
  }

  // Validate: check for formula mismatches (using normalized matching)
  const normalizedConcKeys = new Set(Object.keys(initialConcentrations).map(normalizeFormula));
  for (const key of Object.keys(rateLaw.partialOrders)) {
    if (!normalizedConcKeys.has(normalizeFormula(key))) {
      throw new Error(
        `Rate law species "${key}" not found in initial concentrations. ` +
        `Available species: ${Object.keys(initialConcentrations).join(", ")}.`
      );
    }
  }

  // Initialize
  const allFormulas = [
    ...reaction.reactants.map((r) => r.formula),
    ...reaction.products.map((p) => p.formula),
  ];

  let state: Record<string, number> = {};
  for (const f of allFormulas) {
    state[f] = initialConcentrations[f] ?? 0;
  }

  // Output arrays
  const timePoints: number[] = [0];
  const concentrations: Record<string, number[]> = {};
  for (const f of allFormulas) {
    concentrations[f] = [state[f]];
  }

  // Integrate using adaptive step size (subdivide dt if needed for stability)
  for (let i = 1; i <= numPoints; i++) {
    // Use smaller internal steps for stability
    const subSteps = 10;
    const subDt = dt / subSteps;
    for (let j = 0; j < subSteps; j++) {
      state = rk4Step(reaction, rateLaw, kT, kReverse, state, subDt);
    }

    timePoints.push(i * dt);
    for (const f of allFormulas) {
      concentrations[f].push(state[f]);
    }
  }

  // Estimate half-life (time for first reactant to drop to half initial)
  let halfLife: number | null = null;
  const firstReactant = reaction.reactants[0];
  if (firstReactant) {
    const c0 = initialConcentrations[firstReactant.formula] ?? 0;
    const halfTarget = c0 / 2;
    const concArray = concentrations[firstReactant.formula];
    for (let i = 1; i < concArray.length; i++) {
      if (concArray[i] <= halfTarget && concArray[i - 1] > halfTarget) {
        // Linear interpolation
        const frac = (concArray[i - 1] - halfTarget) / (concArray[i - 1] - concArray[i]);
        halfLife = timePoints[i - 1] + frac * dt;
        break;
      }
    }
  }

  const initialRate = computeRate(rateLaw, kT, initialConcentrations);

  const keq = reaction.equilibrium ? keqAtTemperature(reaction.equilibrium, temperature) : null;

  return {
    reactionId: "", // filled by caller
    timePoints,
    concentrations,
    halfLife,
    rateAtT: initialRate,
    rateConstantAtT: kT,
    reversible: kReverse !== null,
    keqAtT: keq,
    kReverseAtT: kReverse,
  };
}
