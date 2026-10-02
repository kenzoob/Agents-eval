export interface Section {
  id: string;
  source: string;
  heading: string;
  text: string;
}

export interface IndexEntry extends Section {
  embedding: number[];
}

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  /** Opaque provider-specific data that must be echoed back verbatim on the
   * next turn (e.g. Gemini's thought_signature). Never inspected, only
   * round-tripped. */
  extra?: Record<string, unknown>;
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  name?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatResult {
  message: ChatMessage;
  usage: { inputTokens: number; outputTokens: number };
}

export interface LlmProvider {
  chat(messages: ChatMessage[], tools: ToolDefinition[]): Promise<ChatResult>;
  embed(texts: string[]): Promise<number[][]>;
}

export interface AgentResult {
  answer: string;
  citedSources: string[];
  steps: number;
  usage: { inputTokens: number; outputTokens: number };
}
