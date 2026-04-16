import { parseAtoms } from "./utils";

/**
 * Solve for unknown stoichiometric coefficients given locked (known) ones.
 *
 * Formulation:
 *   For each atom: Σ(coeff_i × atomCount_i) for reactants = Σ(coeff_j × atomCount_j) for products
 *   Rearranging with reactants positive, products negative:
 *     Σ(sign_i × coeff_i × atomCount_i) = 0 for all atoms
 *   Moving locked terms to RHS:
 *     A_free × x_free = -A_locked × x_locked
 *
 * Uses Gaussian elimination with partial pivoting.
 */

export interface BalanceSolverInput {
  /** All substances in order: reactants first, then products */
  substances: Array<{ formula: string; isProduct: boolean }>;
  /** Which coefficients are locked (user-specified). Index matches substances array. */
  locked: Map<number, number>; // index → coefficient value
}

export interface BalanceSolverResult {
  success: boolean;
  /** Solved coefficients for all substances (locked ones unchanged) */
  coefficients: number[];
  /** Error message if !success */
  error?: string;
}

export interface DegreesOfFreedom {
  totalSubstances: number;
  lockedCount: number;
  atomCount: number;
  freeUnknowns: number;
  /** How many more the user needs to lock before we can solve */
  needToLock: number;
  canSolve: boolean;
}

/**
 * Calculate degrees of freedom for the current lock state.
 */
export function calcDegreesOfFreedom(
  substances: Array<{ formula: string }>,
  lockedCount: number
): DegreesOfFreedom {
  // Count distinct atoms across all substances
  const allAtoms = new Set<string>();
  for (const s of substances) {
    for (const [atom] of parseAtoms(s.formula)) {
      allAtoms.add(atom);
    }
  }

  const N = substances.length;
  const M = allAtoms.size;
  const free = N - lockedCount;
  const needToLock = Math.max(0, free - M);

  return {
    totalSubstances: N,
    lockedCount,
    atomCount: M,
    freeUnknowns: free,
    needToLock,
    canSolve: needToLock === 0 && lockedCount > 0,
  };
}

/**
 * Solve for the unknown coefficients.
 */
export function solveCoefficients(input: BalanceSolverInput): BalanceSolverResult {
  const { substances, locked } = input;
  const N = substances.length;

  // Build atom list
  const allAtoms = new Set<string>();
  for (const s of substances) {
    for (const [atom] of parseAtoms(s.formula)) {
      allAtoms.add(atom);
    }
  }
  const atomList = Array.from(allAtoms).sort();
  const M = atomList.length;
  const atomIndex = new Map(atomList.map((a, i) => [a, i]));

  // Build full composition matrix: rows = atoms, cols = substances
  // Sign convention: reactants positive, products negative
  const composition: number[][] = Array.from({ length: M }, () =>
    Array(N).fill(0)
  );
  for (let j = 0; j < N; j++) {
    const atoms = parseAtoms(substances[j].formula);
    const sign = substances[j].isProduct ? -1 : 1;
    for (const [atom, count] of atoms) {
      composition[atomIndex.get(atom)!][j] = sign * count;
    }
  }

  // Separate free and locked columns
  const freeIndices: number[] = [];
  const lockedIndices: number[] = [];
  for (let j = 0; j < N; j++) {
    if (locked.has(j)) {
      lockedIndices.push(j);
    } else {
      freeIndices.push(j);
    }
  }

  const nFree = freeIndices.length;
  if (nFree === 0) {
    // All locked — just return them
    const coeffs = Array(N).fill(0);
    for (const [idx, val] of locked) coeffs[idx] = val;
    return { success: true, coefficients: coeffs };
  }

  // Build A (free columns) and b = -A_locked × x_locked
  const A: number[][] = Array.from({ length: M }, () => Array(nFree).fill(0));
  const b: number[] = Array(M).fill(0);

  for (let i = 0; i < M; i++) {
    for (let jj = 0; jj < nFree; jj++) {
      A[i][jj] = composition[i][freeIndices[jj]];
    }
    for (const lIdx of lockedIndices) {
      b[i] -= composition[i][lIdx] * locked.get(lIdx)!;
    }
  }

  // Gaussian elimination with partial pivoting
  // Augmented matrix [A | b]
  const aug: number[][] = A.map((row, i) => [...row, b[i]]);
  const rows = aug.length;
  const cols = nFree;

  const pivotRow: number[] = []; // tracks which row was used for each column
  let row = 0;
  for (let col = 0; col < cols && row < rows; col++) {
    // Find pivot
    let maxVal = Math.abs(aug[row][col]);
    let maxRow = row;
    for (let r = row + 1; r < rows; r++) {
      if (Math.abs(aug[r][col]) > maxVal) {
        maxVal = Math.abs(aug[r][col]);
        maxRow = r;
      }
    }
    if (maxVal < 1e-12) continue; // skip zero column

    // Swap
    [aug[row], aug[maxRow]] = [aug[maxRow], aug[row]];

    // Eliminate below
    const pivot = aug[row][col];
    for (let r = row + 1; r < rows; r++) {
      const factor = aug[r][col] / pivot;
      for (let c = col; c <= cols; c++) {
        aug[r][c] -= factor * aug[row][c];
      }
    }
    pivotRow.push(row);
    row++;
  }

  // Check for inconsistency (non-zero row with all-zero coefficients)
  for (let r = row; r < rows; r++) {
    if (Math.abs(aug[r][cols]) > 1e-10) {
      return {
        success: false,
        coefficients: [],
        error: "No solution — the atom balance is inconsistent with the locked coefficients.",
      };
    }
  }

  // Check rank
  const rank = pivotRow.length;
  if (rank < nFree) {
    const extraNeeded = nFree - rank;
    return {
      success: false,
      coefficients: [],
      error: `Underdetermined — lock ${extraNeeded} more coefficient${extraNeeded > 1 ? "s" : ""} to solve.`,
    };
  }

  // Back substitution
  const x: number[] = Array(nFree).fill(0);
  for (let i = rank - 1; i >= 0; i--) {
    // Find pivot column for this row
    let pivotCol = -1;
    for (let c = 0; c < cols; c++) {
      if (Math.abs(aug[i][c]) > 1e-12) {
        pivotCol = c;
        break;
      }
    }
    if (pivotCol === -1) continue;

    let sum = aug[i][cols];
    for (let c = pivotCol + 1; c < cols; c++) {
      sum -= aug[i][c] * x[c];
    }
    x[pivotCol] = sum / aug[i][pivotCol];
  }

  // Validate: all coefficients must be positive
  const coefficients = Array(N).fill(0);
  for (const [idx, val] of locked) coefficients[idx] = val;
  let hasNegative = false;
  for (let i = 0; i < nFree; i++) {
    const val = Math.round(x[i] * 1e6) / 1e6; // clean floating point
    coefficients[freeIndices[i]] = val;
    if (val < 1e-10) hasNegative = true;
  }

  if (hasNegative) {
    return {
      success: false,
      coefficients,
      error: "Solution has zero or negative coefficients — check the locked values or reaction formulas.",
    };
  }

  // Try to find nice integer coefficients by scaling
  const freeVals = freeIndices.map((_, i) => coefficients[freeIndices[i]]);
  const scaled = tryIntegerScale(freeVals);
  if (scaled) {
    for (let i = 0; i < nFree; i++) {
      coefficients[freeIndices[i]] = scaled[i];
    }
    // Also scale locked values by the same factor
    const factor = scaled[0] / freeVals[0];
    if (Math.abs(factor - 1) > 1e-10) {
      // Only rescale if we actually scaled
      for (const idx of lockedIndices) {
        coefficients[idx] = Math.round(coefficients[idx] * factor * 1e6) / 1e6;
      }
    }
  }

  return { success: true, coefficients };
}

/**
 * Try to scale a set of positive values to small integers.
 * Returns the integer array or null if no clean scaling found.
 */
function tryIntegerScale(vals: number[]): number[] | null {
  if (vals.length === 0) return null;
  if (vals.some((v) => v <= 0)) return null;

  // Try multiplying by 1..20 and see if all become close to integers
  for (let mult = 1; mult <= 20; mult++) {
    const scaled = vals.map((v) => v * mult);
    const rounded = scaled.map((v) => Math.round(v));
    const allClose = scaled.every(
      (v, i) => Math.abs(v - rounded[i]) < 0.01
    );
    if (allClose && rounded.every((v) => v > 0)) {
      return rounded;
    }
  }
  return null;
}
