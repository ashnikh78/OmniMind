import { apiClient } from './apiClient';
import { WebSocketMessage } from '../types/api';

interface MLModel {
  id: string;
  name: string;
  type: 'llm' | 'classification' | 'regression' | 'clustering';
  status: 'ready' | 'training' | 'error';
  metrics: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
    latency?: number;
  };
  parameters: Record<string, any>;
  lastUpdated: string;
}

interface InferenceRequest {
  modelId: string;
  input: string | Record<string, any>;
  parameters?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stopSequences?: string[];
  };
  stream?: boolean;
}

interface InferenceResponse {
  output: string | Record<string, any>;
  metadata: {
    tokens: number;
    latency: number;
    model: string;
    timestamp: string;
  };
}

interface TrainingRequest {
  modelId: string;
  data: Record<string, any>[];
  parameters: {
    epochs: number;
    batchSize: number;
    learningRate: number;
    validationSplit: number;
  };
}

class MLService {
  private models: Map<string, MLModel> = new Map();
  private activeModel: MLModel | null = null;
  private inferenceQueue: Map<string, InferenceRequest> = new Map();
  private trainingJobs: Map<string, TrainingRequest> = new Map();

  // Model Management
  async getModels(): Promise<MLModel[]> {
    const response = await apiClient.get<MLModel[]>('/api/v1/ml/models');
    response.forEach(model => this.models.set(model.id, model));
    return response;
  }

  async getModel(id: string): Promise<MLModel> {
    const response = await apiClient.get<MLModel>(`/api/v1/ml/models/${id}`);
    this.models.set(id, response);
    return response;
  }

  async createModel(data: Partial<MLModel>): Promise<MLModel> {
    const response = await apiClient.post<MLModel>('/api/v1/ml/models', data);
    this.models.set(response.id, response);
    return response;
  }

  async updateModel(id: string, data: Partial<MLModel>): Promise<MLModel> {
    const response = await apiClient.put<MLModel>(`/api/v1/ml/models/${id}`, data);
    this.models.set(id, response);
    return response;
  }

  async deleteModel(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/ml/models/${id}`);
    this.models.delete(id);
  }

  // Inference
  async runInference(request: InferenceRequest): Promise<InferenceResponse> {
    const requestId = Math.random().toString(36).substring(2);
    this.inferenceQueue.set(requestId, request);

    try {
      const response = await apiClient.post<InferenceResponse>(
        `/api/v1/ml/inference/${request.modelId}`,
        request
      );
      return response;
    } finally {
      this.inferenceQueue.delete(requestId);
    }
  }

  async streamInference(
    request: InferenceRequest,
    onChunk: (chunk: string) => void,
    onComplete: (response: InferenceResponse) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    const requestId = Math.random().toString(36).substring(2);
    this.inferenceQueue.set(requestId, request);

    try {
      const response = await fetch(`${apiClient.baseURL}/api/v1/ml/inference/${request.modelId}/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(request),
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Stream not available');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const chunk = JSON.parse(line);
              onChunk(chunk.text);
            } catch (e) {
              console.error('Error parsing chunk:', e);
            }
          }
        }
      }

      onComplete({
        output: buffer,
        metadata: {
          tokens: 0,
          latency: 0,
          model: request.modelId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      onError(error as Error);
    } finally {
      this.inferenceQueue.delete(requestId);
    }
  }

  // Training
  async trainModel(request: TrainingRequest): Promise<void> {
    const jobId = Math.random().toString(36).substring(2);
    this.trainingJobs.set(jobId, request);

    try {
      await apiClient.post(`/api/v1/ml/train/${request.modelId}`, request);
    } finally {
      this.trainingJobs.delete(jobId);
    }
  }

  async getTrainingStatus(modelId: string): Promise<{
    status: 'idle' | 'training' | 'completed' | 'failed';
    progress: number;
    metrics: Record<string, number>;
  }> {
    return apiClient.get(`/api/v1/ml/train/${modelId}/status`);
  }

  // Model Evaluation
  async evaluateModel(
    modelId: string,
    testData: Record<string, any>[]
  ): Promise<{
    metrics: Record<string, number>;
    confusionMatrix?: number[][];
    classificationReport?: Record<string, any>;
  }> {
    return apiClient.post(`/api/v1/ml/evaluate/${modelId}`, { testData });
  }

  // Model Deployment
  async deployModel(modelId: string): Promise<{
    endpoint: string;
    status: 'deploying' | 'ready' | 'failed';
  }> {
    return apiClient.post(`/api/v1/ml/deploy/${modelId}`);
  }

  // Model Monitoring
  async getModelMetrics(modelId: string): Promise<{
    performance: Record<string, number>;
    usage: {
      requests: number;
      tokens: number;
      latency: number;
    };
    errors: {
      count: number;
      types: Record<string, number>;
    };
  }> {
    return apiClient.get(`/api/v1/ml/metrics/${modelId}`);
  }

  // Model Versioning
  async createModelVersion(
    modelId: string,
    version: string,
    data: Partial<MLModel>
  ): Promise<MLModel> {
    return apiClient.post(`/api/v1/ml/models/${modelId}/versions`, {
      version,
      ...data,
    });
  }

  async getModelVersions(modelId: string): Promise<MLModel[]> {
    return apiClient.get(`/api/v1/ml/models/${modelId}/versions`);
  }

  async rollbackModel(modelId: string, version: string): Promise<MLModel> {
    return apiClient.post(`/api/v1/ml/models/${modelId}/rollback`, { version });
  }
}

export const mlService = new MLService();
export default mlService; 