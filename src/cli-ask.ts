import { loadConfig } from "./config.js";
import { createProvider } from "./llm/provider.js";
import { loadIndex } from "./retrieval.js";
import { runAgent } from "./agent.js";
import { SYSTEM_PROMPT as V1_PROMPT } from "./prompts/v1.js";
import { SYSTEM_PROMPT as V2_PROMPT } from "./prompts/v2.js";

const args = process.argv.slice(2).filter((a) => a !== "--");
const promptFlagIndex = args.indexOf("--prompt");
const promptVersion = (promptFlagIndex >= 0 ? args[promptFlagIndex + 1] : "v1") ?? "v1";
const question =
  promptFlagIndex >= 0
    ? args.filter((_, i) => i !== promptFlagIndex && i !== promptFlagIndex + 1).join(" ")
    : args.join(" ");

if (!question.trim()) {
  console.error('Usage: npm run ask -- "your question" [--prompt v1|v2]');
  process.exit(1);
}

const systemPrompt = promptVersion === "v2" ? V2_PROMPT : V1_PROMPT;
const config = loadConfig();
const provider = createProvider(config);
const index = await loadIndex("data/index.json");

const result = await runAgent({ question, systemPrompt, index, provider });
console.log(result.answer);
console.log(`\n[${result.steps} step(s), sources: ${result.citedSources.join(", ") || "none"}]`);
