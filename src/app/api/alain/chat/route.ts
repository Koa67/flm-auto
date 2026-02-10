import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ALAIN_SYSTEM_PROMPT } from "@/lib/alain/prompts";
import { ALAIN_TOOLS } from "@/lib/alain/tools";
import { executeTool } from "@/lib/alain/execute-tool";
import { alainChatSchema } from "@/lib/validators";

const MAX_TURNS = 5;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  const body = await req.json();
  const parsed = alainChatSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Données invalides" }, { status: 400 });
  }

  const messages: ChatMessage[] = parsed.data.messages;
  const vehicleContext: string | undefined = parsed.data.vehicleContext;

  const client = new Anthropic({ apiKey });

  // Build system prompt with optional vehicle context
  let systemPrompt = ALAIN_SYSTEM_PROMPT;
  if (vehicleContext) {
    systemPrompt += `\n\n## Contexte actuel\nL'utilisateur consulte actuellement : ${vehicleContext}. Utilise cette info pour contextualiser tes réponses.`;
  }

  // Convert to Anthropic message format
  const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Agentic loop: model may call tools, we execute and loop
  let turns = 0;
  let finalText = "";

  while (turns < MAX_TURNS) {
    turns++;

    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system: systemPrompt,
      tools: ALAIN_TOOLS,
      messages: anthropicMessages,
    });

    // Check if the model wants to use tools
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ContentBlock & { type: "tool_use" } =>
        b.type === "tool_use"
    );
    const textBlocks = response.content.filter(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );

    if (toolUseBlocks.length === 0) {
      // No tool calls — we have the final answer
      finalText = textBlocks.map((b) => b.text).join("");
      break;
    }

    // Add assistant message with tool use to conversation
    anthropicMessages.push({
      role: "assistant",
      content: response.content,
    });

    // Execute all tool calls in parallel
    const toolResults = await Promise.all(
      toolUseBlocks.map(async (toolUse) => {
        const result = await executeTool(
          toolUse.name,
          toolUse.input as Record<string, unknown>
        );
        return {
          type: "tool_result" as const,
          tool_use_id: toolUse.id,
          content: result,
        };
      })
    );

    // Add tool results to conversation
    anthropicMessages.push({
      role: "user",
      content: toolResults,
    });

    // If stop reason is end_turn (with text), use that text
    if (response.stop_reason === "end_turn" && textBlocks.length > 0) {
      finalText = textBlocks.map((b) => b.text).join("");
      // But we still have tool calls to process, so continue
    }
  }

  return Response.json({
    message: finalText,
    turns_used: turns,
  });
}
