import React, { createContext, useContext, useState, useEffect } from 'react';
import { activityAPI } from '../services/api';
import { wsManager } from '../services/api';
import { toast } from 'react-toastify';

// Debug flag - set to true to enable detailed logging
const DEBUG = true;

const debugLog = (...args) => {
  if (DEBUG) {
    console.log('[ActivityContext]', ...args);
  }
};

const debugError = (...args) => {
  if (DEBUG) {
    console.error('[ActivityContext]', ...args);
  }
};

const ActivityContext = createContext();

export function useActivity() {
  const context = useContext(ActivityContext);
  if (!context) {
    debugError('useActivity must be used within an ActivityProvider');
    throw new Error('useActivity must be used within an ActivityProvider');
  }
  return context;
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
  const [stats, setStats] = useState({
    totalActivities: 0,
    messageActivities: 0,
    userActivities: 0,
    securityActivities: 0,
  });

  useEffect(() => {
    debugLog('ActivityProvider mounted');
    fetchActivities();
    setupWebSocket();
    return () => {
      debugLog('ActivityProvider unmounting');
      wsManager.offMessage('activity', handleNewActivity);
    };
  }, [filters]);

  const setupWebSocket = () => {
    debugLog('Setting up WebSocket connection');
    wsManager.onMessage('activity', handleNewActivity);
  };

  const handleNewActivity = (activity) => {
    debugLog('Received new activity:', activity);
    setActivities((prev) => [activity, ...prev]);
    updateStats(activity);
  };

  const updateStats = (activity) => {
    setStats((prev) => {
      const newStats = { ...prev };
      newStats.totalActivities += 1;
      switch (activity.type) {
        case 'message':
          newStats.messageActivities += 1;
          break;
        case 'user':
          newStats.userActivities += 1;
          break;
        case 'security':
          newStats.securityActivities += 1;
          break;
      }
      return newStats;
    });
  };

  const fetchActivities = async () => {
    try {
      debugLog('Fetching activities...');
      setLoading(true);
      setError(null);
      const response = await activityAPI.getActivities(filters);
      debugLog('Activities response:', response);
      
      // Handle the response format correctly
      const activitiesData = response.data?.activities || [];
      if (!Array.isArray(activitiesData)) {
        throw new Error('Invalid response format: activities data is not an array');
      }
      
      setActivities(activitiesData);
      
      // Calculate initial stats
      const initialStats = {
        totalActivities: activitiesData.length,
        messageActivities: activitiesData.filter(a => a.type === 'message').length,
        userActivities: activitiesData.filter(a => a.type === 'user').length,
        securityActivities: activitiesData.filter(a => a.type === 'security').length,
      };
      setStats(initialStats);
      
    } catch (err) {
      debugError('Error fetching activities:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to fetch activities';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const updateFilters = (newFilters) => {
    debugLog('Updating filters:', newFilters);
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const getActivityStats = async () => {
    try {
      debugLog('Fetching activity stats...');
      const response = await activityAPI.getActivityStats();
      debugLog('Activity stats response:', response);
      return response.data || stats;
    } catch (err) {
      debugError('Error fetching activity stats:', err);
      return stats;
    }
  };

  const exportActivities = async (format = 'csv') => {
    try {
      debugLog('Exporting activities...');
      const response = await activityAPI.exportActivities(filters, format);
      debugLog('Export response:', response);
      return response.data;
    } catch (err) {
      debugError('Error exporting activities:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to export activities';
      toast.error(errorMessage);
      throw err;
    }
  };

  const value = {
    activities,
    loading,
    error,
    filters,
    stats,
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