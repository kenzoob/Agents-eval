import { readFile } from "node:fs/promises";
import type { IndexEntry } from "./types.js";

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error("vectors must have the same length");
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface ScoredEntry {
  entry: IndexEntry;
  score: number;
}

export function topK(index: IndexEntry[], queryEmbedding: number[], k: number): ScoredEntry[] {
  return index
    .map((entry) => ({ entry, score: cosineSimilarity(entry.embedding, queryEmbedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

export async function loadIndex(path: string): Promise<IndexEntry[]> {
  const raw = await readFile(path, "utf-8");
  return JSON.parse(raw) as IndexEntry[];
}
