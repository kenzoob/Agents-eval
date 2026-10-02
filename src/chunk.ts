import type { Section } from "./types.js";

const MIN_WORDS = 300;
const MAX_WORDS = 800;
const TARGET_SPLIT_WORDS = 500;
const HEADING_RE = /^##\s+(.+)$/gm;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

interface Block {
  heading: string;
  body: string;
}

function splitByHeading(content: string): Block[] {
  const matches = [...content.matchAll(HEADING_RE)];
  const blocks: Block[] = [];
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]!;
    const heading = match[1]!.trim();
    const start = match.index! + match[0].length;
    const end = i + 1 < matches.length ? matches[i + 1]!.index! : content.length;
    blocks.push({ heading, body: content.slice(start, end).trim() });
  }
  return blocks;
}

function splitOversizedBlock(block: Block): Block[] {
  if (wordCount(block.body) <= MAX_WORDS) return [block];
  const paragraphs = block.body.split(/\n\s*\n/);
  const parts: Block[] = [];
  let current: string[] = [];
  let currentWords = 0;
  let partIndex = 1;
  for (const paragraph of paragraphs) {
    current.push(paragraph);
    currentWords += wordCount(paragraph);
    if (currentWords >= TARGET_SPLIT_WORDS) {
      const heading = partIndex === 1 ? block.heading : `${block.heading} (cont. ${partIndex})`;
      parts.push({ heading, body: current.join("\n\n") });
      current = [];
      currentWords = 0;
      partIndex++;
    }
  }
  if (current.length > 0) {
    const heading = partIndex === 1 ? block.heading : `${block.heading} (cont. ${partIndex})`;
    parts.push({ heading, body: current.join("\n\n") });
  }
  return parts;
}

function mergeUndersizedBlocks(blocks: Block[]): Block[] {
  const merged: Block[] = [];
  let acc: Block | null = null;
  for (const block of blocks) {
    if (!acc) {
      acc = { heading: block.heading, body: block.body };
      continue;
    }
    if (wordCount(acc.body) < MIN_WORDS) {
      acc.body = `${acc.body}\n\n## ${block.heading}\n\n${block.body}`;
      continue;
    }
    merged.push(acc);
    acc = { heading: block.heading, body: block.body };
  }
  if (acc) merged.push(acc);
  return merged;
}

export function chunkMarkdown(source: string, content: string): Section[] {
  const rawBlocks = splitByHeading(content);
  const sized = mergeUndersizedBlocks(rawBlocks).flatMap(splitOversizedBlock);
  const slug = slugify(source);
  return sized.map((block, i) => ({
    id: `${slug}-${String(i + 1).padStart(2, "0")}`,
    source,
    heading: block.heading,
    text: block.body,
  }));
}
