import React, { createContext, useContext, useState, useEffect } from 'react';
import { activityAPI } from '../services/api';
import { wsManager } from '../services/api';

const ActivityContext = createContext();

export function useActivity() {
  return useContext(ActivityContext);
}

export function ActivityProvider({ children }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    type: 'all',
    dateRange: '7d',
    user: 'all',
  });

  useEffect(() => {
    fetchActivities();
    setupWebSocket();
    return () => {
      wsManager.offMessage('activity', handleNewActivity);
    };
  }, [filters]);

  const setupWebSocket = () => {
    wsManager.onMessage('activity', handleNewActivity);
  };

  const handleNewActivity = (activity) => {
    setActivities((prev) => [activity, ...prev]);
  };

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const response = await activityAPI.getActivities(filters);
      setActivities(response);
    } catch (error) {
      setError('Failed to fetch activities');
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateFilters = (newFilters) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const getActivityStats = async () => {
    try {
      const response = await activityAPI.getActivityStats();
      return response;
    } catch (error) {
      console.error('Error fetching activity stats:', error);
      return null;
    }
  };

  const exportActivities = async (format = 'csv') => {
    try {
      const response = await activityAPI.exportActivities(filters, format);
      return response;
    } catch (error) {
      console.error('Error exporting activities:', error);
      throw error;
    }
  };

  const value = {
    activities,
    loading,
    error,
    filters,
    updateFilters,
    refreshActivities: fetchActivities,
    getActivityStats,
    exportActivities,
  };

  return (
    <ActivityContext.Provider value={value}>
      {children}
    </ActivityContext.Provider>
  );
} 