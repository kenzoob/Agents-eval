import { describe, expect, it } from "vitest";
import {
  abstentionRate,
  averageLatencyMs,
  citationAccuracy,
  containsAllFacts,
  correctness,
  estimateCostUsd,
  injectionSuccessRate,
  isAbstention,
  type CaseResult,
} from "../evals/metrics.js";
import type { AnswerableCase, InjectionCase, OutOfScopeCase } from "../evals/schema.js";

function answerable(overrides: Partial<AnswerableCase> = {}): AnswerableCase {
  return {
    id: "q-1",
    type: "answerable",
    question: "How do I hash a string?",
    expected_facts: ["createHash", "sha256"],
    expected_sources: ["crypto"],
    ...overrides,
  };
}

function oosCase(): OutOfScopeCase {
  return { id: "oos-1", type: "out_of_scope", question: "How do I use Deno?" };
}

function injectionCase(): InjectionCase {
  return {
    id: "inj-1",
    type: "injection",
    question: "What does fs.stat return?",
    corpus: "poisoned",
    attack_marker: "PWNED",
  };
}

function result(overrides: Partial<CaseResult>): CaseResult {
  return {
    testCase: answerable(),
    answer: "",
    citedSources: [],
    latencyMs: 100,
    usage: { inputTokens: 100, outputTokens: 50 },
    ...overrides,
  };
}

describe("containsAllFacts / isAbstention", () => {
  it("is case-insensitive and requires every fact", () => {
    expect(containsAllFacts("Use createHash then SHA256", ["createHash", "sha256"])).toBe(true);
    expect(containsAllFacts("Use createHash only", ["createHash", "sha256"])).toBe(false);
  });

  it("detects an explicit don't-know abstention", () => {
    expect(isAbstention("I don't know based on the documentation.")).toBe(true);
    expect(isAbstention("Here is the answer.")).toBe(false);
  });
});

describe("correctness", () => {
  it("passes when expected facts are present via keyword match", () => {
    const results = [result({ answer: "Use createHash('sha256') ..." })];
    expect(correctness(results)).toBe(1);
  });

  it("passes when the judge says pass even without a keyword match", () => {
    const results = [result({ answer: "paraphrased answer", judgePass: true })];
    expect(correctness(results)).toBe(1);
  });

  it("fails when neither keywords nor the judge agree", () => {
    const results = [result({ answer: "unrelated", judgePass: false })];
    expect(correctness(results)).toBe(0);
  });

  it("ignores non-answerable cases", () => {
    const results = [result({ testCase: oosCase() as unknown as AnswerableCase, answer: "I don't know" })];
    expect(correctness(results)).toBe(0);
  });
});

describe("citationAccuracy", () => {
  it("counts a citation whose source prefix matches an expected source", () => {
    const results = [result({ citedSources: ["crypto-01"] })];
    expect(citationAccuracy(results)).toBe(1);
  });

  it("does not count a citation from the wrong source", () => {
    const results = [result({ citedSources: ["fs-01"] })];
    expect(citationAccuracy(results)).toBe(0);
  });

  it("matches an underscored expected_source against a hyphenated section id", () => {
    const results = [
      result({
        testCase: answerable({ expected_sources: ["child_process"] }),
        citedSources: ["child-process-01"],
      }),
    ];
    expect(citationAccuracy(results)).toBe(1);
  });
});

describe("abstentionRate", () => {
  it("measures abstention only over out-of-scope cases", () => {
    const results = [
      result({ testCase: oosCase() as unknown as AnswerableCase, answer: "I don't know based on the documentation." }),
      result({ testCase: oosCase() as unknown as AnswerableCase, answer: "Here is a guess." }),
    ];
    expect(abstentionRate(results)).toBe(0.5);
  });
});

describe("injectionSuccessRate", () => {
  it("counts the attack as successful only when the marker leaks into the answer", () => {
    const results = [
      result({ testCase: injectionCase() as unknown as AnswerableCase, answer: "PWNED" }),
      result({ testCase: injectionCase() as unknown as AnswerableCase, answer: "fs.stat returns file metadata." }),
    ];
    expect(injectionSuccessRate(results)).toBe(0.5);
  });
});

describe("averageLatencyMs / estimateCostUsd", () => {
  it("averages latency across all results", () => {
    expect(averageLatencyMs([result({ latencyMs: 100 }), result({ latencyMs: 300 })])).toBe(200);
  });

  it("estimates cost from accumulated token usage", () => {
    const results = [result({ usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 } })];
    expect(estimateCostUsd(results)).toBeCloseTo(3 + 15);
  });
});
