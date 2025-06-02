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
export interface Message {
  id: string;              // Unique identifier for the message
  role: 'user' | 'assistant' | 'system';  // Role of the message sender
  content: string;         // The message content
  createdAt?: Date;        // Optional timestamp
}
