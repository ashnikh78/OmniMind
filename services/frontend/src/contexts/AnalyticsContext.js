import React, { createContext, useContext, useState, useEffect } from 'react';
import { analyticsAPI } from '../services/api';
import { wsManager } from '../services/api';

const AnalyticsContext = createContext();

export function useAnalytics() {
  return useContext(AnalyticsContext);
}

export function AnalyticsProvider({ children }) {
  const [metrics, setMetrics] = useState({
    userActivity: [],
    systemPerformance: {},
    usageStats: {},
    errorRates: {},
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('24h');
  const [refreshInterval, setRefreshInterval] = useState(300000); // 5 minutes

  useEffect(() => {
    fetchAnalytics();
    setupWebSocket();
    const interval = setInterval(fetchAnalytics, refreshInterval);
    return () => {
      clearInterval(interval);
      wsManager.offMessage('analytics_update', handleAnalyticsUpdate);
    };
  }, [timeRange, refreshInterval]);

  const setupWebSocket = () => {
    wsManager.onMessage('analytics_update', handleAnalyticsUpdate);
  };

  const handleAnalyticsUpdate = (data) => {
    setMetrics((prev) => ({
      ...prev,
      ...data,
    }));
  };

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await analyticsAPI.getAnalytics(timeRange);
      setMetrics(response);
    } catch (error) {
      setError('Failed to fetch analytics data');
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUserActivity = async (filters = {}) => {
    try {
      const response = await analyticsAPI.getUserActivity(filters);
      setMetrics((prev) => ({
        ...prev,
        userActivity: response,
      }));
      return response;
    } catch (error) {
      console.error('Error fetching user activity:', error);
      throw error;
    }
  };

  const getSystemPerformance = async (filters = {}) => {
    try {
      const response = await analyticsAPI.getSystemPerformance(filters);
      setMetrics((prev) => ({
        ...prev,
        systemPerformance: response,
      }));
      return response;
    } catch (error) {
      console.error('Error fetching system performance:', error);
      throw error;
    }
  };

  const getUsageStats = async (filters = {}) => {
    try {
      const response = await analyticsAPI.getUsageStats(filters);
      setMetrics((prev) => ({
        ...prev,
        usageStats: response,
      }));
      return response;
    } catch (error) {
      console.error('Error fetching usage stats:', error);
      throw error;
    }
  };

  const getErrorRates = async (filters = {}) => {
    try {
      const response = await analyticsAPI.getErrorRates(filters);
      setMetrics((prev) => ({
        ...prev,
        errorRates: response,
      }));
      return response;
    } catch (error) {
      console.error('Error fetching error rates:', error);
      throw error;
    }
  };

  const exportAnalytics = async (format = 'csv', filters = {}) => {
    try {
      return await analyticsAPI.exportAnalytics(format, filters);
    } catch (error) {
      console.error('Error exporting analytics:', error);
      throw error;
    }
  };

  const value = {
    metrics,
    loading,
    error,
    timeRange,
    refreshInterval,
    setTimeRange,
    setRefreshInterval,
    getUserActivity,
    getSystemPerformance,
    getUsageStats,
    getErrorRates,
    exportAnalytics,
    refreshAnalytics: fetchAnalytics,
  };

  return (
    <AnalyticsContext.Provider value={value}>
      {children}
    </AnalyticsContext.Provider>
  );
} 