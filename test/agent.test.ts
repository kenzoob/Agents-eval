import { describe, expect, it } from "vitest";
import { extractCitedSources, runAgent } from "../src/agent.js";
import type { ChatMessage, ChatResult, LlmProvider, ToolDefinition } from "../src/types.js";

function makeAlwaysToolCallingProvider(): { provider: LlmProvider; callCount: () => number } {
  let calls = 0;
  const provider: LlmProvider = {
    async chat(_messages: ChatMessage[], _tools: ToolDefinition[]): Promise<ChatResult> {
      calls++;
      return {
        message: {
          role: "assistant",
          content: "",
          toolCalls: [{ id: `${calls}`, name: "search_docs", arguments: { query: "x" } }],
        },
        usage: { inputTokens: 10, outputTokens: 5 },
      };
    },
    async embed(texts: string[]) {
      return texts.map(() => [1, 0]);
    },
  };
  return { provider, callCount: () => calls };
}

function makeImmediateAnswerProvider(answer: string): LlmProvider {
  return {
    async chat() {
      return { message: { role: "assistant", content: answer }, usage: { inputTokens: 1, outputTokens: 1 } };
    },
    async embed(texts: string[]) {
      return texts.map(() => [1, 0]);
    },
  };
}

// Mimics a real provider: keeps calling tools whenever tools are offered, but
// must produce a real final answer once called with no tools (as the agent
// does on its last allowed step).
function makeToolHungryProvider(): LlmProvider {
  return {
    async chat(_messages: ChatMessage[], tools: ToolDefinition[]): Promise<ChatResult> {
      if (tools.length > 0) {
        return {
          message: {
            role: "assistant",
            content: "",
            toolCalls: [{ id: "1", name: "search_docs", arguments: { query: "x" } }],
          },
          usage: { inputTokens: 1, outputTokens: 1 },
        };
      }
      return {
        message: { role: "assistant", content: "Final answer from what I found." },
        usage: { inputTokens: 1, outputTokens: 1 },
      };
    },
    async embed(texts: string[]) {
      return texts.map(() => [1, 0]);
    },
  };
}

describe("runAgent", () => {
  it("stops after maxSteps even if the model keeps calling tools", async () => {
    const { provider, callCount } = makeAlwaysToolCallingProvider();
    const result = await runAgent({
      question: "anything",
      systemPrompt: "system",
      index: [],
      provider,
      maxSteps: 3,
    });
    expect(callCount()).toBe(3);
    expect(result.steps).toBe(3);
  });

  it("stops early once the model answers without calling a tool", async () => {
    const provider = makeImmediateAnswerProvider("fs-01 says so. Sources: fs-01");
    const result = await runAgent({ question: "q", systemPrompt: "system", index: [], provider, maxSteps: 5 });
    expect(result.steps).toBe(1);
    expect(result.answer).toContain("fs-01");
    expect(result.citedSources).toEqual(["fs-01"]);
  });

  it("accumulates token usage across steps", async () => {
    const { provider } = makeAlwaysToolCallingProvider();
    const result = await runAgent({ question: "q", systemPrompt: "s", index: [], provider, maxSteps: 2 });
    expect(result.usage.inputTokens).toBe(20);
    expect(result.usage.outputTokens).toBe(10);
  });

  it("still returns a non-empty final answer when the model keeps wanting to call tools", async () => {
    const provider = makeToolHungryProvider();
    const result = await runAgent({ question: "q", systemPrompt: "s", index: [], provider, maxSteps: 3 });
    expect(result.answer).toBe("Final answer from what I found.");
    expect(result.answer.length).toBeGreaterThan(0);
    expect(result.steps).toBe(3);
  });
});

describe("extractCitedSources", () => {
  it("extracts simple two-segment ids", () => {
    expect(extractCitedSources("See fs-01 and http-02.")).toEqual(["fs-01", "http-02"]);
  });

  it("extracts full ids whose prefix itself contains a hyphen", () => {
    expect(extractCitedSources("Sources: child-process-01")).toEqual(["child-process-01"]);
    expect(extractCitedSources("Sources: worker-threads-01")).toEqual(["worker-threads-01"]);
  });

  it("deduplicates repeated ids", () => {
    expect(extractCitedSources("fs-01 ... again fs-01")).toEqual(["fs-01"]);
  });
});
