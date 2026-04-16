import type {
  BalancedReaction,
  EquilibriumData,
  EquilibriumResult,
  LeChatelierShift,
} from "./types";
import { R_GAS } from "./constants";

/**
 * Compute Keq at temperature T using the van't Hoff equation.
 * ln(Keq(T)) = ln(Keq(Tref)) - (deltaH / R) * (1/T - 1/Tref)
 */
export function keqAtTemperature(eq: EquilibriumData, T: number): number {
  const lnKeqRef = Math.log(eq.keq);
  const lnKeqT = lnKeqRef - (eq.deltaH / R_GAS) * (1 / T - 1 / eq.referenceTemperature);
  return Math.exp(lnKeqT);
}

/**
 * Solve for equilibrium concentrations using the extent-of-reaction (xi) method.
 *
 * For a reaction: aA + bB → cC + dD
 * At equilibrium: [X] = (n_X + nu_X * xi) / V
 * where nu is negative for reactants, positive for products.
 *
 * Keq = product([products]^coeff) / product([reactants]^coeff)
 *
 * Uses Newton-Raphson with bisection fallback.
 */
export function solveEquilibrium(
  reaction: BalancedReaction,
  initialMoles: Record<string, number>, // formula → initial moles
  volume: number, // liters
  temperature: number // K
): EquilibriumResult {
  const eq = reaction.equilibrium;
  if (!eq) throw new Error("No equilibrium data for this reaction");

  const keq = keqAtTemperature(eq, temperature);

  // Build species list with stoichiometric coefficients (nu)
  // Negative for reactants, positive for products
  const species: Array<{ formula: string; nu: number; n0: number }> = [];

  for (const r of reaction.reactants) {
    species.push({
      formula: r.formula,
      nu: -r.coefficient,
      n0: initialMoles[r.formula] ?? 0,
    });
  }
  for (const p of reaction.products) {
    species.push({
      formula: p.formula,
      nu: p.coefficient,
      n0: initialMoles[p.formula] ?? 0,
    });
  }

  // Determine valid range for xi:
  // For each species: n0 + nu * xi >= 0
  // If nu < 0 (reactant): xi <= n0 / |nu|
  // If nu > 0 (product): xi >= -n0 / nu (usually 0 if no initial products)
  let xiMax = Infinity;
  let xiMin = -Infinity;

  for (const s of species) {
    if (s.nu < 0) {
      xiMax = Math.min(xiMax, s.n0 / Math.abs(s.nu));
    } else if (s.nu > 0) {
      xiMin = Math.max(xiMin, -s.n0 / s.nu);
    }
  }

  // Clamp to reasonable range
  if (xiMin < 0) xiMin = 0;
  if (xiMax <= 0) xiMax = 1e-10;

  // Function: f(xi) = Q(xi) - Keq = 0
  // Q = product(C_i^|nu_i|) for products / product(C_i^|nu_i|) for reactants
  const computeQ = (xi: number): number => {
    let numerator = 1;
    let denominator = 1;

    for (const s of species) {
      const conc = (s.n0 + s.nu * xi) / volume;
      if (conc <= 0) return s.nu > 0 ? 0 : Infinity;

      if (s.nu > 0) {
        numerator *= Math.pow(conc, Math.abs(s.nu));
      } else {
        denominator *= Math.pow(conc, Math.abs(s.nu));
      }
    }

    return denominator === 0 ? Infinity : numerator / denominator;
  };

  // f(xi) = ln(Q(xi)) - ln(Keq) for numerical stability
  const f = (xi: number): number => {
    const q = computeQ(xi);
    if (q <= 0) return -1e10;
    if (!isFinite(q)) return 1e10;
    return Math.log(q) - Math.log(keq);
  };

  // Numerical derivative
  const df = (xi: number): number => {
    const h = Math.max(Math.abs(xi) * 1e-8, 1e-12);
    return (f(xi + h) - f(xi - h)) / (2 * h);
  };

  // Newton-Raphson with bisection fallback
  let xi = (xiMin + xiMax) / 2;
  let converged = false;

  for (let iter = 0; iter < 100; iter++) {
    const fVal = f(xi);

    if (Math.abs(fVal) < 1e-10) {
      converged = true;
      break;
    }

    const dfVal = df(xi);
    if (Math.abs(dfVal) > 1e-15) {
      const xiNew = xi - fVal / dfVal;

      // Check if Newton step is within bounds
      if (xiNew > xiMin && xiNew < xiMax) {
        xi = xiNew;
        continue;
      }
    }

    // Bisection fallback
    const fMin = f(xiMin);
    if (fMin * fVal < 0) {
      xiMax = xi;
    } else {
      xiMin = xi;
    }
    xi = (xiMin + xiMax) / 2;
  }

  // Compute equilibrium concentrations
  const equilibriumConcentrations: Record<string, number> = {};
  for (const s of species) {
    equilibriumConcentrations[s.formula] = Math.max(0, (s.n0 + s.nu * xi) / volume);
  }

  // Compute Q for initial state (to determine direction)
  const Q0 = computeQ(0);
  let direction: EquilibriumResult["direction"];
  if (Math.abs(Q0 - keq) / keq < 0.01) {
    direction = "at-equilibrium";
  } else if (Q0 < keq) {
    direction = "forward";
  } else {
    direction = "reverse";
  }

  // Le Chatelier analysis
  const shifts = analyzeLeChatelierShifts(reaction, eq);

  return {
    reactionId: "", // filled by caller
    keqAtT: keq,
    equilibriumConcentrations,
    reactionQuotient: Q0,
    direction,
    shifts,
  };
}

/**
 * Qualitative Le Chatelier analysis.
 */
function analyzeLeChatelierShifts(
  reaction: BalancedReaction,
  eq: EquilibriumData
): LeChatelierShift[] {
  const shifts: LeChatelierShift[] = [];

  // Temperature
  if (eq.deltaH < 0) {
    // Exothermic
    shifts.push({
      perturbation: "Increase temperature",
      direction: "reverse",
      explanation: "Exothermic reaction (ΔH < 0): heat is a product, so increasing temperature shifts equilibrium toward reactants.",
    });
    shifts.push({
      perturbation: "Decrease temperature",
      direction: "forward",
      explanation: "Exothermic reaction: lowering temperature favors product formation.",
    });
  } else {
    // Endothermic
    shifts.push({
      perturbation: "Increase temperature",
      direction: "forward",
      explanation: "Endothermic reaction (ΔH > 0): heat is a reactant, so increasing temperature shifts equilibrium toward products.",
    });
    shifts.push({
      perturbation: "Decrease temperature",
      direction: "reverse",
      explanation: "Endothermic reaction: lowering temperature favors reactant formation.",
    });
  }

  // Pressure (count gas moles)
  const gasReactantMoles = reaction.reactants
    .filter((s) => s.state === "gas")
    .reduce((sum, s) => sum + s.coefficient, 0);
  const gasProductMoles = reaction.products
    .filter((s) => s.state === "gas")
    .reduce((sum, s) => sum + s.coefficient, 0);

  if (gasReactantMoles !== gasProductMoles) {
    const fewerGasSide = gasProductMoles < gasReactantMoles ? "forward" : "reverse";
    shifts.push({
      perturbation: "Increase pressure",
      direction: fewerGasSide,
      explanation: `${gasReactantMoles} mol gas on reactant side vs ${gasProductMoles} mol on product side. Higher pressure favors the side with fewer gas moles.`,
    });
    shifts.push({
      perturbation: "Decrease pressure",
      direction: fewerGasSide === "forward" ? "reverse" : "forward",
      explanation: `Lower pressure favors the side with more gas moles (${Math.max(gasReactantMoles, gasProductMoles)} mol).`,
    });
  } else if (gasReactantMoles > 0) {
    shifts.push({
      perturbation: "Change pressure",
      direction: "forward", // technically no shift
      explanation: `Equal gas moles on both sides (${gasReactantMoles}). Pressure changes do not shift the equilibrium.`,
    });
  }

  // Adding reactant / product
  shifts.push({
    perturbation: "Add more reactant",
    direction: "forward",
    explanation: "Adding reactant increases Q below Keq, shifting equilibrium toward products.",
  });
  shifts.push({
    perturbation: "Add more product",
    direction: "reverse",
    explanation: "Adding product increases Q above Keq, shifting equilibrium toward reactants.",
  });

  return shifts;
}
