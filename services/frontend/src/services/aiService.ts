import axios from 'axios';
import { ollamaService } from './ollamaService';

export interface SentimentAnalysis {
  label: 'positive' | 'negative' | 'neutral';
  score: number;
  confidence: number;
}

export interface IntentClassification {
  type: string;
  confidence: number;
  entities: Entity[];
}

export interface Entity {
  type: string;
  value: string;
  confidence: number;
  start: number;
  end: number;
}

export interface ConversationContext {
  topic: string;
  sentiment: SentimentAnalysis;
  intent: IntentClassification;
  entities: Entity[];
  memory: {
    shortTerm: string[];
    longTerm: Map<string, any>;
  };
}

export interface ChatAnalytics {
  messageCount: number;
  averageResponseTime: number;
  sentimentTrends: Array<{
    timestamp: string;
    positive: number;
    negative: number;
    neutral: number;
  }>;
  intentDistribution: Array<{
    type: string;
    count: number;
  }>;
  entityFrequency: Array<{
    type: string;
    value: string;
    count: number;
  }>;
  tokenUsage: {
    total: number;
    average: number;
    byModel: Record<string, number>;
  };
}

export interface Model {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  maxTokens: number;
  temperature: number;
}

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
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    sentiment?: string;
    intent?: string;
    entities?: string[];
    tokens?: number;
  };
}

export interface MessageResponse {
  content: string;
  sentiment: string;
  intent: string;
  entities: string[];
  tokens: number;
}

export interface AdvancedModelSettings {
  repetitionPenalty?: number;
  beamSize?: number;
  earlyStopping?: boolean;
  doSample?: boolean;
  typicalP?: number;
  epsilonCutoff?: number;
  etaCutoff?: number;
  diversityPenalty?: number;
  encoderRepetitionPenalty?: number;
  numBeams?: number;
  padTokenId?: number;
  eosTokenId?: number;
  forcedBosTokenId?: number;
  forcedEosTokenId?: number;
  removeInvalidValues?: boolean;
  exponentialDecayLengthPenalty?: number;
  renormalizeLogits?: boolean;
  suppressTokens?: number[];
  beginSuppressTokens?: number[];
  forcedDecoderIds?: number[][];
}

export interface MemorySystem {
  shortTerm: {
    messages: Message[];
    capacity: number;
    importance: Map<string, number>;
  };
  longTerm: {
    facts: Map<string, { id: string; content: string; importance: number }>;
    relationships: Map<string, string[]>;
    userPreferences: Map<string, string | number | boolean>;
    conversationPatterns: Map<string, number>;
  };
  workingMemory: {
    currentContext: string;
    activeGoals: string[];
    attention: Map<string, number>;
  };
}

export interface EnhancedMemorySystem extends MemorySystem {
  adaptiveLearning: {
    userPreferences: Map<string, string | number | boolean>;
    interactionPatterns: Map<string, number>;
    learningProgress: Map<string, number>;
    skillLevels: Map<string, number>;
  };
  contextManagement: {
    activeTopics: Set<string>;
    topicHistory: Array<{ topic: string; timestamp: number }>;
    contextSwitches: Array<{ from: string; to: string; timestamp: number }>;
    relevanceScores: Map<string, number>;
  };
  conversationInsights: {
    engagementMetrics: {
      responseTime: number;
      messageLength: number;
      interactionDepth: number;
      topicCoherence: number;
    };
    userBehavior: {
      preferredTopics: string[];
      activeHours: number[];
      interactionStyle: string;
      learningStyle: string;
    };
    performanceMetrics: {
      accuracy: number;
      relevance: number;
      satisfaction: number;
      adaptation: number;
    };
  };
}

export interface AdvancedAnalytics extends ChatAnalytics {
  conversationFlow: {
    topicTransitions: Array<{ from: string; to: string; confidence: number }>;
    userEngagement: {
      responseTime: number;
      messageLength: number;
      interactionDepth: number;
    };
    modelPerformance: {
      latency: number;
      tokenEfficiency: number;
      contextUtilization: number;
    };
  };
  semanticAnalysis: {
    topicClusters: Array<{ topic: string; messages: string[]; confidence: number }>;
    sentimentEvolution: Array<{ timestamp: string; sentiment: number; confidence: number }>;
    intentProgression: Array<{ timestamp: string; intent: string; confidence: number }>;
  };
  userInsights: {
    interactionPatterns: Array<{ pattern: string; frequency: number }>;
    preferenceChanges: Array<{ preference: string; oldValue: any; newValue: any; timestamp: string }>;
    satisfactionMetrics: {
      overall: number;
      byFeature: Record<string, number>;
      trend: Array<{ timestamp: string; score: number }>;
    };
  };
}

interface UserPreference {
  value: string | number | boolean;
  confidence: number;
  lastUpdated: string;
  source: 'explicit' | 'inferred' | 'default';
}

interface PreferenceChange {
  preference: string;
  oldValue: string | number | boolean;
  newValue: string | number | boolean;
  timestamp: string;
}

interface MemoryEntry {
  key: string;
  value: string;
  timestamp: string;
  importance: number;
  source: 'conversation' | 'user-input' | 'system';
}

export class AIService {
  private baseUrl: string;
  private apiUrl: string;
  private apiKey: string;
  private memorySystem!: EnhancedMemorySystem;
  private contextWindow: number;
  private maxMemoryItems: number;
  private learningRate: number;
  private adaptationThreshold: number;
  private longTerm: Map<string, MemoryEntry>;
  private userPreferences: Map<string, UserPreference>;
  private preferenceHistory: PreferenceChange[];

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiUrl = `${baseUrl}/api`;
    this.apiKey = apiKey;
    this.contextWindow = 4000;
    this.maxMemoryItems = 1000;
    this.learningRate = 0.1;
    this.adaptationThreshold = 0.7;
    this.longTerm = new Map<string, MemoryEntry>();
    this.userPreferences = new Map<string, UserPreference>();
    this.preferenceHistory = [];
    this.initializeMemorySystem();
  }

  private initializeMemorySystem() {
    this.memorySystem = {
      shortTerm: {
        messages: [],
        capacity: 50,
        importance: new Map(),
      },
      longTerm: {
        facts: new Map(),
        relationships: new Map(),
        userPreferences: new Map(),
        conversationPatterns: new Map(),
      },
      workingMemory: {
        currentContext: '',
        activeGoals: [],
        attention: new Map(),
      },
      adaptiveLearning: {
        userPreferences: new Map(),
        interactionPatterns: new Map(),
        learningProgress: new Map(),
        skillLevels: new Map(),
      },
      contextManagement: {
        activeTopics: new Set(),
        topicHistory: [],
        contextSwitches: [],
        relevanceScores: new Map(),
      },
      conversationInsights: {
        engagementMetrics: {
          responseTime: 0,
          messageLength: 0,
          interactionDepth: 0,
          topicCoherence: 0,
        },
        userBehavior: {
          preferredTopics: [],
          activeHours: [],
          interactionStyle: 'balanced',
          learningStyle: 'adaptive',
        },
        performanceMetrics: {
          accuracy: 0,
          relevance: 0,
          satisfaction: 0,
          adaptation: 0,
        },
      },
    };
  }

  private async updateMemorySystem(message: Message) {
    // Update short-term memory
    this.memorySystem.shortTerm.messages.push(message);
    if (this.memorySystem.shortTerm.messages.length > this.memorySystem.shortTerm.capacity) {
      this.memorySystem.shortTerm.messages.shift();
    }

    // Calculate message importance
    const importance = await this.calculateMessageImportance(message);
    this.memorySystem.shortTerm.importance.set(message.id, importance);

    // Update working memory
    this.memorySystem.workingMemory.currentContext = await this.generateContextSummary();
    this.memorySystem.workingMemory.activeGoals = await this.extractActiveGoals(message);

    // Update long-term memory if message is important
    if (importance > 0.7) {
      await this.updateLongTermMemory(message);
    }

    // Update adaptive learning
    await this.updateAdaptiveLearning(message);

    // Update context management
    await this.updateContextManagement(message);

    // Update conversation insights
    await this.updateConversationInsights(message);
  }

  private async calculateMessageImportance(message: Message): Promise<number> {
    const factors = {
      length: message.content.length / 1000,
      entities: message.metadata?.entities?.length || 0,
      sentiment: Math.abs(parseFloat(message.metadata?.sentiment || '0')),
      intent: message.metadata?.intent ? 1 : 0,
    };

    return (
      factors.length * 0.3 +
      factors.entities * 0.2 +
      factors.sentiment * 0.3 +
      factors.intent * 0.2
    );
  }

  private async generateContextSummary(): Promise<string> {
    const recentMessages = this.memorySystem.shortTerm.messages.slice(-5);
    const summary = await ollamaService.summarize(recentMessages.map(m => m.content).join('\n'));
    return summary;
  }

  private async extractActiveGoals(message: Message): Promise<string[]> {
    const goals = await ollamaService.extractGoals(message.content);
    return goals;
  }

  private async updateLongTermMemory(message: Message) {
    // Extract and store facts
    const facts = await ollamaService.extractFacts(message.content);
    facts.forEach(fact => {
      this.memorySystem.longTerm.facts.set(fact.id, fact);
    });

    // Update relationships
    const relationships = await ollamaService.extractRelationships(message.content);
    relationships.forEach(rel => {
      const existing = this.memorySystem.longTerm.relationships.get(rel.from) || [];
      this.memorySystem.longTerm.relationships.set(rel.from, [...existing, rel.to]);
    });

    // Update user preferences
    const preferences = await ollamaService.extractPreferences(message.content);
    preferences.forEach(pref => {
      this.memorySystem.longTerm.userPreferences.set(pref.key, pref.value);
    });
  }

  private async updateAdaptiveLearning(message: Message) {
    // Update user preferences
    const preferences = await ollamaService.extractPreferences(message.content);
    preferences.forEach(pref => {
      const currentValue = this.memorySystem.adaptiveLearning.userPreferences.get(pref.key);
      const newValue = this.adaptValue(currentValue ?? '', pref.value);
      this.memorySystem.adaptiveLearning.userPreferences.set(pref.key, newValue);
    });

    // Update interaction patterns
    const pattern = this.extractInteractionPattern(message);
    const currentCount = this.memorySystem.adaptiveLearning.interactionPatterns.get(pattern) || 0;
    this.memorySystem.adaptiveLearning.interactionPatterns.set(pattern, currentCount + 1);

    // Update learning progress
    const progress = await this.assessLearningProgress(message);
    this.memorySystem.adaptiveLearning.learningProgress.set(message.id, progress);

    // Update skill levels
    const skills = await this.extractSkills(message);
    skills.forEach(skill => {
      const currentLevel = Number(this.memorySystem.adaptiveLearning.skillLevels.get(skill)) || 0;
      const newLevel = Math.min(currentLevel + this.learningRate, 1.0);
      this.memorySystem.adaptiveLearning.skillLevels.set(skill, newLevel);
    });
  }

  private async updateContextManagement(message: Message) {
    // Update active topics
    const topics = await this.extractTopics(message);
    topics.forEach(topic => {
      this.memorySystem.contextManagement.activeTopics.add(topic);
      this.memorySystem.contextManagement.topicHistory.push({
        topic,
        timestamp: Date.now(),
      });
    });

    // Track context switches
    if (this.memorySystem.contextManagement.topicHistory.length > 1) {
      const lastTopic = this.memorySystem.contextManagement.topicHistory[
        this.memorySystem.contextManagement.topicHistory.length - 2
      ].topic;
      const currentTopic = topics[0];
      if (lastTopic !== currentTopic) {
        this.memorySystem.contextManagement.contextSwitches.push({
          from: lastTopic,
          to: currentTopic,
          timestamp: Date.now(),
        });
      }
    }

    // Update relevance scores
    const relevance = await this.calculateRelevance(message);
    this.memorySystem.contextManagement.relevanceScores.set(message.id, relevance);
  }

  private async updateConversationInsights(message: Message) {
    // Update engagement metrics
    const metrics = await this.calculateEngagementMetrics(message);
    this.memorySystem.conversationInsights.engagementMetrics = {
      ...this.memorySystem.conversationInsights.engagementMetrics,
      ...metrics,
    };

    // Update user behavior
    const behavior = await this.analyzeUserBehavior(message);
    this.memorySystem.conversationInsights.userBehavior = {
      ...this.memorySystem.conversationInsights.userBehavior,
      ...behavior,
    };

    // Update performance metrics
    const performance = await this.assessPerformance(message);
    this.memorySystem.conversationInsights.performanceMetrics = {
      ...this.memorySystem.conversationInsights.performanceMetrics,
      ...performance,
    };
  }

  private adaptValue(current: string | number | boolean, newValue: string | number | boolean): string | number | boolean {
    if (typeof current === typeof newValue) {
      return newValue;
    }
    // Handle type conversion if needed
    if (typeof current === 'number' && typeof newValue === 'string') {
      const num = parseFloat(newValue);
      return isNaN(num) ? current : num;
    }
    if (typeof current === 'boolean' && typeof newValue === 'string') {
      return newValue.toLowerCase() === 'true';
    }
    return current;
  }

  private extractInteractionPattern(message: Message): string {
    // Analyze message structure and content to identify interaction patterns
    const length = message.content.length;
    const hasQuestions = message.content.includes('?');
    const hasCommands = message.content.includes('!');
    const hasEmotions = /[!?]/.test(message.content);

    if (hasQuestions && hasEmotions) return 'emotional_inquiry';
    if (hasCommands) return 'directive';
    if (length > 200) return 'detailed_explanation';
    return 'simple_interaction';
  }

  private async assessLearningProgress(message: Message): Promise<number> {
    // Analyze message content to assess learning progress
    const complexity = this.calculateComplexity(message.content);
    const relevance = await this.calculateRelevance(message);
    const engagement = this.calculateEngagement(message.content);

    return (complexity + relevance + engagement) / 3;
  }

  private async extractSkills(message: Message): Promise<string[]> {
    // Extract skills mentioned or demonstrated in the message
    const skills = new Set<string>();
    
    // Add skills based on content analysis
    if (message.content.includes('code') || message.content.includes('programming')) {
      skills.add('programming');
    }
    if (message.content.includes('analyze') || message.content.includes('analysis')) {
      skills.add('analysis');
    }
    if (message.content.includes('explain') || message.content.includes('explanation')) {
      skills.add('explanation');
    }

    return Array.from(skills);
  }

  private async extractTopics(message: Message): Promise<string[]> {
    // Extract topics from message content
    const topics = new Set<string>();
    
    // Add topics based on content analysis
    if (message.content.includes('AI') || message.content.includes('artificial intelligence')) {
      topics.add('artificial_intelligence');
    }
    if (message.content.includes('data') || message.content.includes('analysis')) {
      topics.add('data_analysis');
    }
    if (message.content.includes('code') || message.content.includes('programming')) {
      topics.add('programming');
    }

    return Array.from(topics);
  }

  private async calculateRelevance(message: Message): Promise<number> {
    // Calculate relevance score based on context and content
    const contextRelevance = this.calculateContextRelevance(message);
    const contentRelevance = this.calculateContentRelevance(message);
    const userRelevance = this.calculateUserRelevance(message);

    return (contextRelevance + contentRelevance + userRelevance) / 3;
  }

  private calculateContextRelevance(message: Message): number {
    // Calculate relevance based on current context
    const currentContext = this.memorySystem.workingMemory.currentContext;
    const contextMatch = this.calculateTextSimilarity(message.content, currentContext);
    return contextMatch;
  }

  private calculateContentRelevance(message: Message): number {
    // Calculate relevance based on content quality
    const length = message.content.length;
    const hasStructure = /[.!?]/.test(message.content);
    const hasDetails = message.content.split(' ').length > 10;

    return (length / 1000 + (hasStructure ? 0.3 : 0) + (hasDetails ? 0.3 : 0)) / 3;
  }

  private calculateUserRelevance(message: Message): number {
    // Calculate relevance based on user preferences
    const preferences = Array.from(this.memorySystem.adaptiveLearning.userPreferences.entries());
    const preferenceMatch = preferences.reduce((sum, [key, value]) => {
      return sum + (message.content.includes(key) ? (typeof value === 'number' ? value : 0) : 0);
    }, 0);

    return Math.min(preferenceMatch / preferences.length, 1);
  }

  private async calculateEngagementMetrics(message: Message) {
    return {
      responseTime: this.calculateResponseTime(message),
      messageLength: message.content.length,
      interactionDepth: this.calculateInteractionDepth(message),
      topicCoherence: await this.calculateTopicCoherence(message),
    };
  }

  private calculateResponseTime(message: Message): number {
    // Calculate response time based on message timestamp
    const now = Date.now();
    const messageTime = new Date(message.timestamp).getTime();
    return now - messageTime;
  }

  private calculateInteractionDepth(message: Message): number {
    // Calculate interaction depth based on message complexity
    const words = message.content.split(' ').length;
    const sentences = message.content.split(/[.!?]+/).length;
    const paragraphs = message.content.split('\n\n').length;

    return (words / 100 + sentences / 5 + paragraphs) / 3;
  }

  private async calculateTopicCoherence(message: Message): Promise<number> {
    // Calculate topic coherence based on context
    const topics = await this.extractTopics(message);
    const activeTopics = Array.from(this.memorySystem.contextManagement.activeTopics);
    
    const topicMatches = topics.filter(topic => activeTopics.includes(topic)).length;
    return topicMatches / Math.max(topics.length, 1);
  }

  private async analyzeUserBehavior(message: Message) {
    const hour = new Date(message.timestamp).getHours();
    const activeHours = [...this.memorySystem.conversationInsights.userBehavior.activeHours, hour];
    
    const preferredTopics = await this.extractTopics(message);
    const currentTopics = this.memorySystem.conversationInsights.userBehavior.preferredTopics;
    const updatedTopics = Array.from(new Set([...currentTopics, ...preferredTopics]));

    const interactionStyle = this.determineInteractionStyle(message);
    const learningStyle = this.determineLearningStyle(message);

    return {
      preferredTopics: updatedTopics,
      activeHours,
      interactionStyle,
      learningStyle,
    };
  }

  private determineInteractionStyle(message: Message): string {
    const length = message.content.length;
    const hasQuestions = message.content.includes('?');
    const hasEmotions = /[!?]/.test(message.content);

    if (length > 200 && hasQuestions) return 'detailed_inquiry';
    if (hasEmotions) return 'emotional';
    if (length < 50) return 'concise';
    return 'balanced';
  }

  private determineLearningStyle(message: Message): string {
    const hasExamples = message.content.includes('example') || message.content.includes('for instance');
    const hasQuestions = message.content.includes('?');
    const hasExplanations = message.content.includes('because') || message.content.includes('reason');

    if (hasExamples && hasExplanations) return 'practical';
    if (hasQuestions) return 'inquisitive';
    if (hasExplanations) return 'theoretical';
    return 'adaptive';
  }

  private async assessPerformance(message: Message) {
    return {
      accuracy: await this.calculateAccuracy(message),
      relevance: await this.calculateRelevance(message),
      satisfaction: this.calculateSatisfaction(message),
      adaptation: this.calculateAdaptation(message),
    };
  }

  private async calculateAccuracy(message: Message): Promise<number> {
    // Calculate accuracy based on fact checking and consistency
    const facts = await ollamaService.extractFacts(message.content);
    const factAccuracy = facts.reduce((sum, fact) => sum + fact.importance, 0) / facts.length;
    
    const consistency = this.calculateConsistency(message);
    
    return (factAccuracy + consistency) / 2;
  }

  private calculateConsistency(message: Message): number {
    // Calculate consistency with previous messages
    const recentMessages = this.memorySystem.shortTerm.messages.slice(-5);
    const consistencyScores = recentMessages.map(prev => 
      this.calculateTextSimilarity(message.content, prev.content)
    );
    
    return consistencyScores.reduce((sum, score) => sum + score, 0) / consistencyScores.length;
  }

  private calculateSatisfaction(message: Message): number {
    // Calculate user satisfaction based on message characteristics
    const length = message.content.length;
    const hasEmotions = /[!?]/.test(message.content);
    const hasDetails = message.content.split(' ').length > 10;

    return (length / 1000 + (hasEmotions ? 0.3 : 0) + (hasDetails ? 0.3 : 0)) / 3;
  }

  private calculateAdaptation(message: Message): number {
    // Calculate adaptation to user's style and preferences
    const styleMatch = this.calculateStyleMatch(message);
    const preferenceMatch = this.calculatePreferenceMatch(message);
    
    return (styleMatch + preferenceMatch) / 2;
  }

  private calculateStyleMatch(message: Message): number {
    const userStyle = this.memorySystem.conversationInsights.userBehavior.interactionStyle;
    const messageStyle = this.determineInteractionStyle(message);
    
    return userStyle === messageStyle ? 1.0 : 0.5;
  }

  private calculatePreferenceMatch(message: Message): number {
    const preferences = Array.from(this.memorySystem.adaptiveLearning.userPreferences.entries());
    const preferenceMatch = preferences.reduce((sum, [key, value]) => {
      return sum + (message.content.includes(key) ? (typeof value === 'number' ? value : 0) : 0);
    }, 0);

    return Math.min(preferenceMatch / preferences.length, 1);
  }

  private calculateComplexity(text: string): number {
    // Calculate text complexity based on various factors
    const words = text.split(/\s+/).length;
    const sentences = text.split(/[.!?]+/).length;
    const paragraphs = text.split(/\n\n+/).length;
    const longWords = text.split(/\s+/).filter(word => word.length > 6).length;
    
    return (words / 100 + sentences / 5 + paragraphs + longWords / 10) / 4;
  }

  private calculateEngagement(text: string): number {
    // Calculate engagement level based on text characteristics
    const length = text.length;
    const hasQuestions = text.includes('?');
    const hasEmotions = /[!?]/.test(text);
    const hasDetails = text.split(/\s+/).length > 10;
    
    return (length / 1000 + (hasQuestions ? 0.3 : 0) + (hasEmotions ? 0.2 : 0) + (hasDetails ? 0.3 : 0)) / 4;
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    // Simple text similarity calculation
    const words1 = Array.from(new Set(text1.toLowerCase().split(/\W+/)));
    const words2 = Array.from(new Set(text2.toLowerCase().split(/\W+/)));
    
    const intersection = words1.filter(x => words2.includes(x));
    const union = Array.from(new Set([...words1, ...words2]));
    
    return intersection.length / union.length;
  }

  async analyzeSentiment(text: string): Promise<SentimentAnalysis> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/analyze/sentiment`, { text });
      return response.data;
    } catch (error) {
      console.error('Sentiment analysis error:', error);
      return {
        label: 'neutral',
        score: 0,
        confidence: 0
      };
    }
  }

  async classifyIntent(text: string): Promise<IntentClassification> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/analyze/intent`, { text });
      return response.data;
    } catch (error) {
      console.error('Intent classification error:', error);
      return {
        type: 'unknown',
        confidence: 0,
        entities: []
      };
    }
  }

  async extractEntities(text: string): Promise<Entity[]> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/analyze/entities`, { text });
      return response.data;
    } catch (error) {
      console.error('Entity extraction error:', error);
      return [];
    }
  }

  async generateEmbeddings(text: string): Promise<number[]> {
    return ollamaService.generateEmbeddings(text);
  }

  async findSimilarMessages(query: string, messages: string[]): Promise<string[]> {
    const queryEmbedding = await this.generateEmbeddings(query);
    const messageEmbeddings = await Promise.all(
      messages.map(msg => this.generateEmbeddings(msg))
    );

    // Calculate cosine similarity
    const similarities = messageEmbeddings.map(embedding => 
      this.cosineSimilarity(queryEmbedding, embedding)
    );

    // Return top 3 most similar messages
    return messages
      .map((msg, i) => ({ msg, similarity: similarities[i] }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3)
      .map(item => item.msg);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  async analyzeConversation(messages: string[]): Promise<ChatAnalytics> {
    const sentiments = await Promise.all(
      messages.map(msg => this.analyzeSentiment(msg))
    );

    const intents = await Promise.all(
      messages.map(msg => this.classifyIntent(msg))
    );

    const entities = await Promise.all(
      messages.map(msg => this.extractEntities(msg))
    );

    // Calculate intent distribution
    const intentDistribution = new Map<string, number>();
    intents.forEach(intent => {
      const count = intentDistribution.get(intent.type) || 0;
      intentDistribution.set(intent.type, count + 1);
    });

    // Calculate entity frequency
    const entityFrequency = new Map<string, number>();
    entities.flat().forEach(entity => {
      const count = entityFrequency.get(entity.type) || 0;
      entityFrequency.set(entity.type, count + 1);
    });

    return {
      messageCount: messages.length,
      averageResponseTime: 0, // TODO: Implement response time tracking
      sentimentTrends: sentiments.map(sentiment => ({
        timestamp: new Date().toISOString().split('T')[0],
        positive: sentiment.label === 'positive' ? sentiment.score : 0,
        negative: sentiment.label === 'negative' ? sentiment.score : 0,
        neutral: sentiment.label === 'neutral' ? sentiment.score : 0
      })),
      intentDistribution: Array.from(intentDistribution.entries()).map(([type, count]) => ({
        type,
        count
      })),
      entityFrequency: Array.from(entityFrequency.entries()).map(([type, count]) => ({
        type,
        value: type,
        count
      })),
      tokenUsage: {
        total: 0, // TODO: Implement token counting
        average: 0,
        byModel: {}
      }
    };
  }

  async generateContext(messages: string[]): Promise<ConversationContext> {
    const lastMessage = messages[messages.length - 1];
    const [sentiment, intent, entities] = await Promise.all([
      this.analyzeSentiment(lastMessage),
      this.classifyIntent(lastMessage),
      this.extractEntities(lastMessage)
    ]);

    // Extract topic from entities and intent
    const topic = this.extractTopic(entities, intent);

    // Update memory
    const shortTerm = messages.slice(-this.contextWindow);
    const longTerm = new Map<string, any>();
    
    // Store important information in long-term memory
    entities.forEach(entity => {
      if (entity.confidence > 0.8) {
        longTerm.set(entity.value, {
          type: entity.type,
          lastSeen: Date.now(),
          frequency: (longTerm.get(entity.value)?.frequency || 0) + 1
        });
      }
    });

    return {
      topic,
      sentiment,
      intent,
      entities,
      memory: {
        shortTerm,
        longTerm
      }
    };
  }

  private extractTopic(entities: Entity[], intent: IntentClassification): string {
    // Extract topic from entities and intent
    const entityTopics = entities
      .filter(e => e.confidence > 0.7)
      .map(e => e.value)
      .join(' ');

    return entityTopics || intent.type;
  }

  async generateResponse(
    message: string,
    context: ConversationContext
  ): Promise<string> {
    // Prepare context-aware prompt
    const prompt = this.preparePrompt(message, context);

    // Get response from Ollama
    const response = await ollamaService.chat([{
      role: 'user',
      content: prompt,
      timestamp: Date.now()
    }]);

    let responseText = '';
    for await (const chunk of response) {
      if (chunk.message?.content) {
        responseText += chunk.message.content;
      }
    }

    return responseText;
  }

  private preparePrompt(message: string, context: ConversationContext): string {
    return `
Context:
- Topic: ${context.topic}
- Sentiment: ${context.sentiment.label} (${context.sentiment.score})
- Intent: ${context.intent.type}
- Entities: ${context.entities.map(e => e.value).join(', ')}

Previous Context:
${context.memory.shortTerm.slice(-3).join('\n')}

User Message: ${message}

Please provide a response that:
1. Maintains conversation context
2. Addresses the user's intent
3. Considers the sentiment
4. References relevant entities
5. Provides helpful and accurate information
`;
  }

  async getAnalytics(): Promise<ChatAnalytics> {
    try {
      // In a real implementation, this would fetch data from your backend
      // For now, we'll return mock data
      return {
        messageCount: 100,
        averageResponseTime: 1.5,
        sentimentTrends: [
          { timestamp: '2024-01-01', positive: 0.7, negative: 0.2, neutral: 0.1 },
          { timestamp: '2024-01-02', positive: 0.8, negative: 0.1, neutral: 0.1 }
        ],
        intentDistribution: [
          { type: 'question', count: 50 },
          { type: 'command', count: 30 },
          { type: 'statement', count: 20 }
        ],
        entityFrequency: [
          { type: 'topic', value: 'AI', count: 40 },
          { type: 'person', value: 'User', count: 30 },
          { type: 'technology', value: 'ML', count: 20 }
        ],
        tokenUsage: {
          total: 5000,
          average: 50,
          byModel: {
            'model1': 3000,
            'model2': 2000
          }
        }
      };
    } catch (error) {
      console.error('Error fetching analytics:', error);
      throw new Error('Failed to load analytics');
    }
  }

  private async analyzeMessages(messages: string[]): Promise<ChatAnalytics> {
    const sentiments = await Promise.all(messages.map(msg => this.analyzeSentiment(msg)));
    const intents = await Promise.all(messages.map(msg => this.classifyIntent(msg)));
    const entities = await Promise.all(messages.map(msg => this.extractEntities(msg)));

    const intentDistribution = new Map<string, number>();
    const entityFrequency = new Map<string, number>();

    intents.forEach(intent => {
      intentDistribution.set(intent.type, (intentDistribution.get(intent.type) || 0) + 1);
    });

    entities.forEach(entityList => {
      entityList.forEach(entity => {
        const key = `${entity.type}:${entity.value}`;
        entityFrequency.set(key, (entityFrequency.get(key) || 0) + 1);
      });
    });

    const intentDistributionArray = Array.from(intentDistribution).reduce<Array<{ type: string; count: number }>>((acc, [type, count]) => {
      acc.push({ type, count });
      return acc;
    }, []);

    const entityFrequencyArray = Array.from(entityFrequency).reduce<Array<{ type: string; value: string; count: number }>>((acc, [key, count]) => {
      const [type, value] = key.split(':');
      acc.push({ type, value, count });
      return acc;
    }, []);

    return {
      messageCount: messages.length,
      averageResponseTime: 0, // TODO: Implement response time tracking
      sentimentTrends: sentiments.map(sentiment => ({
        timestamp: new Date().toISOString().split('T')[0],
        positive: sentiment.label === 'positive' ? sentiment.score : 0,
        negative: sentiment.label === 'negative' ? sentiment.score : 0,
        neutral: sentiment.label === 'neutral' ? sentiment.score : 0
      })),
      intentDistribution: intentDistributionArray,
      entityFrequency: entityFrequencyArray,
      tokenUsage: {
        total: 0, // TODO: Implement token counting
        average: 0,
        byModel: {}
      }
    };
  }

  async getAvailableModels(): Promise<Model[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching models:', error);
      return [
        {
          id: 'gpt-4',
          name: 'GPT-4',
          description: 'Most capable model, best for complex tasks',
          capabilities: ['text', 'code', 'reasoning'],
          maxTokens: 8192,
          temperature: 0.7,
        },
        {
          id: 'gpt-3.5-turbo',
          name: 'GPT-3.5 Turbo',
          description: 'Fast and efficient model for most tasks',
          capabilities: ['text', 'code'],
          maxTokens: 4096,
          temperature: 0.7,
        },
      ];
    }
  }

  async updateContext(messages: Message[]): Promise<void> {
    try {
      await axios.post(
        `${this.baseUrl}/context`,
        { messages },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        }
      );
    } catch (error) {
      console.error('Error updating context:', error);
    }
  }

  async sendMessage(
    content: string,
    modelId: string,
    settings: ModelSettings
  ): Promise<MessageResponse> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/chat`,
        {
          content,
          modelId,
          settings,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error sending message:', error);
      return {
        content: 'Sorry, I encountered an error. Please try again.',
        sentiment: 'neutral',
        intent: 'error',
        entities: [],
        tokens: 0,
      };
    }
  }

  async generateSuggestions(content: string): Promise<string[]> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/suggestions`,
        { content },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error generating suggestions:', error);
      return [
        'Can you explain more about that?',
        'What do you mean by that?',
        'Could you provide an example?',
      ];
    }
  }
   async shareConversation(conversationId: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/conversations/${conversationId}/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to share conversation');
    }
  }
}
// Create and export an instance of AIService
export const aiService = new AIService(
  process.env.REACT_APP_API_URL || 'http://localhost:8000',
  process.env.REACT_APP_API_KEY || ''
); 