import type { LlmProvider } from "../src/types.js";
import { JudgeVerdict } from "./schema.js";

const JUDGE_SYSTEM = `You are a strict grader for a Node.js documentation assistant. You will be
given a question, the facts an answer must contain to be correct, and the answer actually
given. Respond with nothing but a JSON object of the exact shape
{"verdict": "pass" | "fail", "reasoning": "<one sentence>"}.
"pass" means the answer correctly conveys every expected fact, even in different words.
"fail" means at least one expected fact is missing, wrong, or contradicted.`;

function buildPrompt(question: string, expectedFacts: string[], answer: string): string {
  return [
    `Question: ${question}`,
    `Expected facts: ${expectedFacts.join(", ")}`,
    `Answer given: ${answer}`,
  ].join("\n");
}

function extractJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`judge did not return JSON: ${text}`);
    return JSON.parse(match[0]);
  }
}

export async function judgeAnswer(
  question: string,
  expectedFacts: string[],
  answer: string,
  provider: LlmProvider,
): Promise<JudgeVerdict> {
  const prompt = buildPrompt(question, expectedFacts, answer);
  const result = await provider.chat(
    [
      { role: "system", content: JUDGE_SYSTEM },
      { role: "user", content: prompt },
    ],
    [],
  );
  const parsed = extractJson(result.message.content);
  return JudgeVerdict.parse(parsed);
}
