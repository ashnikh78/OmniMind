import React, { createContext, useContext, useState, useEffect } from 'react';
import { notificationAPI } from '../services/api';
import { wsManager } from '../services/api';
import { toast } from 'react-toastify';

// Debug flag - set to true to enable detailed logging
const DEBUG = true;

const debugLog = (...args) => {
  if (DEBUG) {
    console.log('[NotificationContext]', ...args);
  }
};

const debugError = (...args) => {
  if (DEBUG) {
    console.error('[NotificationContext]', ...args);
  }
};

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    debugError('useNotifications must be used within a NotificationProvider');
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [preferences, setPreferences] = useState({
    email: true,
    push: true,
    inApp: true,
    sound: true,
  });

  useEffect(() => {
    debugLog('NotificationProvider mounted');
    fetchNotifications();
    setupWebSocket();
    return () => {
      debugLog('NotificationProvider unmounting');
      wsManager.offMessage('notification', handleNewNotification);
    };
  }, []);

  const setupWebSocket = () => {
    debugLog('Setting up WebSocket connection');
    try {
      wsManager.onMessage('notification', handleNewNotification);
      debugLog('WebSocket connection setup successful');
    } catch (error) {
      debugError('Error setting up WebSocket connection:', error);
      toast.error('Failed to setup real-time notifications');
    }
  };

  const handleNewNotification = (notification) => {
    debugLog('Received new notification:', notification);
    try {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);
      
      if (preferences.inApp) {
        toast.info(notification.message, {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      }

      if (preferences.sound) {
        const audio = new Audio('/notification-sound.mp3');
        audio.play().catch(error => debugError('Error playing notification sound:', error));
      }
    } catch (error) {
      debugError('Error handling new notification:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      debugLog('Fetching notifications...');
      setLoading(true);
      setError(null);
      const response = await notificationAPI.getNotifications();
      debugLog('Notifications response:', response);
      
      if (response?.data) {
        // Handle both array and object response formats
        const notifications = Array.isArray(response.data) 
          ? response.data 
          : response.data.notifications || [];
        
        setNotifications(notifications);
        setUnreadCount(notifications.filter(n => !n.read).length);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      debugError('Error fetching notifications:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to fetch notifications';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const refreshNotifications = async () => {
    try {
      debugLog('Refreshing notifications...');
      setLoading(true);
      setError(null);
      await fetchNotifications();
      toast.success('Notifications refreshed');
    } catch (err) {
      debugError('Error refreshing notifications:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to refresh notifications';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      debugLog('Marking notification as read:', id);
      await notificationAPI.markAsRead(id);
      setNotifications(notifications.map(notification =>
        notification.id === id ? { ...notification, read: true } : notification
      ));
      setUnreadCount((prev) => Math.max(0, prev - 1));
      toast.success('Notification marked as read');
    } catch (err) {
      debugError('Error marking notification as read:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to mark notification as read';
      toast.error(errorMessage);
    }
  };

  const markAllAsRead = async () => {
    try {
      debugLog('Marking all notifications as read');
      await notificationAPI.markAllAsRead();
      setNotifications(notifications.map(notification => ({ ...notification, read: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (err) {
      debugError('Error marking all notifications as read:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to mark all notifications as read';
      toast.error(errorMessage);
    }
  };

  const deleteNotification = async (id) => {
    try {
      debugLog('Deleting notification:', id);
      await notificationAPI.deleteNotification(id);
      setNotifications(notifications.filter(notification => notification.id !== id));
      setUnreadCount((prev) =>
        notifications.find((n) => n.id === id)?.read
          ? prev
          : Math.max(0, prev - 1)
      );
      toast.success('Notification deleted');
    } catch (err) {
      debugError('Error deleting notification:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to delete notification';
      toast.error(errorMessage);
    }
  };

  const updatePreferences = async (newPreferences) => {
    try {
      debugLog('Updating notification preferences:', newPreferences);
      await notificationAPI.updatePreferences(newPreferences);
      setPreferences(newPreferences);
      toast.success('Notification preferences updated');
    } catch (err) {
      debugError('Error updating notification preferences:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to update notification preferences';
      toast.error(errorMessage);
    }
  };

  const value = {
    notifications,
    unreadCount,
    loading,
    error,
    preferences,
    fetchNotifications,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    updatePreferences,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}; 