import React, { createContext, useContext, useState, useEffect } from 'react';
import { notificationsAPI } from '../services/api';
import { wsManager } from '../services/api';
import { toast } from 'react-toastify';

const NotificationContext = createContext();

export function useNotifications() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }) {
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
    fetchNotifications();
    fetchPreferences();
    setupWebSocket();
    return () => {
      wsManager.offMessage('notification', handleNewNotification);
    };
  }, []);

  const setupWebSocket = () => {
    wsManager.onMessage('notification', handleNewNotification);
  };

  const handleNewNotification = (notification) => {
    setNotifications((prev) => [notification, ...prev]);
    setUnreadCount((prev) => prev + 1);
    
    // Show toast notification
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

    // Play sound if enabled
    if (preferences.sound) {
      const audio = new Audio('/notification-sound.mp3');
      audio.play().catch(error => console.error('Error playing notification sound:', error));
    }
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await notificationsAPI.getNotifications();
      setNotifications(response);
      setUnreadCount(response.filter(n => !n.read).length);
    } catch (error) {
      setError('Failed to fetch notifications');
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPreferences = async () => {
    try {
      const response = await notificationsAPI.getPreferences();
      setPreferences(response);
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await notificationsAPI.markAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await Promise.all(
        notifications
          .filter((n) => !n.read)
          .map((n) => notificationsAPI.markAsRead(n.id))
      );
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await notificationsAPI.deleteNotification(notificationId);
      setNotifications((prev) =>
        prev.filter((n) => n.id !== notificationId)
      );
      setUnreadCount((prev) =>
        notifications.find((n) => n.id === notificationId)?.read
          ? prev
          : Math.max(0, prev - 1)
      );
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const updatePreferences = async (newPreferences) => {
    try {
      await notificationsAPI.updatePreferences(newPreferences);
      setPreferences(newPreferences);
    } catch (error) {
      console.error('Error updating notification preferences:', error);
    }
  };

  const value = {
    notifications,
    unreadCount,
    loading,
    error,
    preferences,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    updatePreferences,
    refreshNotifications: fetchNotifications,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
} 