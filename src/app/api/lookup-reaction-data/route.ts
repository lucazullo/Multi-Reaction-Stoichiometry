import Anthropic from "@anthropic-ai/sdk";
import type { LookupRequest, LookupResponse, RateLaw, EquilibriumData, Reference } from "@/lib/types";

const client = new Anthropic();

const LOOKUP_SYSTEM_PROMPT = `You are a chemistry and chemical engineering expert with extensive knowledge of reaction kinetics and thermodynamics from authoritative sources (NIST Chemistry WebBook, CRC Handbook, Perry's Chemical Engineers' Handbook, Atkins' Physical Chemistry, and peer-reviewed journals).

When asked about a chemical reaction, provide the best available data from the literature. For each piece of data:
- Cite the specific source (author, year, journal/book, and DOI/URL if known)
- Rate your confidence: "high" (multiple reliable sources agree), "medium" (one reliable source), "low" (estimated or uncertain)
- Note the conditions (temperature, pressure, catalyst) the data applies to
- If data is unavailable, say so honestly rather than guessing

IMPORTANT for URLs/links:
- Only provide a URL if you are confident it points to a SPECIFIC page with the relevant data (e.g., a DOI link like https://doi.org/10.1021/..., or a NIST WebBook compound page with ID parameter)
- Do NOT provide generic homepage URLs (e.g., https://webbook.nist.gov/ or https://www.nist.gov/)
- If you only know the general source but not the specific URL, set the url field to null and describe the source in the citation text instead
- A null URL with a good text citation is more useful than a generic link`;

const LOOKUP_TOOL_SCHEMA = {
  name: "reaction_data",
  description: "Return kinetic and equilibrium data for a chemical reaction from the scientific literature",
  input_schema: {
    type: "object" as const,
    properties: {
      rateLaw: {
        type: ["object", "null"],
        description: "Rate law parameters if available. Null if no kinetic data found.",
        properties: {
          expression: { type: "string", description: 'Rate law expression, e.g. "k[A][B]"' },
          order: { type: "number", description: "Overall reaction order" },
          partialOrders: {
            type: "object",
            description: "Partial orders per species (formula → order)",
            additionalProperties: { type: "number" },
          },
          rateConstant: { type: "number", description: "Rate constant k at reference temperature" },
          rateConstantUnit: { type: "string", description: 'Unit of k, e.g. "1/s", "L/(mol·s)"' },
          referenceTemperature: { type: "number", description: "Reference temperature in K" },
          activationEnergy: { type: "number", description: "Activation energy Ea in kJ/mol" },
          preExponentialFactor: { type: "number", description: "Pre-exponential factor A (same units as k)" },
          source: { type: "string", description: "Primary source for the kinetic data" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
      },
      equilibrium: {
        type: ["object", "null"],
        description: "Equilibrium data if available. Null if no equilibrium data found.",
        properties: {
          keq: { type: "number", description: "Equilibrium constant at reference temperature" },
          referenceTemperature: { type: "number", description: "Reference temperature in K" },
          deltaH: { type: "number", description: "Reaction enthalpy in kJ/mol (for van't Hoff)" },
          source: { type: "string", description: "Primary source for the equilibrium data" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
      },
      references: {
        type: "array",
        description: "All literature sources cited",
        items: {
          type: "object",
          properties: {
            citation: { type: "string", description: 'Full citation, e.g. "Smith, J. (2020). J. Phys. Chem. A, 124(3), 456-462"' },
            url: { type: ["string", "null"], description: "URL or DOI link if available" },
            dataType: { type: "string", description: 'What this reference provides, e.g. "rate constant", "Keq", "activation energy"' },
          },
          required: ["citation", "url", "dataType"],
        },
      },
      additionalNotes: {
        type: ["string", "null"],
        description: "Any caveats, conditions, alternative values, or explanations",
      },
    },
    required: ["rateLaw", "equilibrium", "references", "additionalNotes"],
  },
};

export async function POST(request: Request) {
  try {
    const body: LookupRequest = await request.json();
    const { equation, reactants, products, useWebSearch, requestedData } = body;

    if (!equation || !reactants?.length || !products?.length) {
      return Response.json(
        { success: false, error: "Missing required reaction data.", references: [] },
        { status: 400 }
      );
    }

    const dataTypes = requestedData.join(", ");
    const userMessage = `Look up published ${dataTypes} data for this reaction:

Equation: ${equation}
Reactants: ${reactants.join(", ")}
Products: ${products.join(", ")}

Provide the best available data from authoritative sources. Include proper citations with DOI/URL when possible.`;

    // Build message params — optionally enable web search
    const messageParams: Anthropic.MessageCreateParams = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      temperature: 0, // deterministic — same query should give same numbers
      system: LOOKUP_SYSTEM_PROMPT,
      tools: [LOOKUP_TOOL_SCHEMA],
      tool_choice: { type: "tool", name: "reaction_data" },
      messages: [{ role: "user", content: userMessage }],
    };

    // If web search requested, add the web search tool
    if (useWebSearch) {
      messageParams.tools = [
        { type: "web_search_20250305", name: "web_search", max_uses: 3 },
        LOOKUP_TOOL_SCHEMA,
      ];
      // Let the model decide when to use web search vs. the tool
      messageParams.tool_choice = { type: "auto" };
    }

    const response = await client.messages.create(messageParams);

    // Find the tool use result
    const toolBlock = response.content.find(
      (block) => block.type === "tool_use" && block.name === "reaction_data"
    );

    if (!toolBlock || toolBlock.type !== "tool_use") {
      return Response.json(
        { success: false, error: "No data found for this reaction.", references: [] },
        { status: 200 }
      );
    }

    const raw = toolBlock.input as {
      rateLaw: (RateLaw & { source: string; confidence: "high" | "medium" | "low" }) | null;
      equilibrium: (EquilibriumData & { source: string; confidence: "high" | "medium" | "low" }) | null;
      references: Reference[];
      additionalNotes: string | null;
    };

    const result: LookupResponse = {
      success: true,
      rateLaw: raw.rateLaw ?? undefined,
      equilibrium: raw.equilibrium ?? undefined,
      references: raw.references ?? [],
      additionalNotes: raw.additionalNotes ?? undefined,
    };

    return Response.json(result);
  } catch (err) {
    console.error("Lookup reaction data error:", err);
    let message = "An unexpected error occurred during literature lookup.";
    if (err instanceof Anthropic.APIError) {
      if (err.status === 401) {
        message = "Invalid API key. Please check your ANTHROPIC_API_KEY.";
      } else {
        message = "AI service temporarily unavailable. Please try again.";
      }
    }
    return Response.json({ success: false, error: message, references: [] }, { status: 500 });
  }
}
