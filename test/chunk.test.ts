import { describe, expect, it } from "vitest";
import { chunkMarkdown, slugify } from "../src/chunk.js";

function words(n: number, prefix = "word"): string {
  return Array.from({ length: n }, (_, i) => `${prefix}${i}`).join(" ");
}

describe("slugify", () => {
  it("lowercases and replaces non-alphanumeric runs with a dash", () => {
    expect(slugify("Worker Threads!!")).toBe("worker-threads");
    expect(slugify("child_process")).toBe("child-process");
  });
});

describe("chunkMarkdown", () => {
  it("merges undersized headings until a section reaches the minimum word count", () => {
    const content = `## A\n\n${words(50)}\n\n## B\n\n${words(60)}\n\n## C\n\n${words(250)}`;
    const sections = chunkMarkdown("demo", content);
    for (const section of sections) {
      const wordCount = section.text.trim().split(/\s+/).length;
      expect(wordCount).toBeGreaterThanOrEqual(300);
    }
  });

  it("splits an oversized heading into multiple sections near the target size", () => {
    const content = `## Huge\n\n${Array.from({ length: 10 }, () => words(150)).join("\n\n")}`;
    const sections = chunkMarkdown("demo", content);
    expect(sections.length).toBeGreaterThan(1);
    for (const section of sections) {
      const wordCount = section.text.trim().split(/\s+/).length;
      expect(wordCount).toBeLessThanOrEqual(800);
    }
  });

  it("assigns stable, sequential, zero-padded ids per source", () => {
    const content = `## One\n\n${words(320)}\n\n## Two\n\n${words(320)}`;
    const sections = chunkMarkdown("fs", content);
    expect(sections.map((s) => s.id)).toEqual(["fs-01", "fs-02"]);
    expect(sections.every((s) => s.source === "fs")).toBe(true);
  });
});
