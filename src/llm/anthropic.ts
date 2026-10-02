import type { ChatMessage, ChatResult, LlmProvider, ToolCall, ToolDefinition } from "../types.js";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
const MAX_TOKENS = 1024;

interface AnthropicBlock {
  type: "text" | "tool_use";
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

function toAnthropicMessages(messages: ChatMessage[]) {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => {
      if (m.role === "tool") {
        return {
          role: "user" as const,
          content: [{ type: "tool_result", tool_use_id: m.toolCallId, content: m.content }],
        };
      }
      if (m.role === "assistant" && m.toolCalls?.length) {
        const blocks: AnthropicBlock[] = [];
        if (m.content) blocks.push({ type: "text", text: m.content });
        for (const call of m.toolCalls) {
          blocks.push({ type: "tool_use", id: call.id, name: call.name, input: call.arguments });
        }
        return { role: "assistant" as const, content: blocks };
      }
      return { role: m.role as "user" | "assistant", content: m.content };
    });
}

export function createAnthropicProvider(apiKey: string, chatModel: string): LlmProvider {
  return {
    async chat(messages, tools: ToolDefinition[]): Promise<ChatResult> {
      const system = messages.find((m) => m.role === "system")?.content;
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": API_VERSION,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: chatModel,
          max_tokens: MAX_TOKENS,
          system,
          messages: toAnthropicMessages(messages),
          tools: tools.map((t) => ({
            name: t.name,
            description: t.description,
            input_schema: t.parameters,
          })),
        }),
      });
      if (!response.ok) {
        throw new Error(`Anthropic API error ${response.status}: ${await response.text()}`);
      }
      const body = (await response.json()) as {
        content: AnthropicBlock[];
        usage: { input_tokens: number; output_tokens: number };
      };
      const text = body.content
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("");
      const toolCalls: ToolCall[] = body.content
        .filter((b) => b.type === "tool_use")
        .map((b) => ({ id: b.id ?? "", name: b.name ?? "", arguments: b.input ?? {} }));
      return {
        message: { role: "assistant", content: text, toolCalls: toolCalls.length ? toolCalls : undefined },
        usage: { inputTokens: body.usage.input_tokens, outputTokens: body.usage.output_tokens },
      };
    },

    async embed(): Promise<number[][]> {
      throw new Error("Anthropic has no embeddings API; set EMBEDDING via ollama or openai instead.");
    },
  };
}
