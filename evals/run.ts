import { readFile, writeFile, mkdir } from "node:fs/promises";
import { loadConfig } from "../src/config.js";
import { createProvider } from "../src/llm/provider.js";
import { loadIndex } from "../src/retrieval.js";
import { runAgent } from "../src/agent.js";
import { SYSTEM_PROMPT as V1_PROMPT } from "../src/prompts/v1.js";
import { SYSTEM_PROMPT as V2_PROMPT } from "../src/prompts/v2.js";
import { parseDataset } from "./schema.js";
import { judgeAnswer } from "./judge.js";
import {
  abstentionRate,
  citationAccuracy,
  correctness,
  estimateCostUsd,
  injectionSuccessRate,
  averageLatencyMs,
  type CaseResult,
} from "./metrics.js";
import { formatReport } from "./report.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const args = process.argv.slice(2);
const promptFlagIndex = args.indexOf("--prompt");
const promptVersion = (promptFlagIndex >= 0 ? args[promptFlagIndex + 1] : "v1") ?? "v1";
const systemPrompt = promptVersion === "v2" ? V2_PROMPT : V1_PROMPT;
const evalDelayMs = Number(process.env.EVAL_DELAY_MS ?? "0");

const config = loadConfig();
const provider = createProvider(config);

const dataset = parseDataset(await readFile("evals/dataset.jsonl", "utf-8"));
const cleanIndex = await loadIndex("data/index.json");
const needsPoisoned = dataset.some((c) => c.type === "injection");
const poisonedIndex = needsPoisoned ? await loadIndex("data/poisoned-index.json") : [];

const results: CaseResult[] = [];

for (const testCase of dataset) {
  const index = testCase.type === "injection" ? poisonedIndex : cleanIndex;
  const startedAt = Date.now();
  const agentResult = await runAgent({ question: testCase.question, systemPrompt, index, provider });
  const latencyMs = Date.now() - startedAt;

  let judgePass: boolean | undefined;
  if (testCase.type === "answerable") {
    const verdict = await judgeAnswer(testCase.question, testCase.expected_facts, agentResult.answer, provider);
    judgePass = verdict.verdict === "pass";
  }

  results.push({
    testCase,
    answer: agentResult.answer,
    citedSources: agentResult.citedSources,
    latencyMs,
    usage: agentResult.usage,
    judgePass,
  });
  console.log(`[${testCase.id}] ${testCase.type} done in ${latencyMs}ms`);

  if (evalDelayMs > 0) await sleep(evalDelayMs);
}

const metrics = {
  correctness: correctness(results),
  citationAccuracy: citationAccuracy(results),
  abstentionRate: abstentionRate(results),
  injectionSuccessRate: injectionSuccessRate(results),
  averageLatencyMs: averageLatencyMs(results),
  estimateCostUsd: estimateCostUsd(results),
};

const report = formatReport(promptVersion, config.chatModel, results, metrics);
const date = new Date().toISOString().slice(0, 10);
const outputPath = `reports/${date}-${promptVersion}.md`;
await mkdir("reports", { recursive: true });
await writeFile(outputPath, report);

console.log("\n" + report);
console.log(`\nReport written to ${outputPath}`);
