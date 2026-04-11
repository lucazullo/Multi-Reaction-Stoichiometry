import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, TOOL_SCHEMA } from "@/lib/prompt";
import type { BalancedReaction, Substance } from "@/lib/types";

const client = new Anthropic();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const description = body?.description?.trim();

    if (!description || typeof description !== "string") {
      return Response.json(
        { success: false, error: "Please provide a reaction description." },
        { status: 400 }
      );
    }

    if (description.length > 500) {
      return Response.json(
        { success: false, error: "Description too long (max 500 characters)." },
        { status: 400 }
      );
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [TOOL_SCHEMA],
      tool_choice: { type: "tool", name: "balanced_equation" },
      messages: [
        {
          role: "user",
          content: `Parse this chemical reaction and return the balanced equation: "${description}"`,
        },
      ],
    });

    const toolBlock = response.content.find(
      (block) => block.type === "tool_use"
    );
    if (!toolBlock || toolBlock.type !== "tool_use") {
      return Response.json(
        { success: false, error: "Failed to parse the reaction. Try again." },
        { status: 502 }
      );
    }

    const raw = toolBlock.input as {
      equation: string;
      reactants: Array<Omit<Substance, "role">>;
      products: Array<Omit<Substance, "role">>;
    };

    // Ensure all optional fields have defaults
    const withDefaults = (s: Record<string, unknown>) => ({
      ...s,
      density: s.density ?? null,
      densityGas: s.densityGas ?? null,
      hhv: s.hhv ?? null,
      lhv: s.lhv ?? null,
      enthalpyOfFormation: s.enthalpyOfFormation ?? 0,
    });

    const data: BalancedReaction = {
      equation: raw.equation,
      reactants: raw.reactants.map((r) => ({ ...withDefaults(r), role: "reactant" as const })) as BalancedReaction["reactants"],
      products: raw.products.map((p) => ({ ...withDefaults(p), role: "product" as const })) as BalancedReaction["products"],
    };

    return Response.json({ success: true, data });
  } catch (err) {
    console.error("Parse reaction error:", err);
    let message = "An unexpected error occurred.";
    if (err instanceof Anthropic.APIError) {
      if (err.status === 401) {
        message = "Invalid API key. Please check your ANTHROPIC_API_KEY in .env.local.";
      } else if (err.message?.includes("credit balance")) {
        message = "Anthropic API credit balance is too low. Please add credits at console.anthropic.com.";
      } else {
        message = "AI service temporarily unavailable. Please try again.";
      }
    }
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
