import axios from 'axios';
import { toast } from 'react-toastify';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8000';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
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

export const wsManager = new WebSocketManager();

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
export const authAPI = {
  login: async (email, password) => {
    const response = await api.post('/api/v1/auth/login', { email, password });
    return response.data;
  },
  getProfile: async () => {
    const response = await api.get('/api/v1/auth/me');
    return response.data;
  },
  createUser: async (userData) => {
    const response = await api.post('/api/v1/users', userData);
    return response.data;
  },
  createTestUser: async () => {
    const response = await api.post('/api/v1/users', {
      email: 'test@example.com',
      password: 'test123',
      role: 'user'
    });
    return response.data;
  }
};

// Users API
export const usersAPI = {
  getUsers: () => api.get('/api/v1/users'),
  getUser: (id) => api.get(`/api/v1/users/${id}`),
  createUser: (user) => api.post('/api/v1/users', user),
  updateUser: (id, user) => api.put(`/api/v1/users/${id}`, user),
  deleteUser: (id) => api.delete(`/api/v1/users/${id}`),
};

// Analytics API
export const analyticsAPI = {
  getMetrics: () => api.get('/api/analytics/metrics'),
  getRealtimeAnalytics: () => api.get('/api/analytics/realtime'),
  getEnhancedAnalytics: () => api.get('/api/analytics/enhanced'),
  getMetricHistory: (metric, timeRange) => api.get(`/api/analytics/metrics/${metric}/history`, { params: { timeRange } }),
  getCustomReport: (params) => api.post('/api/analytics/reports/custom', params),
  exportAnalytics: (format) => api.get('/api/analytics/export', { params: { format } }),
};

// Storage API
export const storageAPI = {
  getFiles: () => api.get('/storage/files'),
  uploadFile: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/storage/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  deleteFile: (id) => api.delete(`/storage/files/${id}`),
  downloadFile: (id) => api.get(`/storage/files/${id}/download`),
};

// Settings API
export const settingsAPI = {
  getSettings: () => api.get('/settings'),
  updateSettings: (settings) => api.put('/settings', settings),
};

// Notifications API
export const notificationsAPI = {
  getNotifications: () => api.get('/notifications'),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  deleteNotification: (id) => api.delete(`/notifications/${id}`),
  updatePreferences: (preferences) => api.put('/notifications/preferences', preferences),
};

// Security API
export const securityAPI = {
  getSecuritySettings: () => api.get('/security/settings'),
  updateSecuritySettings: (settings) => api.put('/security/settings', settings),
  getAuditLogs: () => api.get('/security/audit-logs'),
  getApiKeys: () => api.get('/security/api-keys'),
  createApiKey: (data) => api.post('/security/api-keys', data),
  deleteApiKey: (id) => api.delete(`/security/api-keys/${id}`),
};

// Chat API
export const chatAPI = {
  sendMessage: (message) => api.post('/api/chat/messages', message),
  getHistory: (limit = 50) => api.get('/api/chat/history', { params: { limit } }),
  getMessage: (messageId) => api.get(`/api/chat/messages/${messageId}`),
};

// Document API
export const documentAPI = {
  createDocument: (document) => api.post('/api/documents', document),
  getDocument: (documentId) => api.get(`/api/documents/${documentId}`),
  saveDocument: (document) => api.post('/api/documents/save', document),
  getHistory: (documentId, limit = 50) => api.get(`/api/documents/${documentId}/history`, { params: { limit } }),
  addCollaborator: (documentId, collaborator) => api.post('/api/documents/collaborators', { documentId, collaborator }),
  removeCollaborator: (documentId, collaboratorId) => api.delete(`/api/documents/collaborators/${documentId}/${collaboratorId}`),
};

// Events API
export const eventsAPI = {
  getEvents: async (limit = 10) => {
    const response = await api.get('/api/events', { params: { limit } });
    return response.data;
  },
  createEvent: async (eventData) => {
    const response = await api.post('/api/events', eventData);
    return response.data;
  }
};

// Presence API
export const presenceAPI = {
  getOnlineUsers: async () => {
    const response = await api.get('/api/presence');
    return response.data;
  }
};

// ML Service API
export const mlAPI = {
  async inference(request) {
    const response = await axios.post('/api/ml/inference', request);
    return response.data;
  },

  async getMetrics(modelName) {
    const response = await axios.get(`/api/ml/metrics/${modelName}`);
    return response.data;
  },

  async listModels() {
    const response = await axios.get('/api/ml/models');
    return response.data;
  },

  async getModelConfig(modelName) {
    const response = await axios.get(`/api/ml/models/${modelName}`);
    return response.data;
  },
};

// Tenant API
export const tenantAPI = {
  getTenants: () => api.get('/api/tenants'),
  getTenant: (id) => api.get(`/api/tenants/${id}`),
  createTenant: (tenant) => api.post('/api/tenants', tenant),
  updateTenant: (id, tenant) => api.put(`/api/tenants/${id}`, tenant),
  deleteTenant: (id) => api.delete(`/api/tenants/${id}`),
  switchTenant: (id) => api.post(`/api/tenants/${id}/switch`),
  getTenantSettings: (id) => api.get(`/api/tenants/${id}/settings`),
  updateTenantSettings: (id, settings) => api.put(`/api/tenants/${id}/settings`, settings),
};

// RBAC API
export const rbacAPI = {
  getRoles: () => api.get('/api/rbac/roles'),
  getRole: (id) => api.get(`/api/rbac/roles/${id}`),
  createRole: (role) => api.post('/api/rbac/roles', role),
  updateRole: (id, role) => api.put(`/api/rbac/roles/${id}`, role),
  deleteRole: (id) => api.delete(`/api/rbac/roles/${id}`),
  getPermissions: () => api.get('/api/rbac/permissions'),
  getUserRoles: () => api.get('/api/rbac/user/roles'),
  assignRole: (userId, roleId) => api.post(`/api/rbac/users/${userId}/roles`, { roleId }),
  removeRole: (userId, roleId) => api.delete(`/api/rbac/users/${userId}/roles/${roleId}`),
  getRolePermissions: (roleId) => api.get(`/api/rbac/roles/${roleId}/permissions`),
};

export default api; 