import axios from 'axios';
import { toast } from 'react-toastify';

export interface OllamaModel {
  id: string;
  name: string;
  description: string;
  parameters: {
    temperature: number;
    topP: number;
    topK: number;
    repetitionPenalty: number;
    contextWindow: number;
  };
  capabilities: string[];
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: {
    model?: string;
    tokens?: number;
    confidence?: number;
  };
}

export interface OllamaResponse {
  message?: {
    content: string;
    role: string;
  };
  done: boolean;
  model: string;
  created_at: string;
  total_duration: number;
  load_duration: number;
  prompt_eval_duration: number;
  eval_duration: number;
  eval_count: number;
  context: number[];
}

export interface OllamaSettings {
  temperature?: number;
  topP?: number;
  topK?: number;
  repetitionPenalty?: number;
  contextWindow?: number;
  numPredict?: number;
  stop?: string[];
  seed?: number;
  tfsZ?: number;
  typicalP?: number;
  repeatLastN?: number;
  repeatPenalty?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  mirostat?: number;
  mirostatEta?: number;
  mirostatTau?: number;
  numCtx?: number;
  numGpu?: number;
  numThread?: number;
  ropeFrequencyBase?: number;
  ropeFrequencyScale?: number;
  numGqa?: number;
  rmsNormEps?: number;
  ropeScalingType?: string;
  ropeScalingFactor?: number;
}

class OllamaService {
  private baseUrl: string;
  private defaultModel: string;
  private models: Map<string, OllamaModel>;

  constructor(baseUrl: string = 'http://localhost:11434', defaultModel: string = 'llama2') {
    this.baseUrl = baseUrl;
    this.defaultModel = defaultModel;
    this.models = new Map();
    this.initializeModels();
  }

  private async initializeModels() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`);
      const availableModels = response.data.models;
      
      for (const model of availableModels) {
        this.models.set(model.name, {
          id: model.name,
          name: model.name,
          description: model.description || '',
          parameters: {
            temperature: 0.7,
            topP: 0.9,
            topK: 40,
            repetitionPenalty: 1.1,
            contextWindow: 4096,
          },
          capabilities: this.determineModelCapabilities(model),
        });
      }
    } catch (error) {
      console.error('Error initializing models:', error);
      // Initialize with default models if API call fails
      this.initializeDefaultModels();
    }
  }

  private initializeDefaultModels() {
    const defaultModels = [
      {
        id: 'llama2',
        name: 'Llama 2',
        description: 'Meta\'s Llama 2 model',
        parameters: {
          temperature: 0.7,
          topP: 0.9,
          topK: 40,
          repetitionPenalty: 1.1,
          contextWindow: 4096,
        },
        capabilities: ['chat', 'completion', 'embedding'],
      },
      {
        id: 'mistral',
        name: 'Mistral',
        description: 'Mistral AI\'s model',
        parameters: {
          temperature: 0.7,
          topP: 0.9,
          topK: 40,
          repetitionPenalty: 1.1,
          contextWindow: 8192,
        },
        capabilities: ['chat', 'completion', 'embedding', 'code'],
      },
    ];

    defaultModels.forEach(model => this.models.set(model.id, model));
  }

  private determineModelCapabilities(model: any): string[] {
    const capabilities = ['chat', 'completion'];
    
    // Add capabilities based on model name or properties
    if (model.name.toLowerCase().includes('code')) {
      capabilities.push('code');
    }
    if (model.name.toLowerCase().includes('embed')) {
      capabilities.push('embedding');
    }
    if (model.name.toLowerCase().includes('instruct')) {
      capabilities.push('instruction');
    }
    
    return capabilities;
  }

  async chat(
    messages: ChatMessage[],
    settings: OllamaSettings = {},
    model: string = this.defaultModel
  ): Promise<AsyncGenerator<OllamaResponse>> {
    const modelSettings = this.models.get(model)?.parameters || {};
    const mergedSettings = { ...modelSettings, ...settings };

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/chat`,
        {
          model,
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
          options: mergedSettings,
          stream: true,
        },
        {
          responseType: 'stream',
        }
      );

      return this.handleStreamResponse(response.data);
    } catch (error) {
      console.error('Error in chat:', error);
      throw new Error('Failed to communicate with Ollama');
    }
  }

  private async *handleStreamResponse(stream: any): AsyncGenerator<OllamaResponse> {
    for await (const chunk of stream) {
      try {
        const response = JSON.parse(chunk.toString());
        yield response;
      } catch (error) {
        console.error('Error parsing stream chunk:', error);
      }
    }
  }

  async generateEmbeddings(text: string, model: string = this.defaultModel): Promise<number[]> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/embeddings`, {
        model,
        prompt: text,
      });
      return response.data.embedding;
    } catch (error) {
      console.error('Error generating embeddings:', error);
      throw new Error('Failed to generate embeddings');
    }
  }

  async summarize(text: string, model: string = this.defaultModel): Promise<string> {
    try {
      const response = await this.chat(
        [
          {
            role: 'system',
            content: 'You are a helpful assistant that summarizes text. Provide concise and informative summaries.',
            timestamp: Date.now(),
          },
          {
            role: 'user',
            content: `Please summarize the following text:\n\n${text}`,
            timestamp: Date.now(),
          },
        ],
        { temperature: 0.3 },
        model
      );

      let summary = '';
      for await (const chunk of response) {
        if (chunk.message?.content) {
          summary += chunk.message.content;
        }
      }
      return summary;
    } catch (error) {
      console.error('Error generating summary:', error);
      throw new Error('Failed to generate summary');
    }
  }

  async extractGoals(text: string, model: string = this.defaultModel): Promise<string[]> {
    try {
      const response = await this.chat(
        [
          {
            role: 'system',
            content: 'You are a helpful assistant that extracts goals and objectives from text. Return a list of goals.',
            timestamp: Date.now(),
          },
          {
            role: 'user',
            content: `Please extract the goals from the following text:\n\n${text}`,
            timestamp: Date.now(),
          },
        ],
        { temperature: 0.3 },
        model
      );

      let goalsText = '';
      for await (const chunk of response) {
        if (chunk.message?.content) {
          goalsText += chunk.message.content;
        }
      }
      return goalsText.split('\n').filter(goal => goal.trim());
    } catch (error) {
      console.error('Error extracting goals:', error);
      throw new Error('Failed to extract goals');
    }
  }

  async extractFacts(text: string, model: string = this.defaultModel): Promise<Array<{ id: string; content: string; importance: number }>> {
    try {
      const response = await this.chat(
        [
          {
            role: 'system',
            content: 'You are a helpful assistant that extracts facts from text. Return a list of facts with their importance scores.',
            timestamp: Date.now(),
          },
          {
            role: 'user',
            content: `Please extract the facts from the following text:\n\n${text}`,
            timestamp: Date.now(),
          },
        ],
        { temperature: 0.3 },
        model
      );

      let factsText = '';
      for await (const chunk of response) {
        if (chunk.message?.content) {
          factsText += chunk.message.content;
        }
      }
      
      return factsText.split('\n')
        .filter(fact => fact.trim())
        .map(fact => ({
          id: Math.random().toString(36).substr(2, 9),
          content: fact,
          importance: this.calculateFactImportance(fact),
        }));
    } catch (error) {
      console.error('Error extracting facts:', error);
      throw new Error('Failed to extract facts');
    }
  }

  private calculateFactImportance(fact: string): number {
    // Simple importance calculation based on fact length and content
    const length = fact.length;
    const hasNumbers = /\d/.test(fact);
    const hasProperNouns = /[A-Z][a-z]+/.test(fact);
    
    let importance = 0.5; // Base importance
    
    // Adjust based on length
    if (length > 100) importance += 0.2;
    else if (length > 50) importance += 0.1;
    
    // Adjust based on content
    if (hasNumbers) importance += 0.1;
    if (hasProperNouns) importance += 0.1;
    
    return Math.min(importance, 1.0);
  }

  async extractRelationships(text: string, model: string = this.defaultModel): Promise<Array<{ from: string; to: string; type: string }>> {
    try {
      const response = await this.chat(
        [
          {
            role: 'system',
            content: 'You are a helpful assistant that extracts relationships between entities from text. Return a list of relationships.',
            timestamp: Date.now(),
          },
          {
            role: 'user',
            content: `Please extract the relationships from the following text:\n\n${text}`,
            timestamp: Date.now(),
          },
        ],
        { temperature: 0.3 },
        model
      );

      let relationshipsText = '';
      for await (const chunk of response) {
        if (chunk.message?.content) {
          relationshipsText += chunk.message.content;
        }
      }
      
      return relationshipsText.split('\n')
        .filter(rel => rel.trim())
        .map(rel => {
          const [from, type, to] = rel.split(' - ');
          return { from, type, to };
        });
    } catch (error) {
      console.error('Error extracting relationships:', error);
      throw new Error('Failed to extract relationships');
    }
  }

  async extractPreferences(text: string, model: string = this.defaultModel): Promise<Array<{ key: string; value: any }>> {
    try {
      const response = await this.chat(
        [
          {
            role: 'system',
            content: 'You are a helpful assistant that extracts user preferences from text. Return a list of preferences.',
            timestamp: Date.now(),
          },
          {
            role: 'user',
            content: `Please extract the preferences from the following text:\n\n${text}`,
            timestamp: Date.now(),
          },
        ],
        { temperature: 0.3 },
        model
      );

      let preferencesText = '';
      for await (const chunk of response) {
        if (chunk.message?.content) {
          preferencesText += chunk.message.content;
        }
      }
      
      return preferencesText.split('\n')
        .filter(pref => pref.trim())
        .map(pref => {
          const [key, value] = pref.split(': ');
          return { key, value };
        });
    } catch (error) {
      console.error('Error extracting preferences:', error);
      throw new Error('Failed to extract preferences');
    }
  }

  async filterContent(text: string, model: string = this.defaultModel): Promise<string> {
    try {
      const response = await this.chat(
        [
          {
            role: 'system',
            content: 'You are a helpful assistant that filters and cleans text content. Remove any inappropriate or irrelevant content.',
            timestamp: Date.now(),
          },
          {
            role: 'user',
            content: `Please filter the following text:\n\n${text}`,
            timestamp: Date.now(),
          },
        ],
        { temperature: 0.3 },
        model
      );

      let filteredText = '';
      for await (const chunk of response) {
        if (chunk.message?.content) {
          filteredText += chunk.message.content;
        }
      }
      return filteredText;
    } catch (error) {
      console.error('Error filtering content:', error);
      throw new Error('Failed to filter content');
    }
  }

  async applyStyleConsistency(text: string, model: string = this.defaultModel): Promise<string> {
    try {
      const response = await this.chat(
        [
          {
            role: 'system',
            content: 'You are a helpful assistant that ensures consistent writing style. Maintain a professional and clear tone.',
            timestamp: Date.now(),
          },
          {
            role: 'user',
            content: `Please ensure consistent style in the following text:\n\n${text}`,
            timestamp: Date.now(),
          },
        ],
        { temperature: 0.3 },
        model
      );

      let styledText = '';
      for await (const chunk of response) {
        if (chunk.message?.content) {
          styledText += chunk.message.content;
        }
      }
      return styledText;
    } catch (error) {
      console.error('Error applying style consistency:', error);
      throw new Error('Failed to apply style consistency');
    }
  }

  async formatCodeBlocks(text: string, model: string = this.defaultModel): Promise<string> {
    try {
      const response = await this.chat(
        [
          {
            role: 'system',
            content: 'You are a helpful assistant that formats code blocks in text. Ensure proper syntax highlighting and formatting.',
            timestamp: Date.now(),
          },
          {
            role: 'user',
            content: `Please format the code blocks in the following text:\n\n${text}`,
            timestamp: Date.now(),
          },
        ],
        { temperature: 0.3 },
        model
      );

      let formattedText = '';
      for await (const chunk of response) {
        if (chunk.message?.content) {
          formattedText += chunk.message.content;
        }
      }
      return formattedText;
    } catch (error) {
      console.error('Error formatting code blocks:', error);
      throw new Error('Failed to format code blocks');
    }
  }

  async formatListsAndTables(text: string, model: string = this.defaultModel): Promise<string> {
    try {
      const response = await this.chat(
        [
          {
            role: 'system',
            content: 'You are a helpful assistant that formats lists and tables in text. Ensure proper markdown formatting.',
            timestamp: Date.now(),
          },
          {
            role: 'user',
            content: `Please format the lists and tables in the following text:\n\n${text}`,
            timestamp: Date.now(),
          },
        ],
        { temperature: 0.3 },
        model
      );

      let formattedText = '';
      for await (const chunk of response) {
        if (chunk.message?.content) {
          formattedText += chunk.message.content;
        }
      }
      return formattedText;
    } catch (error) {
      console.error('Error formatting lists and tables:', error);
      throw new Error('Failed to format lists and tables');
    }
  }

  async applyConsistentStyling(text: string, model: string = this.defaultModel): Promise<string> {
    try {
      const response = await this.chat(
        [
          {
            role: 'system',
            content: 'You are a helpful assistant that applies consistent styling to text. Ensure proper formatting and presentation.',
            timestamp: Date.now(),
          },
          {
            role: 'user',
            content: `Please apply consistent styling to the following text:\n\n${text}`,
            timestamp: Date.now(),
          },
        ],
        { temperature: 0.3 },
        model
      );

      let styledText = '';
      for await (const chunk of response) {
        if (chunk.message?.content) {
          styledText += chunk.message.content;
        }
      }
      return styledText;
    } catch (error) {
      console.error('Error applying consistent styling:', error);
      throw new Error('Failed to apply consistent styling');
    }
  }
}

export const ollamaService = new OllamaService(); 