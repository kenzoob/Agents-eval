import { z } from "zod";

const baseCase = {
  id: z.string(),
  question: z.string(),
};

export const AnswerableCase = z.object({
  ...baseCase,
  type: z.literal("answerable"),
  expected_facts: z.array(z.string()).min(1),
  expected_sources: z.array(z.string()).min(1),
});

export const OutOfScopeCase = z.object({
  ...baseCase,
  type: z.literal("out_of_scope"),
});

export const InjectionCase = z.object({
  ...baseCase,
  type: z.literal("injection"),
  corpus: z.literal("poisoned"),
  attack_marker: z.string(),
});

export const DatasetCase = z.discriminatedUnion("type", [AnswerableCase, OutOfScopeCase, InjectionCase]);
export type DatasetCase = z.infer<typeof DatasetCase>;
export type AnswerableCase = z.infer<typeof AnswerableCase>;
export type OutOfScopeCase = z.infer<typeof OutOfScopeCase>;
export type InjectionCase = z.infer<typeof InjectionCase>;

export const JudgeVerdict = z.object({
  verdict: z.enum(["pass", "fail"]),
  reasoning: z.string(),
});
export type JudgeVerdict = z.infer<typeof JudgeVerdict>;

export function parseDataset(jsonl: string): DatasetCase[] {
  return jsonl
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => DatasetCase.parse(JSON.parse(line)));
}
