import { WebSocketMessage } from '../types/api';
import { mlService } from './mlService';
import { wsService } from './websocket';

interface ChatMessage {
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

interface ChatSession {
  id: string;
  messages: ChatMessage[];
  context: {
    model: string;
    parameters: Record<string, any>;
    memory: Record<string, any>;
  };
  metadata: {
    created: string;
    lastUpdated: string;
    totalTokens: number;
    averageLatency: number;
  };
}

class ChatService {
  private sessions: Map<string, ChatSession> = new Map();
  private activeSession: ChatSession | null = null;
  private messageHandlers: Map<string, ((message: ChatMessage) => void)[]> = new Map();

  constructor() {
    this.setupWebSocket();
  }

  private setupWebSocket(): void {
    wsService.onMessage('chat_message', this.handleIncomingMessage.bind(this));
  }

  // Session Management
  async createSession(modelId: string, parameters?: Record<string, any>): Promise<ChatSession> {
    const session: ChatSession = {
      id: Math.random().toString(36).substring(2),
      messages: [],
      context: {
        model: modelId,
        parameters: parameters || {},
        memory: {},
      },
      metadata: {
        created: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        totalTokens: 0,
        averageLatency: 0,
      },
    };

    this.sessions.set(session.id, session);
    this.activeSession = session;
    return session;
  }

  async getSession(id: string): Promise<ChatSession | null> {
    return this.sessions.get(id) || null;
  }

  async updateSession(id: string, data: Partial<ChatSession>): Promise<ChatSession> {
    const session = this.sessions.get(id);
    if (!session) throw new Error('Session not found');

    const updatedSession = { ...session, ...data };
    this.sessions.set(id, updatedSession);
    return updatedSession;
  }

  async deleteSession(id: string): Promise<void> {
    this.sessions.delete(id);
    if (this.activeSession?.id === id) {
      this.activeSession = null;
    }
  }

  // Message Handling
  async sendMessage(content: string, sessionId?: string): Promise<ChatMessage> {
    const session = sessionId ? this.sessions.get(sessionId) : this.activeSession;
    if (!session) throw new Error('No active session');

    const userMessage: ChatMessage = {
      id: Math.random().toString(36).substring(2),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    session.messages.push(userMessage);
    this.notifyMessageHandlers(userMessage);

    // Process message with ML model
    const response = await this.processMessageWithML(userMessage, session);
    session.messages.push(response);
    this.notifyMessageHandlers(response);

    // Update session metadata
    session.metadata.lastUpdated = new Date().toISOString();
    session.metadata.totalTokens += (response.metadata?.tokens || 0);
    session.metadata.averageLatency = 
      (session.metadata.averageLatency * (session.messages.length - 1) + 
       (response.metadata?.latency || 0)) / session.messages.length;

    return response;
  }

  private async processMessageWithML(
    message: ChatMessage,
    session: ChatSession
  ): Promise<ChatMessage> {
    // Prepare context from previous messages
    const context = this.prepareContext(session);

    // Run inference with ML model
    const response = await mlService.runInference({
      modelId: session.context.model,
      input: {
        message: message.content,
        context,
        parameters: session.context.parameters,
      },
    });

    // Process response
    const assistantMessage: ChatMessage = {
      id: Math.random().toString(36).substring(2),
      role: 'assistant',
      content: response.output as string,
      timestamp: new Date().toISOString(),
      metadata: {
        model: session.context.model,
        tokens: response.metadata.tokens,
        latency: response.metadata.latency,
        confidence: this.calculateConfidence(response),
        entities: this.extractEntities(response.output as string),
        sentiment: this.analyzeSentiment(response.output as string),
        intent: this.detectIntent(response.output as string),
      },
    };

    // Update session memory
    this.updateSessionMemory(session, message, assistantMessage);

    return assistantMessage;
  }

  private prepareContext(session: ChatSession): string {
    // Combine relevant previous messages and memory
    const recentMessages = session.messages.slice(-5);
    const context = recentMessages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');
    
    return `${context}\nMemory: ${JSON.stringify(session.context.memory)}`;
  }

  private calculateConfidence(response: any): number {
    // Implement confidence calculation based on model output
    return 0.95; // Placeholder
  }

  private extractEntities(text: string): Array<{ type: string; value: string; confidence: number }> {
    // Implement entity extraction
    return []; // Placeholder
  }

  private analyzeSentiment(text: string): { score: number; label: string } {
    // Implement sentiment analysis
    return { score: 0.5, label: 'neutral' }; // Placeholder
  }

  private detectIntent(text: string): { type: string; confidence: number } {
    // Implement intent detection
    return { type: 'general', confidence: 0.9 }; // Placeholder
  }

  private updateSessionMemory(
    session: ChatSession,
    userMessage: ChatMessage,
    assistantMessage: ChatMessage
  ): void {
    // Update session memory based on conversation
    const memory = session.context.memory;
    
    // Store entities
    assistantMessage.metadata?.entities?.forEach(entity => {
      if (!memory[entity.type]) memory[entity.type] = [];
      memory[entity.type].push(entity.value);
    });

    // Store intent
    if (assistantMessage.metadata?.intent) {
      memory.lastIntent = assistantMessage.metadata.intent;
    }

    // Store sentiment
    if (assistantMessage.metadata?.sentiment) {
      memory.sentimentHistory = memory.sentimentHistory || [];
      memory.sentimentHistory.push(assistantMessage.metadata.sentiment);
    }
  }

  // Event Handling
  onMessage(handler: (message: ChatMessage) => void): void {
    const handlerId = Math.random().toString(36).substring(2);
    this.messageHandlers.set(handlerId, [handler]);
  }

  offMessage(handlerId: string): void {
    this.messageHandlers.delete(handlerId);
  }

  private notifyMessageHandlers(message: ChatMessage): void {
    this.messageHandlers.forEach(handlers => {
      handlers.forEach(handler => handler(message));
    });
  }

  private handleIncomingMessage(message: WebSocketMessage): void {
    if (message.type === 'chat_message') {
      const chatMessage = message.payload as ChatMessage;
      this.notifyMessageHandlers(chatMessage);
    }
  }

  // Analytics
  async getSessionAnalytics(sessionId: string): Promise<{
    messageCount: number;
    averageResponseTime: number;
    tokenUsage: number;
    sentimentTrend: number[];
    intentDistribution: Record<string, number>;
    entityFrequency: Record<string, number>;
  }> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    return {
      messageCount: session.messages.length,
      averageResponseTime: session.metadata.averageLatency,
      tokenUsage: session.metadata.totalTokens,
      sentimentTrend: session.messages
        .filter(m => m.metadata?.sentiment)
        .map(m => m.metadata!.sentiment!.score),
      intentDistribution: this.calculateIntentDistribution(session),
      entityFrequency: this.calculateEntityFrequency(session),
    };
  }

  private calculateIntentDistribution(session: ChatSession): Record<string, number> {
    const distribution: Record<string, number> = {};
    session.messages
      .filter(m => m.metadata?.intent)
      .forEach(m => {
        const intent = m.metadata!.intent!.type;
        distribution[intent] = (distribution[intent] || 0) + 1;
      });
    return distribution;
  }

  private calculateEntityFrequency(session: ChatSession): Record<string, number> {
    const frequency: Record<string, number> = {};
    session.messages
      .filter(m => m.metadata?.entities)
      .forEach(m => {
        m.metadata!.entities!.forEach(entity => {
          frequency[entity.type] = (frequency[entity.type] || 0) + 1;
        });
      });
    return frequency;
  }
}

export const chatService = new ChatService();
export default chatService; 