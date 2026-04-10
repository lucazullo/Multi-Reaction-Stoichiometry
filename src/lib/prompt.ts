export const SYSTEM_PROMPT = `You are a chemistry expert. Given a natural language description of a chemical reaction, you must:

1. Identify all reactants and products
2. Write the correct chemical formulas
3. Balance the equation
4. Provide accurate molar masses (g/mol) for each substance
5. Identify the physical state of each substance at standard conditions (25°C, 1 atm)
6. For liquid substances, provide the density in g/mL at 25°C
7. For gaseous substances, provide the gas density in kg/m³ at STP (0°C, 1 atm)
8. Provide the standard enthalpy of formation (ΔHf°) in kJ/mol for each substance
9. For combustible substances, provide the Higher Heating Value (HHV) and Lower Heating Value (LHV) in kJ/kg

Important rules:
- Always balance the equation with the smallest whole-number coefficients
- Use accurate molar masses based on standard atomic weights
- Only mark a substance as "liquid" if it is genuinely liquid at 25°C and 1 atm
- For the equation display string, use Unicode subscripts (₂, ₃, etc.) and the arrow →
- Be precise with molar masses to at least 2 decimal places
- For enthalpyOfFormation: use standard values at 25°C, 1 atm. Elements in their standard state have ΔHf° = 0 (e.g., O₂(g), Fe(s), H₂(g)). Use kJ/mol.
- For densityGas: use kg/m³ at STP (0°C, 1 atm). For ideal gases, this is approximately molarMass/22.414. Null for non-gases.
- For hhv: provide the Higher Heating Value in kJ/kg. This is the total heat released when a substance undergoes complete combustion including condensation of water vapor. Null for non-combustible substances (e.g., N₂, H₂O, CO₂).
- For lhv: provide the Lower Heating Value in kJ/kg. Same as HHV but water remains as vapor. Null for non-combustible substances.`;

export const TOOL_SCHEMA = {
  name: "balanced_equation",
  description:
    "Return the balanced chemical equation with substance metadata for each reactant and product",
  input_schema: {
    type: "object" as const,
    properties: {
      equation: {
        type: "string",
        description:
          'The balanced equation using Unicode subscripts and arrow, e.g. "2H₂ + O₂ → 2H₂O"',
      },
      reactants: {
        type: "array",
        items: {
          type: "object",
          properties: {
            formula: {
              type: "string",
              description: 'Chemical formula, e.g. "H₂O"',
            },
            name: {
              type: "string",
              description: 'Common name, e.g. "water"',
            },
            coefficient: {
              type: "number",
              description: "Stoichiometric coefficient in the balanced equation",
            },
            molarMass: {
              type: "number",
              description: "Molar mass in g/mol",
            },
            state: {
              type: "string",
              enum: ["solid", "liquid", "gas", "aqueous"],
              description: "Physical state at 25°C, 1 atm",
            },
            density: {
              type: ["number", "null"],
              description:
                "Density in g/mL at 25°C. Required for liquids, null for others.",
            },
            enthalpyOfFormation: {
              type: "number",
              description:
                "Standard enthalpy of formation ΔHf° in kJ/mol at 25°C, 1 atm. Elements in standard state = 0.",
            },
            densityGas: {
              type: ["number", "null"],
              description:
                "Gas density in kg/m³ at STP (0°C, 1 atm). For ideal gases ≈ molarMass/22.414. Null for non-gases.",
            },
            hhv: {
              type: ["number", "null"],
              description:
                "Higher Heating Value in kJ/kg. Heat released on complete combustion including water condensation. Null for non-combustible substances.",
            },
            lhv: {
              type: ["number", "null"],
              description:
                "Lower Heating Value in kJ/kg. Same as HHV but water remains as vapor. Null for non-combustible substances.",
            },
          },
          required: [
            "formula",
            "name",
            "coefficient",
            "molarMass",
            "state",
            "density",
            "enthalpyOfFormation",
            "densityGas",
            "hhv",
            "lhv",
          ],
        },
      },
      products: {
        type: "array",
        items: {
          type: "object",
          properties: {
            formula: {
              type: "string",
              description: 'Chemical formula, e.g. "H₂O"',
            },
            name: {
              type: "string",
              description: 'Common name, e.g. "water"',
            },
            coefficient: {
              type: "number",
              description: "Stoichiometric coefficient in the balanced equation",
            },
            molarMass: {
              type: "number",
              description: "Molar mass in g/mol",
            },
            state: {
              type: "string",
              enum: ["solid", "liquid", "gas", "aqueous"],
              description: "Physical state at 25°C, 1 atm",
            },
            density: {
              type: ["number", "null"],
              description:
                "Density in g/mL at 25°C. Required for liquids, null for others.",
            },
            enthalpyOfFormation: {
              type: "number",
              description:
                "Standard enthalpy of formation ΔHf° in kJ/mol at 25°C, 1 atm. Elements in standard state = 0.",
            },
            densityGas: {
              type: ["number", "null"],
              description:
                "Gas density in kg/m³ at STP (0°C, 1 atm). For ideal gases ≈ molarMass/22.414. Null for non-gases.",
            },
            hhv: {
              type: ["number", "null"],
              description:
                "Higher Heating Value in kJ/kg. Heat released on complete combustion including water condensation. Null for non-combustible substances.",
            },
            lhv: {
              type: ["number", "null"],
              description:
                "Lower Heating Value in kJ/kg. Same as HHV but water remains as vapor. Null for non-combustible substances.",
            },
          },
          required: [
            "formula",
            "name",
            "coefficient",
            "molarMass",
            "state",
            "density",
            "enthalpyOfFormation",
            "densityGas",
            "hhv",
            "lhv",
          ],
        },
      },
    },
    required: ["equation", "reactants", "products"],
  },
};
