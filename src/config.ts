export type ProviderName = "anthropic" | "openai" | "ollama";

export interface Config {
  provider: ProviderName;
  apiKey: string;
  chatModel: string;
  embeddingModel: string;
  ollamaUrl: string;
}

function requireProvider(value: string | undefined): ProviderName {
  if (value === "anthropic" || value === "openai" || value === "ollama") return value;
  throw new Error(`LLM_PROVIDER must be anthropic, openai or ollama, got: ${value}`);
}

export function loadConfig(): Config {
  const provider = requireProvider(process.env.LLM_PROVIDER);
  if (provider !== "ollama" && !process.env.LLM_API_KEY) {
    throw new Error(`LLM_API_KEY is required when LLM_PROVIDER=${provider}`);
  }
  return {
    provider,
    apiKey: process.env.LLM_API_KEY ?? "",
    chatModel: process.env.CHAT_MODEL ?? "llama3.1",
    embeddingModel: process.env.EMBEDDING_MODEL ?? "nomic-embed-text",
    ollamaUrl: process.env.OLLAMA_URL ?? "http://localhost:11434",
  };
}
