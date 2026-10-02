import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { chunkMarkdown } from "./chunk.js";
import type { IndexEntry, LlmProvider, Section } from "./types.js";

export async function loadSections(docsDir: string): Promise<Section[]> {
  const files = (await readdir(docsDir)).filter((f) => f.endsWith(".md"));
  const sections: Section[] = [];
  for (const file of files) {
    const content = await readFile(join(docsDir, file), "utf-8");
    const source = file.replace(/\.md$/, "");
    sections.push(...chunkMarkdown(source, content));
  }
  return sections;
}

export async function buildIndex(
  docsDir: string,
  outputPath: string,
  provider: LlmProvider,
): Promise<IndexEntry[]> {
  const sections = await loadSections(docsDir);
  const embeddings = await provider.embed(sections.map((s) => s.text));
  const index: IndexEntry[] = sections.map((section, i) => ({
    ...section,
    embedding: embeddings[i]!,
  }));
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(index, null, 2));
  return index;
}
