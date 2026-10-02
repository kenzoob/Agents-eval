import { TOOL_DEFINITIONS, createToolHandlers } from "./tools.js";
import type { AgentResult, ChatMessage, IndexEntry, LlmProvider } from "./types.js";

const MAX_STEPS = 5;
const SECTION_ID_RE = /\b[a-z][a-z0-9_]*(?:-[a-z0-9_]+)*-\d{2}\b/g;

export function extractCitedSources(text: string): string[] {
  return [...new Set(text.match(SECTION_ID_RE) ?? [])];
}

export interface RunAgentOptions {
  question: string;
  systemPrompt: string;
  index: IndexEntry[];
  provider: LlmProvider;
  maxSteps?: number;
}

export async function runAgent(options: RunAgentOptions): Promise<AgentResult> {
  const { question, systemPrompt, index, provider } = options;
  const maxSteps = options.maxSteps ?? MAX_STEPS;
  const handlers = createToolHandlers(index, provider);

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: question },
  ];

  const usage = { inputTokens: 0, outputTokens: 0 };
  let steps = 0;
  let lastContent = "";

  for (steps = 1; steps <= maxSteps; steps++) {
    const isLastStep = steps === maxSteps;
    const result = await provider.chat(messages, isLastStep ? [] : TOOL_DEFINITIONS);
    usage.inputTokens += result.usage.inputTokens;
    usage.outputTokens += result.usage.outputTokens;
    messages.push(result.message);
    lastContent = result.message.content;

    if (!result.message.toolCalls?.length) break;

    for (const call of result.message.toolCalls) {
      const handler = handlers[call.name];
      const output = handler
        ? await handler(call.arguments)
        : JSON.stringify({ error: `unknown tool ${call.name}` });
      messages.push({ role: "tool", content: output, toolCallId: call.id, name: call.name });
    }
  }

  return {
    answer: lastContent,
    citedSources: extractCitedSources(lastContent),
    steps: Math.min(steps, maxSteps),
    usage,
  };
}
