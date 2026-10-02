import type { ChatMessage, ChatResult, LlmProvider, ToolCall, ToolDefinition } from "../types.js";

const CHAT_URL = "https://api.openai.com/v1/chat/completions";
const EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";

interface OpenAiToolCall {
  id: string;
  function: { name: string; arguments: string };
}

function toOpenAiMessages(messages: ChatMessage[]) {
  return messages.map((m) => {
    if (m.role === "tool") {
      return { role: "tool" as const, tool_call_id: m.toolCallId, content: m.content };
    }
    if (m.role === "assistant" && m.toolCalls?.length) {
      return {
        role: "assistant" as const,
        content: m.content || null,
        tool_calls: m.toolCalls.map((c) => ({
          id: c.id,
          type: "function" as const,
          function: { name: c.name, arguments: JSON.stringify(c.arguments) },
        })),
      };
    }
    return { role: m.role, content: m.content };
  });
}

export function createOpenAiProvider(apiKey: string, chatModel: string, embeddingModel: string): LlmProvider {
  return {
    async chat(messages, tools: ToolDefinition[]): Promise<ChatResult> {
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: chatModel,
          messages: toOpenAiMessages(messages),
          tools: tools.map((t) => ({
            type: "function",
            function: { name: t.name, description: t.description, parameters: t.parameters },
          })),
        }),
      });
      if (!response.ok) {
        throw new Error(`OpenAI API error ${response.status}: ${await response.text()}`);
      }
      const body = (await response.json()) as {
        choices: { message: { content: string | null; tool_calls?: OpenAiToolCall[] } }[];
        usage: { prompt_tokens: number; completion_tokens: number };
      };
      const choice = body.choices[0];
      if (!choice) throw new Error("OpenAI API returned no choices");
      const toolCalls: ToolCall[] = (choice.message.tool_calls ?? []).map((c) => ({
        id: c.id,
        name: c.function.name,
        arguments: JSON.parse(c.function.arguments) as Record<string, unknown>,
      }));
      return {
        message: {
          role: "assistant",
          content: choice.message.content ?? "",
          toolCalls: toolCalls.length ? toolCalls : undefined,
        },
        usage: { inputTokens: body.usage.prompt_tokens, outputTokens: body.usage.completion_tokens },
      };
    },

    async embed(texts: string[]): Promise<number[][]> {
      const response = await fetch(EMBEDDINGS_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ model: embeddingModel, input: texts }),
      });
      if (!response.ok) {
        throw new Error(`OpenAI embeddings error ${response.status}: ${await response.text()}`);
      }
      const body = (await response.json()) as { data: { embedding: number[] }[] };
      return body.data.map((d) => d.embedding);
    },
  };
}
