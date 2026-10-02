import { describe, expect, it } from "vitest";
import { cosineSimilarity, topK } from "../src/retrieval.js";
import type { IndexEntry } from "../src/types.js";

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("returns -1 for opposite vectors", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it("throws when vectors have different lengths", () => {
    expect(() => cosineSimilarity([1, 2], [1])).toThrow();
  });
});

function entry(id: string, embedding: number[]): IndexEntry {
  return { id, source: "demo", heading: id, text: id, embedding };
}

describe("topK", () => {
  const index: IndexEntry[] = [
    entry("a", [1, 0]),
    entry("b", [0, 1]),
    entry("c", [0.9, 0.1]),
  ];

  it("ranks entries by similarity to the query, most similar first", () => {
    const results = topK(index, [1, 0], 3);
    expect(results.map((r) => r.entry.id)).toEqual(["a", "c", "b"]);
  });

  it("limits results to k", () => {
    const results = topK(index, [1, 0], 1);
    expect(results).toHaveLength(1);
    expect(results[0]!.entry.id).toBe("a");
  });
});
