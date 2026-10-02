import type { LlmProvider } from "../types.js";
import { createOpenAiProvider } from "./openai.js";

export const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";

export function createGeminiProvider(apiKey: string, chatModel: string, embeddingModel: string): LlmProvider {
  return createOpenAiProvider(apiKey, chatModel, embeddingModel, GEMINI_BASE_URL);
}
