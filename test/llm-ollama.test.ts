import { afterEach, describe, expect, it, vi } from "vitest";
import { createOllamaProvider } from "../src/llm/ollama.js";
import type { ChatMessage } from "../src/types.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createOllamaProvider.chat", () => {
  it("parses a tool_calls response in Ollama's documented shape", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          message: {
            role: "assistant",
            content: "",
            tool_calls: [{ function: { name: "search_docs", arguments: { query: "fs.stat", k: 3 } } }],
          },
          prompt_eval_count: 42,
          eval_count: 7,
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = createOllamaProvider("http://localhost:11434", "llama3.2:1b", "llama3.2:1b");
    const result = await provider.chat([{ role: "user", content: "What does fs.stat return?" }], [
      { name: "search_docs", description: "search", parameters: { type: "object", properties: {} } },
    ]);

    expect(result.message.toolCalls).toEqual([
      { id: "0", name: "search_docs", arguments: { query: "fs.stat", k: 3 } },
    ]);
    expect(result.usage).toEqual({ inputTokens: 42, outputTokens: 7 });

    const [, requestInit] = fetchMock.mock.calls[0]!;
    const sentBody = JSON.parse(requestInit!.body as string);
    expect(sentBody.model).toBe("llama3.2:1b");
    expect(sentBody.tools[0].function.name).toBe("search_docs");
  });

  it("parses a plain text response with no tool calls", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, _init?: RequestInit) =>
        new Response(
          JSON.stringify({ message: { role: "assistant", content: "the answer" }, prompt_eval_count: 1, eval_count: 1 }),
          { status: 200 },
        ),
      ),
    );
    const provider = createOllamaProvider("http://localhost:11434", "m", "m");
    const result = await provider.chat([{ role: "user", content: "q" }], []);
    expect(result.message.toolCalls).toBeUndefined();
    expect(result.message.content).toBe("the answer");
  });

  it("round-trips an assistant tool call followed by a tool result message", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ message: { role: "assistant", content: "done" } }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const messages: ChatMessage[] = [
      { role: "user", content: "q" },
      {
        role: "assistant",
        content: "",
        toolCalls: [{ id: "0", name: "search_docs", arguments: { query: "fs.stat" } }],
      },
      { role: "tool", content: '{"id":"fs-02"}', toolCallId: "0", name: "search_docs" },
    ];
    const provider = createOllamaProvider("http://localhost:11434", "m", "m");
    await provider.chat(messages, []);

    const [, requestInit] = fetchMock.mock.calls[0]!;
    const sentBody = JSON.parse(requestInit!.body as string);
    expect(sentBody.messages[1].tool_calls).toEqual([
      { function: { name: "search_docs", arguments: { query: "fs.stat" } } },
    ]);
    expect(sentBody.messages[2]).toEqual({ role: "tool", content: '{"id":"fs-02"}' });
  });

  it("throws with the response body when the HTTP call fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, _init?: RequestInit) => new Response("model not found", { status: 404 })),
    );
    const provider = createOllamaProvider("http://localhost:11434", "missing", "missing");
    await expect(provider.chat([{ role: "user", content: "q" }], [])).rejects.toThrow(/404/);
  });
});

describe("createOllamaProvider.embed", () => {
  it("issues one request per text and collects the embeddings in order", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(init!.body as string) as { prompt: string };
      return new Response(JSON.stringify({ embedding: body.prompt === "a" ? [1, 0] : [0, 1] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = createOllamaProvider("http://localhost:11434", "m", "nomic-embed-text");
    const embeddings = await provider.embed(["a", "b"]);

    expect(embeddings).toEqual([[1, 0], [0, 1]]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
