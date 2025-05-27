import React, { createContext, useContext, useState, useEffect } from 'react';
import { mlServiceAPI, ollamaAPI } from '../services/api';
import { wsManager } from '../services/api';
import { toast } from 'react-toastify';

// Debug flag - set to true to enable detailed logging
const DEBUG = true;

const debugLog = (...args) => {
  if (DEBUG) {
    console.log('[MLServiceContext]', ...args);
  }
};

const debugError = (...args) => {
  if (DEBUG) {
    console.error('[MLServiceContext]', ...args);
  }
};

const MLServiceContext = createContext();

export function useMLService() {
  const context = useContext(MLServiceContext);
  if (!context) {
    debugError('useMLService must be used within an MLServiceProvider');
    throw new Error('useMLService must be used within an MLServiceProvider');
  }
  return context;
}

export function MLServiceProvider({ children }) {
  const [models, setModels] = useState([]);
  const [activeModel, setActiveModel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inferenceResults, setInferenceResults] = useState([]);
  const [modelMetrics, setModelMetrics] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [debugInfo, setDebugInfo] = useState({
    lastError: null,
    lastAction: null,
    componentState: null,
    apiCalls: [],
  });

  // Update debug info whenever relevant state changes
  useEffect(() => {
    if (DEBUG) {
      setDebugInfo(prev => ({
        ...prev,
        componentState: {
          modelsCount: models.length,
          hasActiveModel: !!activeModel,
          isLoading: loading,
          hasError: !!error,
          isProcessing,
          inferenceResultsCount: inferenceResults.length,
          hasMetrics: !!modelMetrics,
        }
      }));
    }
  }, [models, activeModel, loading, error, isProcessing, inferenceResults, modelMetrics]);

  useEffect(() => {
    debugLog('MLServiceProvider mounted');
    setupWebSocket();
    return () => {
      debugLog('MLServiceProvider unmounting');
      wsManager.offMessage('ml_inference', handleInferenceResult);
      wsManager.offMessage('ml_metrics', handleModelMetrics);
    };
  }, []);

  const setupWebSocket = () => {
    debugLog('Setting up WebSocket connections');
    wsManager.onMessage('ml_inference', handleInferenceResult);
    wsManager.onMessage('ml_metrics', handleModelMetrics);
  };

  const handleInferenceResult = (result) => {
    debugLog('Received inference result:', result);
    setInferenceResults((prev) => [result, ...prev]);
    setIsProcessing(false);
  };

  const handleModelMetrics = (metrics) => {
    debugLog('Received model metrics:', metrics);
    setModelMetrics(metrics);
  };

  const fetchModels = async (retryCount = 0) => {
    try {
      debugLog('Fetching Ollama models...');
      setLoading(true);
      setError(null);
      const response = await ollamaAPI.getModels();
      debugLog('Ollama models response:', response);
      
      // Map Ollama models to our format
      const mappedModels = response.data.map(model => ({
        id: model.name,
        name: model.name,
        type: model.details?.family || 'unknown',
        status: 'ready',
        capabilities: determineModelCapabilities(model),
        parameters: {
          temperature: 0.7,
          maxTokens: 2048,
          topP: 0.9,
          frequencyPenalty: 0.0,
          presencePenalty: 0.0,
        },
        details: model.details || {},
      }));
      
      setModels(mappedModels);
      if (mappedModels.length > 0 && !activeModel) {
        setActiveModel(mappedModels[0]);
      }
      
      // Update debug info
      setDebugInfo(prev => ({
        ...prev,
        lastAction: 'fetchModels',
        componentState: {
          ...prev.componentState,
          modelsCount: mappedModels.length,
          hasActiveModel: !!activeModel
        },
        apiCalls: [
          ...prev.apiCalls,
          {
            endpoint: '/api/ollama/models',
            status: 'success',
            timestamp: new Date().toISOString()
          }
        ]
      }));
    } catch (error) {
      console.error('Error fetching Ollama models:', error);
      
      // Handle rate limiting with retry
      if (error.response?.status === 429 && retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
        debugLog(`Rate limited, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchModels(retryCount + 1);
      }
      
      setError('Failed to fetch Ollama models');
      // Only show toast for critical errors
      if (error.response?.status === 401 || error.response?.status === 403) {
        toast.error('Authentication error. Please log in again.');
      } else if (error.response?.status === 429) {
        toast.error('Too many requests. Please try again in a moment.');
      } else if (error.response?.status >= 500) {
        toast.error('Server error. Please try again later.');
      }
      
      // Update debug info
      setDebugInfo(prev => ({
        ...prev,
        lastAction: 'fetchModels',
        error: error.message,
        apiCalls: [
          ...prev.apiCalls,
          {
            endpoint: '/api/ollama/models',
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
          }
        ]
      }));
    } finally {
      setLoading(false);
    }
  };

  const determineModelCapabilities = (model) => {
    const capabilities = ['chat', 'completion'];
    const name = model.name.toLowerCase();
    
    if (name.includes('code') || name.includes('coder')) {
      capabilities.push('code');
    }
    if (name.includes('mistral')) {
      capabilities.push('embedding');
    }
    if (name.includes('llama')) {
      capabilities.push('embedding');
    }
    
    return capabilities;
  };

  const runInference = async (input) => {
    if (!activeModel) {
      const error = new Error('No model selected');
      setError(error.message);
      return;
    }

    try {
      setIsProcessing(true);
      const response = await ollamaAPI.chat({
        model: activeModel.id,
        messages: [
          {
            role: 'user',
            content: input
          }
        ],
        stream: false,
        options: {
          temperature: activeModel.parameters.temperature,
          top_p: activeModel.parameters.topP,
          max_tokens: activeModel.parameters.maxTokens,
        }
      });

      setInferenceResults(prev => [...prev, {
        output: response.data.message.content,
        timestamp: new Date().toISOString(),
        metadata: {
          model: activeModel.id,
          tokens: response.data.message.tokens || 0,
          latency: response.data.message.latency || 0
        },
      }]);

      return response.data;
    } catch (err) {
      debugError('Inference error:', err);
      setError('Failed to run inference');
      // Only show toast for critical errors
      if (err.response?.status === 401 || err.response?.status === 403) {
        toast.error('Authentication error. Please log in again.');
      } else if (err.response?.status >= 500) {
        toast.error('Server error. Please try again later.');
      }
      
      setDebugInfo(prev => ({
        ...prev,
        lastError: {
          action: 'runInference',
          error: err.message,
          timestamp: new Date().toISOString(),
        },
        apiCalls: [...prev.apiCalls, {
          endpoint: '/api/v1/ollama/chat',
          status: 'error',
          error: err.message,
          timestamp: new Date().toISOString(),
        }],
      }));
      throw err;
    } finally {
      setIsProcessing(false);
    }
  };

  const getModelMetrics = async (modelId) => {
    debugLog('Getting model metrics:', modelId);
    if (!modelId) {
      debugLog('No model selected, skipping metrics fetch');
      return null;
    }
    try {
      setError(null);
      const response = await mlServiceAPI.getModelMetrics(modelId);
      debugLog('Metrics response:', response);
      if (response) {
        setModelMetrics(response);
        return response;
      }
      return null;
    } catch (error) {
      debugError('Error fetching model metrics:', error);
      // Don't set error state or show toast for metrics errors
      return null;
    }
  };

  const updateModelSettings = async (modelId, settings) => {
    debugLog('Updating model settings:', { modelId, settings });
    if (!modelId) {
      const error = new Error('No model selected');
      debugError('Settings update error:', error);
      throw error;
    }
    try {
      setError(null);
      const updatedModels = models.map(model => 
        model.id === modelId 
          ? { ...model, parameters: { ...model.parameters, ...settings } }
          : model
      );
      setModels(updatedModels);
      
      if (activeModel?.id === modelId) {
        setActiveModel(prev => ({ ...prev, parameters: { ...prev.parameters, ...settings } }));
      }
      
      await fetchModels();
      toast.success('Model settings updated');
      return updatedModels;
    } catch (error) {
      debugError('Error updating model settings:', error);
      setError('Failed to update model settings');
      setDebugInfo(prev => ({
        ...prev,
        lastError: {
          action: 'updateModelSettings',
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        apiCalls: [...prev.apiCalls, {
          endpoint: '/api/v1/ml/models/update',
          status: 'error',
          error: error.message,
          timestamp: new Date().toISOString(),
        }],
      }));
      toast.error('Failed to update model settings');
      throw error;
    }
  };

  const pullModel = async (modelName) => {
    try {
      await ollamaAPI.pullModel(modelName);
      // Show success toast only when model pull starts
      toast.success(`Pulling model ${modelName}...`, {
        autoClose: 3000,
        position: "bottom-right"
      });
      await fetchModels();
    } catch (err) {
      console.error('Error pulling model:', err);
      // Only show toast for critical errors
      if (err.response?.status === 401 || err.response?.status === 403) {
        toast.error('Authentication error. Please log in again.');
      } else if (err.response?.status >= 500) {
        toast.error('Server error. Please try again later.');
      }
      throw err;
    }
  };

  const deleteModel = async (modelId) => {
    try {
      await ollamaAPI.deleteModel(modelId);
      // Show success toast only when model is deleted
      toast.success(`Model ${modelId} deleted`, {
        autoClose: 3000,
        position: "bottom-right"
      });
      await fetchModels();
    } catch (err) {
      console.error('Error deleting model:', err);
      // Only show toast for critical errors
      if (err.response?.status === 401 || err.response?.status === 403) {
        toast.error('Authentication error. Please log in again.');
      } else if (err.response?.status >= 500) {
        toast.error('Server error. Please try again later.');
      }
      throw err;
    }
  };

  const value = {
    models,
    activeModel,
    loading,
    error,
    inferenceResults,
    modelMetrics,
    isProcessing,
    setActiveModel,
    runInference,
    getModelMetrics,
    updateModelSettings,
    pullModel,
    deleteModel,
    refreshModels: fetchModels,
    debugInfo: DEBUG ? debugInfo : null,
  };

  return (
    <MLServiceContext.Provider value={value}>
      {children}
    </MLServiceContext.Provider>
  );
} 