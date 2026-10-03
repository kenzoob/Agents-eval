import type { ChatMessage, ChatResult, LlmProvider, ToolCall, ToolDefinition } from "../types.js";
import { fetchWithRetry } from "./retry.js";

export const OPENAI_BASE_URL = "https://api.openai.com/v1";

interface OpenAiToolCall {
  id: string;
  function: { name: string; arguments: string };
  extra_content?: Record<string, unknown>;
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
          ...(c.extra ? { extra_content: c.extra } : {}),
        })),
      };
    }
    return { role: m.role, content: m.content };
  });
}

export function createOpenAiProvider(
  apiKey: string,
  chatModel: string,
  embeddingModel: string,
  baseUrl: string = OPENAI_BASE_URL,
): LlmProvider {
  const base = baseUrl.replace(/\/+$/, "");
  const chatUrl = `${base}/chat/completions`;
  const embeddingsUrl = `${base}/embeddings`;

  return {
    async chat(messages, tools: ToolDefinition[]): Promise<ChatResult> {
      const response = await fetchWithRetry(chatUrl, {
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
        throw new Error(`Chat API error ${response.status}: ${await response.text()}`);
      }
      const body = (await response.json()) as {
        choices: {
          message: { content: string | null; tool_calls?: OpenAiToolCall[] };
          finish_reason?: string;
        }[];
        usage: { prompt_tokens: number; completion_tokens: number };
      };
      const choice = body.choices[0];
      if (!choice) throw new Error("OpenAI API returned no choices");
      const toolCalls: ToolCall[] = (choice.message.tool_calls ?? []).map((c) => ({
        id: c.id,
        name: c.function.name,
        arguments: JSON.parse(c.function.arguments) as Record<string, unknown>,
        ...(c.extra_content ? { extra: c.extra_content } : {}),
      }));
      return {
        message: {
          role: "assistant",
          content: choice.message.content ?? "",
          toolCalls: toolCalls.length ? toolCalls : undefined,
        },
        usage: { inputTokens: body.usage.prompt_tokens, outputTokens: body.usage.completion_tokens },
        finishReason: choice.finish_reason,
      };
    },

    async embed(texts: string[]): Promise<number[][]> {
      const response = await fetchWithRetry(embeddingsUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ model: embeddingModel, input: texts }),
      });
      if (!response.ok) {
        throw new Error(`Embeddings API error ${response.status}: ${await response.text()}`);
      }
      const body = (await response.json()) as { data: { embedding: number[] }[] };
      return body.data.map((d) => d.embedding);
    },
  };
}
