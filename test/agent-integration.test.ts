import { afterEach, describe, expect, it, vi } from "vitest";
import { createOllamaProvider } from "../src/llm/ollama.js";
import { runAgent } from "../src/agent.js";
import type { IndexEntry } from "../src/types.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

const index: IndexEntry[] = [
  { id: "fs-02", source: "fs", heading: "Checking metadata with fs.stat", text: "fs.stat returns size, mtime, isFile().", embedding: [1, 0] },
  { id: "http-01", source: "http", heading: "Creating a server", text: "http.createServer starts a server.", embedding: [0, 1] },
];

describe("runAgent against a real provider adapter (fetch mocked at the HTTP boundary)", () => {
  it("searches, reads a section, and cites it in the final answer across real multi-turn wire traffic", async () => {
    let chatTurn = 0;

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/embeddings")) {
        // The query embedding only needs to rank fs-02 above http-01.
        return new Response(JSON.stringify({ embedding: [1, 0] }), { status: 200 });
      }

      chatTurn++;
      const body = JSON.parse(init!.body as string) as { messages: { role: string; content: string }[] };

      if (chatTurn === 1) {
        return new Response(
          JSON.stringify({
            message: {
              role: "assistant",
              content: "",
              tool_calls: [{ function: { name: "search_docs", arguments: { query: "fs.stat", k: 2 } } }],
            },
          }),
          { status: 200 },
        );
      }
      if (chatTurn === 2) {
        const last = body.messages.at(-1)!;
        expect(last.role).toBe("tool");
        const results = JSON.parse(last.content) as { id: string }[];
        expect(results[0]!.id).toBe("fs-02");

        return new Response(
          JSON.stringify({
            message: {
              role: "assistant",
              content: "",
              tool_calls: [{ function: { name: "read_section", arguments: { id: "fs-02" } } }],
            },
          }),
          { status: 200 },
        );
      }

      const last = body.messages.at(-1)!;
      const section = JSON.parse(last.content) as { text: string };
      return new Response(
        JSON.stringify({ message: { role: "assistant", content: `${section.text} Sources: fs-02` } }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = createOllamaProvider("http://localhost:11434", "test-model", "test-model");
    const result = await runAgent({
      question: "What does fs.stat return?",
      systemPrompt: "You are a docs assistant.",
      index,
      provider,
    });

    expect(chatTurn).toBe(3);
    expect(result.steps).toBe(3);
    expect(result.answer).toContain("fs.stat returns size, mtime, isFile()");
    expect(result.citedSources).toEqual(["fs-02"]);
  });
});
