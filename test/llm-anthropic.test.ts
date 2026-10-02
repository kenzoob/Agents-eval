import { afterEach, describe, expect, it, vi } from "vitest";
import { createAnthropicProvider } from "../src/llm/anthropic.js";
import type { ChatMessage } from "../src/types.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createAnthropicProvider.chat", () => {
  it("parses a tool_use content block in Anthropic's documented shape", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          content: [
            { type: "text", text: "Let me check." },
            { type: "tool_use", id: "toolu_1", name: "search_docs", input: { query: "fs.stat" } },
          ],
          usage: { input_tokens: 30, output_tokens: 8 },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = createAnthropicProvider("sk-ant-test", "claude-sonnet-5-5");
    const result = await provider.chat(
      [
        { role: "system", content: "system prompt" },
        { role: "user", content: "What does fs.stat return?" },
      ],
      [{ name: "search_docs", description: "search", parameters: { type: "object", properties: {} } }],
    );

    expect(result.message.content).toBe("Let me check.");
    expect(result.message.toolCalls).toEqual([
      { id: "toolu_1", name: "search_docs", arguments: { query: "fs.stat" } },
    ]);
    expect(result.usage).toEqual({ inputTokens: 30, outputTokens: 8 });

    const [, requestInit] = fetchMock.mock.calls[0]!;
    expect((requestInit!.headers as Record<string, string>)["x-api-key"]).toBe("sk-ant-test");
    const sentBody = JSON.parse(requestInit!.body as string);
    expect(sentBody.system).toBe("system prompt");
    expect(sentBody.tools[0]).toEqual({
      name: "search_docs",
      description: "search",
      input_schema: { type: "object", properties: {} },
    });
    expect(sentBody.messages).toEqual([{ role: "user", content: "What does fs.stat return?" }]);
  });

  it("round-trips an assistant tool_use followed by a tool_result message", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ content: [{ type: "text", text: "done" }], usage: { input_tokens: 1, output_tokens: 1 } }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const messages: ChatMessage[] = [
      { role: "system", content: "sys" },
      { role: "user", content: "q" },
      {
        role: "assistant",
        content: "",
        toolCalls: [{ id: "toolu_1", name: "search_docs", arguments: { query: "fs.stat" } }],
      },
      { role: "tool", content: '{"id":"fs-02"}', toolCallId: "toolu_1", name: "search_docs" },
    ];
    const provider = createAnthropicProvider("sk-ant-test", "claude-sonnet-5-5");
    await provider.chat(messages, []);

    const [, requestInit] = fetchMock.mock.calls[0]!;
    const sentBody = JSON.parse(requestInit!.body as string);
    expect(sentBody.messages[1]).toEqual({
      role: "assistant",
      content: [{ type: "tool_use", id: "toolu_1", name: "search_docs", input: { query: "fs.stat" } }],
    });
    expect(sentBody.messages[2]).toEqual({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "toolu_1", content: '{"id":"fs-02"}' }],
    });
  });

  it("rejects embed calls since Anthropic has no embeddings API", async () => {
    const provider = createAnthropicProvider("sk-ant-test", "claude-sonnet-5-5");
    await expect(provider.embed(["x"])).rejects.toThrow(/no embeddings/);
  });
});
