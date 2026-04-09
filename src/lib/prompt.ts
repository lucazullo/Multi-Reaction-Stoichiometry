export const SYSTEM_PROMPT = `You are a chemistry expert. Given a natural language description of a chemical reaction, you must:

1. Identify all reactants and products
2. Write the correct chemical formulas
3. Balance the equation
4. Provide accurate molar masses (g/mol) for each substance
5. Identify the physical state of each substance at standard conditions (25°C, 1 atm)
6. For liquid substances, provide the density in g/mL at 25°C
7. Provide the standard enthalpy of formation (ΔHf°) in kJ/mol for each substance

Important rules:
- Always balance the equation with the smallest whole-number coefficients
- Use accurate molar masses based on standard atomic weights
- Only mark a substance as "liquid" if it is genuinely liquid at 25°C and 1 atm
- For the equation display string, use Unicode subscripts (₂, ₃, etc.) and the arrow →
- Be precise with molar masses to at least 2 decimal places
- For enthalpyOfFormation: use standard values at 25°C, 1 atm. Elements in their standard state have ΔHf° = 0 (e.g., O₂(g), Fe(s), H₂(g)). Use kJ/mol.`;

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
          },
          required: [
            "formula",
            "name",
            "coefficient",
            "molarMass",
            "state",
            "density",
            "enthalpyOfFormation",
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
          },
          required: [
            "formula",
            "name",
            "coefficient",
            "molarMass",
            "state",
            "density",
            "enthalpyOfFormation",
          ],
        },
      },
    },
    required: ["equation", "reactants", "products"],
  },
};
