import { loadConfig } from "./config.js";
import { createProvider } from "./llm/provider.js";
import { buildIndex } from "./ingest.js";

const poisoned = process.argv.includes("--poisoned");
const docsDir = poisoned ? "evals/poisoned" : "docs";
const outputPath = poisoned ? "data/poisoned-index.json" : "data/index.json";

const config = loadConfig();
const provider = createProvider(config);
const index = await buildIndex(docsDir, outputPath, provider);
console.log(`Indexed ${index.length} sections from ${docsDir} -> ${outputPath}`);
