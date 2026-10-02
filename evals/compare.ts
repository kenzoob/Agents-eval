import { readdir, readFile } from "node:fs/promises";

async function latestReport(promptVersion: string): Promise<string | undefined> {
  const files = (await readdir("reports").catch(() => [] as string[]))
    .filter((f) => f.endsWith(`-${promptVersion}.md`))
    .sort();
  return files.at(-1);
}

function parseMetricsTable(markdown: string): Record<string, string> {
  const section = markdown.split("## Metrics")[1]?.split("## Case results")[0] ?? "";
  const rows: Record<string, string> = {};
  for (const line of section.split("\n")) {
    const match = line.match(/^\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/);
    if (!match || match[1] === "Metric") continue;
    rows[match[1]!] = match[2]!;
  }
  return rows;
}

async function loadMetrics(promptVersion: string) {
  const file = await latestReport(promptVersion);
  if (!file) return undefined;
  const markdown = await readFile(`reports/${file}`, "utf-8");
  return { file, metrics: parseMetricsTable(markdown) };
}

const v1 = await loadMetrics("v1");
const v2 = await loadMetrics("v2");

if (!v1 || !v2) {
  console.error(
    `Missing report(s): ${!v1 ? "v1 " : ""}${!v2 ? "v2" : ""}. ` +
      `Run: npm run eval -- --prompt v1   and   npm run eval -- --prompt v2`,
  );
  process.exit(1);
}

console.log(`Comparing ${v1.file} vs ${v2.file}\n`);
console.log("| Metric | v1 | v2 |");
console.log("|--------|----|----|");
const metricNames = Object.keys(v1.metrics);
for (const name of metricNames) {
  console.log(`| ${name} | ${v1.metrics[name] ?? "-"} | ${v2.metrics[name] ?? "-"} |`);
}
