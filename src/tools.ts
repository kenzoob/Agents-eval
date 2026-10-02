import { topK } from "./retrieval.js";
import type { IndexEntry, LlmProvider, ToolDefinition } from "./types.js";

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "search_docs",
    description: "Search the Node.js documentation index and return the top matching sections.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "What to search for" },
        k: { type: "number", description: "How many results to return (default 3)" },
      },
      required: ["query"],
    },
  },
  {
    name: "read_section",
    description: "Read the full text of one documentation section by its id.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "Section id, e.g. fs-03" },
      },
      required: ["id"],
    },
  },
];

const DEFAULT_K = 3;

export type ToolHandler = (args: Record<string, unknown>) => Promise<string>;

export function createToolHandlers(index: IndexEntry[], provider: LlmProvider): Record<string, ToolHandler> {
  return {
    async search_docs(args) {
      const query = String(args.query ?? "");
      const k = typeof args.k === "number" ? args.k : DEFAULT_K;
      const [queryEmbedding] = await provider.embed([query]);
      const results = topK(index, queryEmbedding!, k).map(({ entry, score }) => ({
        id: entry.id,
        source: entry.source,
        heading: entry.heading,
        score: Number(score.toFixed(4)),
        snippet: entry.text.slice(0, 300),
      }));
      return JSON.stringify(results);
    },

    async read_section(args) {
      const id = String(args.id ?? "");
      const entry = index.find((e) => e.id === id);
      if (!entry) return JSON.stringify({ error: `no section with id ${id}` });
      return JSON.stringify({ id: entry.id, source: entry.source, heading: entry.heading, text: entry.text });
    },
  };
}
