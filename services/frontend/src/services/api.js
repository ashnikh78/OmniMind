import axios from 'axios';
import { toast } from 'react-toastify';

// Update base URLs to use nginx proxy
console.log('API URL:', process.env.REACT_APP_API_URL);
console.log('NODE_ENV:', process.env.NODE_ENV);
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  withCredentials: true,
  timeout: 10000,
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
    this.isConnecting = false;
    this.heartbeatInterval = null;
    this.lastHeartbeat = null;
    this.heartbeatTimeout = 30000; // 30 seconds
  }

  connect(userId, token) {
    if (!userId || !token) {
      console.error('WebSocket connection requires userId and token');
      return;
    }
    
    this.userId = userId;
    this.token = token;
    this.connectWebSocket();
  }

  connectWebSocket() {
    if (this.isConnecting) {
      console.log('WebSocket connection already in progress');
      return;
    }

    this.isConnecting = true;
    const wsUrl = `${WS_URL}/ws?token=${this.token}`;
    
    try {
      this.ws = new WebSocket(wsUrl);
      this.setupEventHandlers();
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.handleReconnect();
    }
  }

  setupEventHandlers() {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      // Send initial presence message
      this.send({
        type: 'presence',
        data: {
          userId: this.userId,
          status: 'online',
        },
      });
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason);
      this.isConnecting = false;
      this.stopHeartbeat();
      this.handleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.isConnecting = false;
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        // Handle heartbeat response
        if (message.type === 'heartbeat') {
          this.lastHeartbeat = Date.now();
          return;
        }

        const handlers = this.messageHandlers.get(message.type) || [];
        handlers.forEach((handler) => handler(message.data));
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'heartbeat' });
        
        // Check if we've missed heartbeats
        if (this.lastHeartbeat && Date.now() - this.lastHeartbeat > this.heartbeatTimeout) {
          console.warn('Missed heartbeat, reconnecting...');
          this.ws.close();
        }
      }
    }, 15000); // Send heartbeat every 15 seconds
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connectWebSocket();
    }, delay);
  }

  onMessage(type, handler) {
    const handlers = this.messageHandlers.get(type) || [];
    handlers.push(handler);
    this.messageHandlers.set(type, handlers);
  }

  offMessage(type, handler) {
    const handlers = this.messageHandlers.get(type) || [];
    const index = handlers.indexOf(handler);
    if (index !== -1) {
      handlers.splice(index, 1);
      this.messageHandlers.set(type, handlers);
    }
  }

  send(message) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not connected');
      this.handleReconnect();
    }
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnecting = false;
    this.reconnectAttempts = 0;
  }
}

// Create WebSocket manager instance
const wsManager = new WebSocketManager();

// Add request interceptor for logging and token handling
api.interceptors.request.use(
  (config) => {
    console.log('Making request to:', config.baseURL + config.url);
    const token = localStorage.getItem('token');
    if (token) {
      config.headers = {
        ...config.headers,
        'Authorization': `Bearer ${token}`
      };
      console.log('Request headers:', config.headers);
    } else {
      console.log('No token found in localStorage');
    }
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log('Response received:', response.config.url, response.status);
    // Store token if it's a login response
    if (response.config.url.includes('/api/v1/auth/login') && response.data.access_token) {
      const token = response.data.access_token;
      localStorage.setItem('token', token);
      // Update default headers with new token
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      console.log('Token stored and headers updated');
    }
    return response;
  },
  async (error) => {
    console.error('Response error:', error.config?.url, error.response?.status);
    const originalRequest = error.config;

    // Handle 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        // Try to refresh token
        const token = localStorage.getItem('token');
        if (token) {
          console.log('Attempting to refresh token...');
          const response = await api.post('/api/v1/auth/refresh', { token });
          const { access_token } = response.data;
          localStorage.setItem('token', access_token);
          // Update default headers with new token
          api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
          originalRequest.headers['Authorization'] = `Bearer ${access_token}`;
          console.log('Token refreshed successfully');
          return api(originalRequest);
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        // If refresh fails, logout user
        localStorage.removeItem('token');
        delete api.defaults.headers.common['Authorization'];
        wsManager.disconnect();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    // Only show toast for critical errors
    if (error.response?.status === 401) {
      toast.error('Please log in to continue');
    } else if (error.response?.status === 403) {
      toast.error('You do not have permission to perform this action');
    } else if (error.response?.status >= 500) {
      toast.error('Server error. Please try again later');
    }

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
  createModel: (data) => api.post(`/api/v1/ml/models`, data),
  deleteModel: (id) => api.delete(`/api/v1/ml/models/${id}`),
  generateResponse: (data) => api.post('/api/v1/ml/inference', data),
  streamResponse: async (data, onChunk, onComplete, onError) => {
    try {
      const response = await fetch('/api/v1/ml/inference/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.error) {
              onError(data.error);
              return;
            }
            onChunk(data.response);
          } catch (e) {
            console.error('Error parsing chunk:', e);
          }
        }
      }

      onComplete();
    } catch (error) {
      onError(error);
    }
  },
  getModelMetrics: async (modelId) => {
    try {
      const response = await api.get(`/api/v1/ml/models/${modelId}/status`);
      const modelStatus = response.data;
      
      return {
        performance: {
          accuracy: 0.95, // Default value since Ollama doesn't provide accuracy metrics
          latency: modelStatus.gpu_memory > 0 ? 0.5 : 1.0, // Estimate based on GPU usage
          throughput: 100, // Default value
          error_rate: 0.05 // Default value
        },
        usage: {
          requests: modelStatus.concurrent_requests,
          tokens: 0, // Not provided by Ollama
          latency: modelStatus.gpu_memory > 0 ? 0.5 : 1.0
        },
        errors: {
          count: 0, // Not provided by Ollama
          types: {
            timeout: 0,
            validation: 0,
            other: 0
          }
        }
      };
    } catch (error) {
      console.error('Error fetching model metrics:', error);
      return null;
    }
  },
  trainModel: (modelId, data) => api.post(`/api/v1/ml/models/${modelId}/train`, data),
  deployModel: (modelId) => api.post(`/api/v1/ml/models/${modelId}/deploy`),
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
  getModels: () => api.get('/api/ollama/models'),
  chat: (data) => api.post('/api/ollama/chat', data),
  pullModel: (modelName) => api.post(`/api/ollama/models/${modelName}/pull`),
  deleteModel: (modelName) => api.delete(`/api/ollama/models/${modelName}`),
  getModelStatus: (modelName) => api.get(`/api/ollama/models/${modelName}/status`),
};

// Export everything
export {
  api,
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
  ollamaAPI,
  wsManager
}; 