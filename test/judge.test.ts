import { describe, expect, it } from "vitest";
import { judgeAnswer } from "../evals/judge.js";
import type { ChatResult, LlmProvider } from "../src/types.js";

function providerReturning(content: string): LlmProvider {
  return {
    async chat(): Promise<ChatResult> {
      return { message: { role: "assistant", content }, usage: { inputTokens: 1, outputTokens: 1 } };
    },
    async embed(texts: string[]) {
      return texts.map(() => [0]);
    },
  };
}

describe("judgeAnswer", () => {
  it("accepts a well-formed verdict", async () => {
    const provider = providerReturning('{"verdict": "pass", "reasoning": "covers both facts"}');
    const verdict = await judgeAnswer("q", ["a", "b"], "answer", provider);
    expect(verdict.verdict).toBe("pass");
  });

  it("extracts JSON even if the model wraps it in prose", async () => {
    const provider = providerReturning('Sure, here you go:\n{"verdict": "fail", "reasoning": "missing b"}\nThanks');
    const verdict = await judgeAnswer("q", ["a", "b"], "answer", provider);
    expect(verdict.verdict).toBe("fail");
  });

  it("rejects output with no JSON object at all", async () => {
    const provider = providerReturning("I think this answer looks pretty good overall.");
    await expect(judgeAnswer("q", ["a"], "answer", provider)).rejects.toThrow();
  });

  it("rejects output whose verdict value is not pass or fail", async () => {
    const provider = providerReturning('{"verdict": "maybe", "reasoning": "unsure"}');
    await expect(judgeAnswer("q", ["a"], "answer", provider)).rejects.toThrow();
  });

  it("rejects output missing the reasoning field", async () => {
    const provider = providerReturning('{"verdict": "pass"}');
    await expect(judgeAnswer("q", ["a"], "answer", provider)).rejects.toThrow();
  });
});
