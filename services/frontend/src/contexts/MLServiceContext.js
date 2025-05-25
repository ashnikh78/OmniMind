import React, { createContext, useContext, useState, useEffect } from 'react';
import { mlServiceAPI } from '../services/api';
import { wsManager } from '../services/api';

const MLServiceContext = createContext();

export function useMLService() {
  return useContext(MLServiceContext);
}

export function MLServiceProvider({ children }) {
  const [models, setModels] = useState([]);
  const [activeModel, setActiveModel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inferenceResults, setInferenceResults] = useState([]);
  const [modelMetrics, setModelMetrics] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchModels();
    setupWebSocket();
    return () => {
      wsManager.offMessage('ml_inference', handleInferenceResult);
      wsManager.offMessage('ml_metrics', handleModelMetrics);
    };
  }, []);

  const setupWebSocket = () => {
    wsManager.onMessage('ml_inference', handleInferenceResult);
    wsManager.onMessage('ml_metrics', handleModelMetrics);
  };

  const handleInferenceResult = (result) => {
    setInferenceResults((prev) => [result, ...prev]);
    setIsProcessing(false);
  };

  const handleModelMetrics = (metrics) => {
    setModelMetrics(metrics);
  };

  const fetchModels = async () => {
    try {
      setLoading(true);
      const response = await mlServiceAPI.getModels();
      setModels(response);
      if (response.length > 0) {
        setActiveModel(response[0]);
      }
    } catch (error) {
      setError('Failed to fetch models');
      console.error('Error fetching models:', error);
    } finally {
      setLoading(false);
    }
  };

  const runInference = async (input, modelId = activeModel?.id) => {
    try {
      setIsProcessing(true);
      await mlServiceAPI.runInference(input, modelId);
    } catch (error) {
      setError('Failed to run inference');
      console.error('Error running inference:', error);
      setIsProcessing(false);
    }
  };

  const getModelMetrics = async (modelId = activeModel?.id) => {
    try {
      const response = await mlServiceAPI.getModelMetrics(modelId);
      setModelMetrics(response);
      return response;
    } catch (error) {
      console.error('Error fetching model metrics:', error);
      return null;
    }
  };

  const updateModelSettings = async (modelId, settings) => {
    try {
      await mlServiceAPI.updateModelSettings(modelId, settings);
      await fetchModels(); // Refresh models to get updated settings
    } catch (error) {
      console.error('Error updating model settings:', error);
    }
  };

  const trainModel = async (modelId, trainingData) => {
    try {
      setIsProcessing(true);
      await mlServiceAPI.trainModel(modelId, trainingData);
      await fetchModels(); // Refresh models after training
    } catch (error) {
      setError('Failed to train model');
      console.error('Error training model:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const deployModel = async (modelId) => {
    try {
      await mlServiceAPI.deployModel(modelId);
      await fetchModels(); // Refresh models after deployment
    } catch (error) {
      setError('Failed to deploy model');
      console.error('Error deploying model:', error);
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
    trainModel,
    deployModel,
    refreshModels: fetchModels,
  };

  return (
    <MLServiceContext.Provider value={value}>
      {children}
    </MLServiceContext.Provider>
  );
} 