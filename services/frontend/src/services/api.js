import axios from 'axios';
import { toast } from 'react-toastify';

// Update base URLs to use nginx proxy
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important for CORS
  timeout: 10000, // 10 seconds timeout
});

// WebSocket connection manager
class WebSocketManager {
  constructor() {
    this.ws = null;
    this.messageHandlers = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.userId = null;
    this.token = null;
  }

  connect(userId, token) {
    this.userId = userId;
    this.token = token;
    this.connectWebSocket();
  }

  connectWebSocket() {
    const wsUrl = `${process.env.REACT_APP_WS_URL}?token=${this.token}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      // Send initial presence message
      this.send({
        type: 'presence',
        data: {
          userId: this.userId,
          status: 'online',
        },
      });
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.handleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const handlers = this.messageHandlers.get(message.type) || [];
        handlers.forEach((handler) => handler(message.data));
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
  }

  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      setTimeout(() => this.connectWebSocket(), this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.messageHandlers.clear();
    this.userId = null;
    this.token = null;
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not connected');
    }
  }

  onMessage(type, handler) {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    this.messageHandlers.get(type).push(handler);
  }

  offMessage(type, handler) {
    if (this.messageHandlers.has(type)) {
      const handlers = this.messageHandlers.get(type);
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }
}

// Create WebSocket manager instance
const wsManager = new WebSocketManager();

// Add request interceptor for authentication
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    // Store token if it's a login response
    if (response.config.url.includes('/api/v1/auth/login') && response.data.access_token) {
      localStorage.setItem('token', response.data.access_token);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        // Try to refresh token
        const token = localStorage.getItem('token');
        if (token) {
          const response = await api.post('/api/v1/auth/refresh', { token });
          const { access_token } = response.data;
          localStorage.setItem('token', access_token);
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // If refresh fails, logout user
        localStorage.removeItem('token');
        wsManager.disconnect();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    // Handle other errors
    const errorMessage = error.response?.data?.detail || error.response?.data?.message || 'An error occurred';
    toast.error(errorMessage);

    return Promise.reject(error);
  }
);

// Auth API
const authAPI = {
  login: (credentials) => api.post('/api/v1/auth/login', credentials),
  register: (userData) => api.post('/api/v1/auth/register', userData),
  forgotPassword: (email) => api.post('/api/v1/auth/forgot-password', { email }),
  resetPassword: (data) => api.post('/api/v1/auth/reset-password', data),
  verifyToken: () => api.get('/api/v1/auth/verify'),
};

// User API
const userAPI = {
  getProfile: () => api.get('/api/v1/users/profile'),
  updateProfile: (data) => api.put('/api/v1/users/profile', data),
  changePassword: (data) => api.post('/api/v1/users/change-password', data),
};

// Activity API
const activityAPI = {
  getActivities: (params) => api.get('/api/v1/activities', { params }),
  getActivity: (id) => api.get(`/api/v1/activities/${id}`),
  createActivity: (data) => api.post('/api/v1/activities', data),
  updateActivity: (id, data) => api.put(`/api/v1/activities/${id}`, data),
  deleteActivity: (id) => api.delete(`/api/v1/activities/${id}`),
};

// Notification API
const notificationAPI = {
  getNotifications: (params) => api.get('/api/v1/notifications', { params }),
  markAsRead: (id) => api.put(`/api/v1/notifications/${id}/read`),
  markAllAsRead: () => api.put('/api/v1/notifications/read-all'),
  deleteNotification: (id) => api.delete(`/api/v1/notifications/${id}`),
};

// Message API
const messageAPI = {
  getMessages: (params) => api.get('/api/v1/messages', { params }),
  getMessage: (id) => api.get(`/api/v1/messages/${id}`),
  sendMessage: (data) => api.post('/api/v1/messages', data),
  updateMessage: (id, data) => api.put(`/api/v1/messages/${id}`, data),
  deleteMessage: (id) => api.delete(`/api/v1/messages/${id}`),
};

// Tenant API
const tenantAPI = {
  getTenants: (params) => api.get('/api/v1/tenants', { params }),
  getTenant: (id) => api.get(`/api/v1/tenants/${id}`),
  createTenant: (data) => api.post('/api/v1/tenants', data),
  updateTenant: (id, data) => api.put(`/api/v1/tenants/${id}`, data),
  deleteTenant: (id) => api.delete(`/api/v1/tenants/${id}`),
};

// Role API
const roleAPI = {
  getRoles: (params) => api.get('/api/v1/rbac/roles', { params }),
  getRole: (id) => api.get(`/api/v1/rbac/roles/${id}`),
  createRole: (data) => api.post('/api/v1/rbac/roles', data),
  updateRole: (id, data) => api.put(`/api/v1/rbac/roles/${id}`, data),
  deleteRole: (id) => api.delete(`/api/v1/rbac/roles/${id}`),
};

// Analytics API
const analyticsAPI = {
  getAnalytics: (params) => api.get('/api/v1/analytics', { params }),
  getMetrics: (params) => api.get('/api/v1/analytics/metrics', { params }),
  getTrends: (params) => api.get('/api/v1/analytics/trends', { params }),
  getPerformance: (params) => api.get('/api/v1/analytics/performance', { params }),
  getUsage: (params) => api.get('/api/v1/analytics/usage', { params }),
  getDashboardData: () => api.get('/api/v1/analytics/dashboard'),
};

// ML Service API
const mlServiceAPI = {
  getModels: () => api.get('/api/v1/ml/models'),
  getModel: (id) => api.get(`/api/v1/ml/models/${id}`),
  createModel: (data) => api.post('/api/v1/ml/models', data),
  updateModel: (id, data) => api.put(`/api/v1/ml/models/${id}`, data),
  deleteModel: (id) => api.delete(`/api/v1/ml/models/${id}`),
  generateResponse: (data) => api.post('/api/v1/ml/generate', data),
  streamResponse: (data) => api.post('/api/v1/ml/stream', data),
};

// Dashboard API
const dashboardAPI = {
  getDashboardData: () => api.get('/api/v1/dashboard'),
  getRecentActivity: (params) => api.get('/api/v1/dashboard/activity', { params }),
  getStats: () => api.get('/api/v1/dashboard/stats'),
};

// RBAC API
const rbacAPI = {
  getRoles: (params) => api.get('/api/v1/rbac/roles', { params }),
  getRole: (id) => api.get(`/api/v1/rbac/roles/${id}`),
  createRole: (data) => api.post('/api/v1/rbac/roles', data),
  updateRole: (id, data) => api.put(`/api/v1/rbac/roles/${id}`, data),
  deleteRole: (id) => api.delete(`/api/v1/rbac/roles/${id}`),
  getPermissions: () => api.get('/api/v1/rbac/permissions'),
  getUserRoles: () => api.get('/api/v1/rbac/user/roles'),
  assignRole: (userId, roleId) => api.post(`/api/v1/rbac/users/${userId}/roles`, { roleId }),
  removeRole: (userId, roleId) => api.delete(`/api/v1/rbac/users/${userId}/roles/${roleId}`),
  getRolePermissions: (roleId) => api.get(`/api/v1/rbac/roles/${roleId}/permissions`),
  updateRolePermissions: (roleId, permissions) => api.put(`/api/v1/rbac/roles/${roleId}/permissions`, { permissions }),
};

// Profile API
const profileAPI = {
  getProfile: () => api.get('/api/v1/profile'),
  updateProfile: (data) => api.put('/api/v1/profile', data),
  updateAvatar: (formData) => api.post('/api/v1/profile/avatar', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }),
  changePassword: (data) => api.post('/api/v1/profile/password', data),
  getPreferences: () => api.get('/api/v1/profile/preferences'),
  updatePreferences: (data) => api.put('/api/v1/profile/preferences', data),
};

// Messages API
const messagesAPI = {
  getMessages: (params) => api.get('/api/v1/messages', { params }),
  getMessage: (id) => api.get(`/api/v1/messages/${id}`),
  sendMessage: (data) => api.post('/api/v1/messages', data),
  updateMessage: (id, data) => api.put(`/api/v1/messages/${id}`, data),
  deleteMessage: (id) => api.delete(`/api/v1/messages/${id}`),
  markAsRead: (id) => api.put(`/api/v1/messages/${id}/read`),
  getConversations: () => api.get('/api/v1/messages/conversations'),
  getConversation: (id) => api.get(`/api/v1/messages/conversations/${id}`),
};

// Chat API
const chatAPI = {
  sendMessage: (data) => api.post('/api/v1/chat/messages', data),
  getHistory: (params) => api.get('/api/v1/chat/history', { params }),
  getMessage: (id) => api.get(`/api/v1/chat/messages/${id}`),
  deleteMessage: (id) => api.delete(`/api/v1/chat/messages/${id}`),
  getConversations: () => api.get('/api/v1/chat/conversations'),
  getConversation: (id) => api.get(`/api/v1/chat/conversations/${id}`),
  markAsRead: (id) => api.put(`/api/v1/chat/messages/${id}/read`),
  getOnlineUsers: () => api.get('/api/v1/chat/online-users'),
};

// Ollama API
const ollamaAPI = {
  getModels: () => api.get('/api/v1/ollama/models'),
  chat: (data) => api.post('/api/v1/ollama/chat', data),
  pullModel: (modelName) => api.post(`/api/v1/ollama/models/${modelName}/pull`),
  deleteModel: (modelName) => api.delete(`/api/v1/ollama/models/${modelName}`),
  getModelStatus: (modelName) => api.get(`/api/v1/ollama/models/${modelName}/status`),
};

// Export everything
export {
  api,
  wsManager,
  authAPI,
  userAPI,
  activityAPI,
  notificationAPI,
  messageAPI,
  tenantAPI,
  roleAPI,
  analyticsAPI,
  mlServiceAPI,
  dashboardAPI,
  rbacAPI,
  profileAPI,
  messagesAPI,
  chatAPI,
  ollamaAPI
}; 