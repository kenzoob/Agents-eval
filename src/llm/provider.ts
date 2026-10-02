import type { Config } from "../config.js";
import type { LlmProvider } from "../types.js";
import { createAnthropicProvider } from "./anthropic.js";
import { createOpenAiProvider } from "./openai.js";
import { createOllamaProvider } from "./ollama.js";
import { createGeminiProvider } from "./gemini.js";

function createChatProvider(config: Config): LlmProvider {
  switch (config.provider) {
    case "anthropic":
      return createAnthropicProvider(config.apiKey, config.chatModel);
    case "openai":
      return createOpenAiProvider(config.apiKey, config.chatModel, config.embeddingModel);
    case "gemini":
      return createGeminiProvider(config.apiKey, config.chatModel, config.embeddingModel);
    case "ollama":
      return createOllamaProvider(config.ollamaUrl, config.chatModel, config.embeddingModel);
  }
}

export function createProvider(config: Config): LlmProvider {
  const chat = createChatProvider(config);
  if (config.provider !== "anthropic") return chat;

  // Anthropic has no embeddings API, so embeddings always go through ollama.
  const embedder = createOllamaProvider(config.ollamaUrl, config.chatModel, config.embeddingModel);
  return { chat: chat.chat, embed: embedder.embed };
}
