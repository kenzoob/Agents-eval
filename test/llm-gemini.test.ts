import { afterEach, describe, expect, it, vi } from "vitest";
import { createGeminiProvider, GEMINI_BASE_URL } from "../src/llm/gemini.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createGeminiProvider", () => {
  it("calls the Gemini OpenAI-compatible base URL with a Bearer-auth header", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: "fs.stat returns file metadata." } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = createGeminiProvider("gemini-key", "gemini-3.5-flash-lite", "gemini-embedding-001");
    const result = await provider.chat([{ role: "user", content: "What does fs.stat return?" }], []);

    expect(result.message.content).toBe("fs.stat returns file metadata.");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [calledUrl, requestInit] = fetchMock.mock.calls[0]!;
    expect(calledUrl).toBe(`${GEMINI_BASE_URL}/chat/completions`);
    expect((requestInit!.headers as Record<string, string>).Authorization).toBe("Bearer gemini-key");

    const sentBody = JSON.parse(requestInit!.body as string);
    expect(sentBody.model).toBe("gemini-3.5-flash-lite");
  });

  it("hits the Gemini embeddings path with the configured embedding model", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ data: [{ embedding: [1, 0] }] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = createGeminiProvider("gemini-key", "gemini-3.5-flash-lite", "gemini-embedding-001");
    await provider.embed(["hello"]);

    const [calledUrl, requestInit] = fetchMock.mock.calls[0]!;
    expect(calledUrl).toBe(`${GEMINI_BASE_URL}/embeddings`);
    const sentBody = JSON.parse(requestInit!.body as string);
    expect(sentBody.model).toBe("gemini-embedding-001");
  });

  it("retries once after a 429 and succeeds on the following 200", async () => {
    let calls = 0;
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
      calls++;
      if (calls === 1) {
        return new Response("rate limited", { status: 429, headers: { "retry-after": "0" } });
      }
      return new Response(
        JSON.stringify({ choices: [{ message: { content: "ok after retry" } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = createGeminiProvider("gemini-key", "gemini-3.5-flash-lite", "gemini-embedding-001");
    const result = await provider.chat([{ role: "user", content: "q" }], []);

    expect(calls).toBe(2);
    expect(result.message.content).toBe("ok after retry");
  });

  it("retries using the retryDelay embedded in Gemini's JSON error body when there is no Retry-After header", async () => {
    let calls = 0;
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
      calls++;
      if (calls === 1) {
        // Real shape Gemini returns on free-tier quota errors: no Retry-After
        // header, the cooldown lives in the JSON body instead.
        return new Response(
          JSON.stringify([
            {
              error: {
                code: 429,
                status: "RESOURCE_EXHAUSTED",
                details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "0.01s" }],
              },
            },
          ]),
          { status: 429 },
        );
      }
      return new Response(
        JSON.stringify({ choices: [{ message: { content: "ok after retry" } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = createGeminiProvider("gemini-key", "gemini-3.5-flash-lite", "gemini-embedding-001");
    const result = await provider.chat([{ role: "user", content: "q" }], []);

    expect(calls).toBe(2);
    expect(result.message.content).toBe("ok after retry");
  });

  it("gives up and throws after exhausting retries on persistent 503s", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response("unavailable", { status: 503, headers: { "retry-after": "0" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = createGeminiProvider("gemini-key", "gemini-3.5-flash-lite", "gemini-embedding-001");
    await expect(provider.chat([{ role: "user", content: "q" }], [])).rejects.toThrow(/503/);
    // 1 initial attempt + 6 retries = 7 calls total.
    expect(fetchMock).toHaveBeenCalledTimes(7);
  });
});
