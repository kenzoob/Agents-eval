import type { ChatMessage, ChatResult, LlmProvider, ToolCall, ToolDefinition } from "../types.js";

interface OllamaToolCall {
  function: { name: string; arguments: Record<string, unknown> };
}

function toOllamaMessages(messages: ChatMessage[]) {
  return messages.map((m) => {
    if (m.role === "tool") {
      return { role: "tool" as const, content: m.content };
    }
    if (m.role === "assistant" && m.toolCalls?.length) {
      return {
        role: "assistant" as const,
        content: m.content,
        tool_calls: m.toolCalls.map((c) => ({ function: { name: c.name, arguments: c.arguments } })),
      };
    }
    return { role: m.role, content: m.content };
  });
}

export function createOllamaProvider(baseUrl: string, chatModel: string, embeddingModel: string): LlmProvider {
  return {
    async chat(messages, tools: ToolDefinition[]): Promise<ChatResult> {
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: chatModel,
          stream: false,
          messages: toOllamaMessages(messages),
          tools: tools.map((t) => ({
            type: "function",
            function: { name: t.name, description: t.description, parameters: t.parameters },
          })),
        }),
      });
      if (!response.ok) {
        throw new Error(`Ollama API error ${response.status}: ${await response.text()}`);
      }
      const body = (await response.json()) as {
        message: { content: string; tool_calls?: OllamaToolCall[] };
        prompt_eval_count?: number;
        eval_count?: number;
        done_reason?: string;
      };
      const toolCalls: ToolCall[] = (body.message.tool_calls ?? []).map((c, i) => ({
        id: `${i}`,
        name: c.function.name,
        arguments: c.function.arguments,
      }));
      return {
        message: {
          role: "assistant",
          content: body.message.content,
          toolCalls: toolCalls.length ? toolCalls : undefined,
        },
        usage: { inputTokens: body.prompt_eval_count ?? 0, outputTokens: body.eval_count ?? 0 },
        finishReason: body.done_reason,
      };
    },

    async embed(texts: string[]): Promise<number[][]> {
      const embeddings: number[][] = [];
      for (const text of texts) {
        const response = await fetch(`${baseUrl}/api/embeddings`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ model: embeddingModel, prompt: text }),
        });
        if (!response.ok) {
          throw new Error(`Ollama embeddings error ${response.status}: ${await response.text()}`);
        }
        const body = (await response.json()) as { embedding: number[] };
        embeddings.push(body.embedding);
      }
      return embeddings;
    },
  };
}
