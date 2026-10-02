import { afterEach, describe, expect, it, vi } from "vitest";
import { createOpenAiProvider } from "../src/llm/openai.js";
import type { ChatMessage } from "../src/types.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createOpenAiProvider.chat", () => {
  it("parses tool_calls in OpenAI's documented shape, including the JSON-string arguments", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: null,
                tool_calls: [
                  { id: "call_1", type: "function", function: { name: "search_docs", arguments: '{"query":"fs.stat"}' } },
                ],
              },
            },
          ],
          usage: { prompt_tokens: 50, completion_tokens: 12 },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = createOpenAiProvider("sk-test", "gpt-4o-mini", "text-embedding-3-small");
    const result = await provider.chat([{ role: "user", content: "What does fs.stat return?" }], [
      { name: "search_docs", description: "search", parameters: { type: "object", properties: {} } },
    ]);

    expect(result.message.toolCalls).toEqual([
      { id: "call_1", name: "search_docs", arguments: { query: "fs.stat" } },
    ]);
    expect(result.usage).toEqual({ inputTokens: 50, outputTokens: 12 });

    const [, requestInit] = fetchMock.mock.calls[0]!;
    expect((requestInit!.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    const sentBody = JSON.parse(requestInit!.body as string);
    expect(sentBody.tools[0]).toEqual({
      type: "function",
      function: { name: "search_docs", description: "search", parameters: { type: "object", properties: {} } },
    });
  });

  it("round-trips an assistant tool call followed by a tool result message", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: "done" } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const messages: ChatMessage[] = [
      { role: "user", content: "q" },
      {
        role: "assistant",
        content: "",
        toolCalls: [{ id: "call_1", name: "search_docs", arguments: { query: "fs.stat" } }],
      },
      { role: "tool", content: '{"id":"fs-02"}', toolCallId: "call_1", name: "search_docs" },
    ];
    const provider = createOpenAiProvider("sk-test", "gpt-4o-mini", "text-embedding-3-small");
    await provider.chat(messages, []);

    const [, requestInit] = fetchMock.mock.calls[0]!;
    const sentBody = JSON.parse(requestInit!.body as string);
    expect(sentBody.messages[1].tool_calls).toEqual([
      { id: "call_1", type: "function", function: { name: "search_docs", arguments: '{"query":"fs.stat"}' } },
    ]);
    expect(sentBody.messages[2]).toEqual({ role: "tool", tool_call_id: "call_1", content: '{"id":"fs-02"}' });
  });

  it("throws when the API returns no choices", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify({ choices: [], usage: { prompt_tokens: 0, completion_tokens: 0 } }), { status: 200 }),
      ),
    );
    const provider = createOpenAiProvider("sk-test", "gpt-4o-mini", "text-embedding-3-small");
    await expect(provider.chat([{ role: "user", content: "q" }], [])).rejects.toThrow(/no choices/);
  });
});

describe("createOpenAiProvider.embed", () => {
  it("sends a single batched request and returns embeddings in order", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ data: [{ embedding: [1, 0] }, { embedding: [0, 1] }] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = createOpenAiProvider("sk-test", "gpt-4o-mini", "text-embedding-3-small");
    const embeddings = await provider.embed(["a", "b"]);

    expect(embeddings).toEqual([[1, 0], [0, 1]]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, requestInit] = fetchMock.mock.calls[0]!;
    const sentBody = JSON.parse(requestInit!.body as string);
    expect(sentBody.input).toEqual(["a", "b"]);
  });
});
