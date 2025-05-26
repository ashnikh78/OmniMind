export interface ModelSettings {
  temperature: number;
  maxTokens: number;
  topP: number;
  topK: number;
  presencePenalty: number;
  frequencyPenalty: number;
  stopSequences: string[];
  contextWindow: number;
  streaming: boolean;
  systemPrompt: string;
} 