export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    model?: string;
    tokens?: number;
    latency?: number;
    confidence?: number;
    entities?: Array<{
      type: string;
      value: string;
      confidence: number;
    }>;
    sentiment?: {
      score: number;
      label: string;
    };
    intent?: {
      type: string;
      confidence: number;
    };
  };
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  context: {
    model: string;
    parameters: {
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      frequencyPenalty?: number;
      presencePenalty?: number;
      [key: string]: unknown;
    };
    memory: {
      shortTerm?: unknown[];
      longTerm?: Record<string, unknown>;
      [key: string]: unknown;
    };
  };
  metadata: {
    created: string;
    lastUpdated: string;
    totalTokens: number;
    averageLatency: number;
  };
}

export interface ChatSettings {
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  stopSequences: string[];
}

export interface ChatAnalytics {
  messageCount: number;
  averageResponseTime: number;
  tokenUsage: number;
  sentimentTrend: number[];
  intentDistribution: Record<string, number>;
  entityFrequency: Record<string, number>;
}

export interface ChatExport {
  session: ChatSession;
  analytics: ChatAnalytics;
  exportDate: string;
  format: 'json' | 'markdown' | 'pdf';
} 