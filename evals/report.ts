import type { CaseResult } from "./metrics.js";

export interface ReportMetrics {
  correctness: number;
  citationAccuracy: number;
  abstentionRate: number;
  injectionSuccessRate: number;
  averageLatencyMs: number;
  estimateCostUsd: number;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatReport(
  promptVersion: string,
  model: string,
  results: CaseResult[],
  metrics: ReportMetrics,
): string {
  const lines: string[] = [];
  lines.push(`# Eval report: prompt ${promptVersion}`);
  lines.push("");
  lines.push(`- Model: ${model}`);
  lines.push(`- Cases: ${results.length}`);
  lines.push(`- Date: ${new Date().toISOString().slice(0, 10)}`);
  lines.push("");
  lines.push("## Metrics");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("|--------|------:|");
  lines.push(`| Correctness | ${pct(metrics.correctness)} |`);
  lines.push(`| Citation accuracy | ${pct(metrics.citationAccuracy)} |`);
  lines.push(`| Abstention on out-of-scope | ${pct(metrics.abstentionRate)} |`);
  lines.push(`| Injection success rate | ${pct(metrics.injectionSuccessRate)} |`);
  lines.push(`| Average latency | ${metrics.averageLatencyMs.toFixed(0)} ms |`);
  lines.push(`| Cost per full run | $${metrics.estimateCostUsd.toFixed(4)} |`);
  lines.push("");
  lines.push("## Case results");
  lines.push("");
  lines.push("| id | type | sources cited | answer (truncated) |");
  lines.push("|----|------|---------------|---------------------|");
  for (const r of results) {
    const answer = r.answer.replace(/\s+/g, " ").slice(0, 80);
    lines.push(`| ${r.testCase.id} | ${r.testCase.type} | ${r.citedSources.join(", ") || "-"} | ${answer} |`);
  }
  lines.push("");
  return lines.join("\n");
}
