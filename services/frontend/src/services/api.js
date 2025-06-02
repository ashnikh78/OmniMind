import axios from 'axios';
import { toast } from 'react-toastify';

// Log environment variables for debugging
console.log('API URL:', process.env.REACT_APP_API_URL);
console.log('WebSocket URL:', process.env.REACT_APP_WS_URL);
console.log('NODE_ENV:', process.env.NODE_ENV);

// Set base URLs with fallbacks
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const WS_BASE_URL = process.env.REACT_APP_WS_URL || (API_BASE_URL.replace(/^http/, 'ws') + '/ws');
if (!process.env.REACT_APP_API_URL) {
  console.warn('REACT_APP_API_URL not set, defaulting to http://localhost:8000');
}
if (!process.env.REACT_APP_WS_URL) {
  console.warn('REACT_APP_WS_URL not set, defaulting to ws://localhost:8000/ws');
}

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: true,
  timeout: 15000, // Timeout for Ollama requests
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
      toast.error('Authentication required for WebSocket connection');
      throw new Error('Authentication required');
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
    const wsUrl = `${WS_BASE_URL}/${this.userId}?token=${encodeURIComponent(this.token)}`;
    console.log('Connecting to WebSocket:', wsUrl);

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
    }

    this.ws.onclose = (event) => {
      console.log('WebSocket disconnected:', event);
      this.isConnecting = false;
      this.stopHeartbeat();
      this.handleReconnect();
    }

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.isConnecting = false;
    }

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        // Handle heartbeat response
        if (message.type === 'heartbeat') {
          this.lastHeartbeat = Date.now();
          return;
        }

        // NEW: Handle customer_analysis messages
        if (message.type === 'customer_analysis') {
          console.log('Received customer analysis result:', message.data);
          toast.info('Customer analysis completed');
        }

        const handlers = this.messageHandlers.get(message.type) || [];
        handlers.forEach(handler => handler(message.data));
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    }
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'heartbeat' });

        // Check for missed heartbeats
        if (this.lastHeartbeat && Date.now() - this.lastHeartbeat > this.heartbeatTimeout) {
          console.warn('Missed heartbeat, reconnecting...');
          this.ws.close();
        }
      }
    }, 15000); // Heartbeat every 15 seconds
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
      toast.error('Lost connection to server. Please refresh the page.');
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

// Request interceptor for token handling
api.interceptors.request.use(
  (config) => {
    const startTime = Date.now();
    console.log('Making request to:', config.baseURL + config.url);
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      console.log('No token found in localStorage');
    }
    config.metadata = { startTime };
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    const duration = Date.now() - (response.config.metadata?.startTime || Date.now());
    console.log(`Response received: ${response.config.url} (${response.status}) in ${duration}ms`);
    if (response.config.url.includes('/api/v1/auth/login') && response.data.access_token) {
      const token = response.data.access_token;
      localStorage.setItem('token', token);
      console.log('Token stored');
    }
    return response;
  },
  async (error) => {
    const duration = Date.now() - (error.config?.metadata?.startTime || Date.now());
    console.error(`Response error: ${error.config?.url} (${error.response?.status}) in ${duration}ms`);
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest?._retry) {
      originalRequest._retry = true;
      try {
        console.log('Attempting to refresh token...');
        const token = localStorage.getItem('token');
        const response = await api.post('/api/v1/auth/refresh', {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const { access_token } = response.data;
        localStorage.setItem('token', access_token);
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        console.log('Token refreshed successfully');
        return api(originalRequest);
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        localStorage.removeItem('token');
        wsManager.disconnect();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    if (error.response?.status === 401) {
      toast.error('Please log in to continue');
    } else if (error.response?.status === 403) {
      toast.error('You do not have permission to perform this action');
    } else if (error.response?.status === 422) {
      toast.error('Invalid input data');
    } else if (error.response?.status >= 500) {
      toast.error('Server error. Please try again later');
    } else if (error.code === 'ECONNABORTED') {
      toast.error('Request timed out. Please try again.');
    }

    return Promise.reject(error);
  }
);

// Auth API
const authAPI = {
  async login(credentials) {
    try {
      if (!credentials.email || !credentials.password) {
        throw new Error('Email and password are required');
      }
      const response = await api.post('/api/v1/auth/login', credentials);
      return response.data;
    } catch (error) {
      console.error('Error logging in:', error);
      throw error.response?.status === 401
        ? new Error('Invalid credentials')
        : new Error('Failed to log in');
    }
  },
  async createTestUser() {
    try {
      const response = await api.post('/api/v1/auth/create-test-user');
      return response.data;
    } catch (error) {
      console.error('Error creating test user:', error);
      throw new Error('Failed to create test user');
    }
  },
  async refreshToken() {
    try {
      const token = localStorage.getItem('token');
      const response = await api.post('/api/v1/auth/refresh', {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    } catch (error) {
      console.error('Error refreshing token:', error);
      throw new Error('Failed to refresh token');
    }
  },
  async getCurrentUser() {
    try {
      const response = await api.get('/api/v1/auth/me');
      return response.data;
    } catch (error) {
      console.error('Error fetching current user:', error);
      throw error.response?.status === 401
        ? new Error('Authentication required')
        : new Error('Failed to fetch current user');
    }
  },
};

// User API
const userAPI = {
  async createUser(data) {
    try {
      if (!data.email || !data.password) {
        throw new Error('Email and password are required');
      }
      const response = await api.post('/api/v1/users', data);
      return response.data;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error.response?.status === 422
        ? new Error('Invalid user data')
        : error.response?.status === 401
        ? new Error('Authentication required')
        : new Error('Failed to create user');
    }
  },
};

// Chat API
const chatAPI = {
  async sendMessage(data) {
    try {
      if (!data.sender_id || !data.sender_name || !data.content || !data.timestamp) {
        throw new Error('Missing required message fields: sender_id, sender_name, content, timestamp');
      }
      const response = await api.post('/api/chat/messages', data);
      return response.data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error.response?.status === 422
        ? new Error('Invalid message data')
        : error.response?.status === 401
        ? new Error('Authentication required')
        : new Error('Failed to send message');
    }
  },
  async getHistory(params = {}) {
    try {
      const response = await api.get('/api/chat/history', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching chat history:', error);
      throw error.response?.status === 401
        ? new Error('Authentication required')
        : new Error('Failed to fetch chat history');
    }
  },
  async getMessage(id) {
    try {
      if (!id) throw new Error('Message ID is required');
      const response = await api.get(`/api/chat/messages/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching message:', error);
      throw error.response?.status === 404
        ? new Error('Message not found')
        : error.response?.status === 401
        ? new Error('Authentication required')
        : new Error('Failed to fetch message');
    }
  },
};

// Document API
const documentAPI = {
  async createDocument(data) {
    try {
      if (!data.id || !data.title || !data.content || !data.owner_id) {
        throw new Error('Missing required document fields: id, title, content, owner_id');
      }
      const response = await api.post('/api/documents', {
        ...data,
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at || new Date().toISOString(),
        collaborators: data.collaborators || [],
      });
      return response.data;
    } catch (error) {
      console.error('Error creating document:', error);
      throw error.response?.status === 422
        ? new Error('Invalid document data')
        : error.response?.status === 401
        ? new Error('Authentication required')
        : new Error('Failed to create document');
    }
  },
  async getDocument(id) {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid document ID');
      }
      const response = await api.get(`/api/documents/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching document:', error);
      throw error.response?.status === 404
        ? new Error('Document not found')
        : error.response?.status === 401
        ? new Error('Authentication required')
        : new Error('Failed to fetch document');
    }
  },
  async getCurrentDocument() {
    try {
      const response = await api.get('/api/documents/current');
      return response.data;
    } catch (error) {
      console.error('Error fetching current document:', error);
      throw error.response?.status === 404
        ? new Error('No current document found')
        : error.response?.status === 401
        ? new Error('Authentication required')
        : new Error('Failed to fetch current document');
    }
  },
  async saveDocument(data) {
    try {
      if (!data.id || !data.title || !data.content || !data.owner_id) {
        throw new Error('Missing required document fields: id, title, content, owner_id');
      }
      const response = await api.post('/api/documents/save', {
        ...data,
        updated_at: new Date().toISOString(),
        collaborators: data.collaborators || [],
      });
      return response.data;
    } catch (error) {
      console.error('Error saving document:', error);
      throw error.response?.status === 422
        ? new Error('Invalid document data')
        : error.response?.status === 404
        ? new Error('Document not found')
        : error.response?.status === 401
        ? new Error('Authentication required')
        : new Error('Failed to save document');
    }
  },
  async getDocumentHistory(id, params = {}) {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid document ID');
      }
      const response = await api.get(`/api/documents/${id}/history`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching document history:', error);
      throw error.response?.status === 404
        ? new Error('Document not found')
        : error.response?.status === 401
        ? new Error('Authentication required')
        : new Error('Failed to fetch document history');
    }
  },
  async addCollaborator(documentId, collaborator) {
    try {
      if (!documentId || typeof documentId !== 'string') {
        throw new Error('Invalid document ID');
      }
      if (!collaborator.id || typeof collaborator.id !== 'string') {
        throw new Error('Invalid collaborator data: id required');
      }
      const response = await api.post('/api/documents/collaborators', collaborator, {
        params: { document_id: documentId },
      });
      return response.data;
    } catch (error) {
      console.error('Error adding collaborator:', error);
      throw error.response?.status === 422
        ? new Error('Invalid collaborator data')
        : error.response?.status === 404
        ? new Error('Document not found')
        : error.response?.status === 401
        ? new Error('Authentication required')
        : new Error('Failed to add collaborator');
    }
  },
  async removeCollaborator(documentId, collaboratorId) {
    try {
      if (!documentId || typeof documentId !== 'string') {
        throw new Error('Invalid document ID');
      }
      if (!collaboratorId || typeof collaboratorId !== 'string') {
        throw new Error('Invalid collaborator ID');
      }
      const response = await api.delete(`/api/documents/collaborators/${documentId}/${collaboratorId}`);
      return response.data;
    } catch (error) {
      console.error('Error removing collaborator:', error);
      throw error.response?.status === 404
        ? new Error('Document or collaborator not found')
        : error.response?.status === 401
        ? new Error('Authentication required')
        : new Error('Failed to remove collaborator');
    }
  },
};

// Event API
const eventAPI = {
  async createEvent(data) {
    try {
      if (!data.user_id) {
        throw new Error('User ID is required');
      }
      const response = await api.post('/api/events', data);
      return response.data;
    } catch (error) {
      console.error('Error creating event:', error);
      throw error.response?.status === 422
        ? new Error('Invalid event data')
        : error.response?.status === 401
        ? new Error('Authentication required')
        : new Error('Failed to create event');
    }
  },
  async getEvents(params = {}) {
    try {
      const response = await api.get('/api/events', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching events:', error);
      throw error.response?.status === 401
        ? new Error('Authentication required')
        : new Error('Failed to fetch events');
    }
  },
  async getEvent(id) {
    try {
      if (!id) throw new Error('Event ID is required');
      const response = await api.get(`/api/events/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching event:', error);
      throw error.response?.status === 404
        ? new Error('Event not found')
        : error.response?.status === 401
        ? new Error('Authentication required')
        : new Error('Failed to fetch event');
    }
  },
};

// Notification API
const notificationAPI = {
  async getNotifications(params = {}) {
    try {
      // Fetch events with type 'notification'
      const response = await api.get('/api/events', {
        params: { ...params, type: 'notification' },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw error.response?.status === 401
        ? new Error('Authentication required')
        : new Error('Failed to fetch notifications');
    }
  },
  async createNotification(data) {
    try {
      if (!data.user_id || !data.content) {
        throw new Error('User ID and content are required');
      }
      const response = await api.post('/api/events', {
        ...data,
        type: 'notification',
        timestamp: new Date().toISOString(),
      });
      return response.data;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error.response?.status === 422
        ? new Error('Invalid notification data')
        : error.response?.status === 401
        ? new Error('Authentication required')
        : new Error('Failed to create notification');
    }
  },
  subscribe(handler) {
    // Subscribe to WebSocket notification events
    wsManager.onMessage('notification', handler);
    return () => wsManager.offMessage('notification', handler);
  },
};

// Metrics API
const metricsAPI = {
  async getMetrics() {
    try {
      const response = await api.get('/api/metrics');
      return response.data;
    } catch (error) {
      console.error('Error fetching metrics:', error);
      throw error.response?.status === 401
        ? new Error('Authentication required')
        : new Error('Failed to fetch metrics');
    }
  },
};

// Presence API
const presenceAPI = {
  async getPresence() {
    try {
      const response = await api.get('/api/presence');
      return response.data;
    } catch (error) {
      console.error('Error fetching presence:', error);
      throw error.response?.status === 401
        ? new Error('Authentication required')
        : new Error('Failed to fetch presence');
    }
  },
  async getUserActivities(userId, params = {}) {
    try {
      if (!userId) throw new Error('User ID is required');
      const response = await api.get(`/api/presence/${userId}/activities`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching user activities:', error);
      throw error.response?.status === 404
        ? new Error('User not found')
        : error.response?.status === 401
        ? new Error('Authentication required')
        : new Error('Failed to fetch user activities');
    }
  },
};

// Activity API (alias for compatibility)
const activityAPI = {
  getUserActivities: presenceAPI.getUserActivities,
};

// Analytics API
const analyticsAPI = {
  async getRealtimeAnalytics() {
    try {
      const response = await api.get('/api/analytics/realtime');
      return response.data;
    } catch (error) {
      console.error('Error fetching realtime analytics:', error);
      throw error.response?.status === 401
        ? new Error('Authentication required')
        : new Error('Failed to fetch realtime analytics');
    }
  },
  async getEnhancedAnalytics() {
    try {
      const response = await api.get('/api/analytics/enhanced');
      return response.data;
    } catch (error) {
      console.error('Error fetching enhanced analytics:', error);
      throw error.response?.status === 401
        ? new Error('Authentication required')
        : new Error('Failed to fetch enhanced analytics');
    }
  },
};

// Ollama API
const ollamaAPI = {
  async getModels() {
    try {
      const response = await api.get('/api/ollama/models');
      return response.data;
    } catch (error) {
      console.error('Error fetching Ollama models:', error);
      throw error.response?.status === 503
        ? new Error('Ollama service unavailable')
        : error.response?.status === 401
        ? new Error('Authentication required')
        : new Error('Failed to fetch models');
    }
  },
  async chat(data) {
    try {
      if (!data.message) {
        throw new Error('Message is required');
      }
      const response = await api.post('/api/ollama/chat', data);
      return response.data;
    } catch (error) {
      console.error('Error in Ollama chat:', error);
      throw error.response?.status === 422
        ? new Error('Invalid chat data')
        : error.response?.status === 401
        ? new Error('Authentication required')
        : new Error('Failed to chat with model');
    }
  },
  async pullModel(modelName) {
    try {
      if (!modelName) throw new Error('Model name is required');
      const response = await api.post(`/api/ollama/models/${modelName}/pull`);
      return response.data;
    } catch (error) {
      console.error('Error pulling model:', error);
      throw error.response?.status === 400
        ? new Error('Invalid model name')
        : error.response?.status === 401
        ? new Error('Authentication required')
        : new Error('Failed to pull model');
    }
  },
  async deleteModel(modelName) {
    try {
      if (!modelName) throw new Error('Model name is required');
      const response = await api.delete(`/api/ollama/models/${modelName}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting model:', error);
      throw error.response?.status === 404
        ? new Error('Model not found')
        : error.response?.status === 401
        ? new Error('Authentication required')
        : new Error('Failed to delete model');
    }
  },
  async getModelStatus(modelName) {
    try {
      if (!modelName) throw new Error('Model name is required');
      const response = await api.get(`/api/ollama/models/${modelName}/status`);
      return response.data;
    } catch (error) {
      console.error('Error fetching model status:', error);
      throw error.response?.status === 404
        ? new Error('Model not found')
        : error.response?.status === 401
        ? new Error('Authentication required')
        : new Error('Failed to fetch model status');
    }
  },
};

// ML Service API
const mlServiceAPI = {
  async getModels() {
    try {
      const response = await api.get('/api/v1/ml/models');
      return response.data;
    } catch (error) {
      console.error('Error fetching ML models:', error);
      throw error.response?.status === 401
        ? new Error('Authentication required')
        : new Error('Failed to fetch ML models');
    }
  },
  async getModel(id) {
    try {
      if (!id) throw new Error('Model ID is required');
      const response = await api.get(`/api/v1/ml/models/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching ML model:', error);
      throw error.response?.status === 404
        ? new Error('Model not found')
        : error.response?.status === 401
        ? new Error('Authentication required')
        : new Error('Failed to fetch ML model');
    }
  },
  async getModelMetrics(id) {
    try {
      if (!id) throw new Error('Model ID is required');
      const response = await api.get(`/api/v1/ml/models/${id}/metrics`);
      return response.data;
    } catch (error) {
      console.error('Error fetching model metrics:', error);
      throw error.response?.status === 404
        ? new Error('Model not found')
        : error.response?.status === 401
        ? new Error('Authentication required')
        : new Error('Failed to fetch model metrics');
    }
  }
};

// RBAC API
const rbacAPI = {
  async getRoles() {
    try {
      const response = await api.get('/api/v1/rbac/roles');
      return response.data;
    } catch (error) {
      console.error('Error fetching roles:', error);
      throw error.response?.status === 401
        ? new Error('Authentication required')
        : error.response?.status === 403
        ? new Error('Permission denied')
        : new Error('Failed to fetch roles');
    }
  },
  async getPermissions() {
    try {
      const response = await api.get('/api/v1/rbac/permissions');
      return response.data;
    } catch (error) {
      console.error('Error fetching permissions:', error);
      throw error.response?.status === 401
        ? new Error('Authentication required')
        : error.response?.status === 403
        ? new Error('Permission denied')
        : new Error('Failed to fetch permissions');
    }
  },
  async assignRoleToUser(userId, roleId) {
    try {
      if (!userId || !roleId) {
        throw new Error('User ID and Role ID are required');
      }
      const response = await api.post('/api/v1/rbac/roles/assign', { userId, roleId });
      return response.data;
    } catch (error) {
      console.error('Error assigning role:', error);
      throw error.response?.status === 422
        ? new Error('Invalid role assignment data')
        : error.response?.status === 401
        ? new Error('Authentication required')
        : error.response?.status === 403
        ? new Error('Permission denied')
        : new Error('Failed to assign role');
    }
  },
};

// Tenant API
const tenantAPI = {
  async createTenant(data) {
    try {
      if (!data.name) {
        throw new Error('Tenant name is required');
      }
      const response = await api.post('/api/v1/tenants', data);
      return response.data;
    } catch (error) {
      console.error('Error creating tenant:', error);
      throw error.response?.status === 422
        ? new Error('Invalid tenant data')
        : error.response?.status === 401
        ? new Error('Authentication required')
        : error.response?.status === 403
        ? new Error('Permission denied')
        : new Error('Failed to create tenant');
    }
  },
  async getTenants(params = {}) {
    try {
      const response = await api.get('/api/v1/tenants', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching tenants:', error);
      throw error.response?.status === 401
        ? new Error('Authentication required')
        : error.response?.status === 403
        ? new Error('Permission denied')
        : new Error('Failed to fetch tenants');
    }
  },
  async getTenant(id) {
    try {
      if (!id) throw new Error('Tenant ID is required');
      const response = await api.get(`/api/v1/tenants/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching tenant:', error);
      throw error.response?.status === 404
        ? new Error('Tenant not found')
        : error.response?.status === 401
        ? new Error('Authentication required')
        : error.response?.status === 403
        ? new Error('Permission denied')
        : new Error('Failed to fetch tenant');
    }
  },
  async updateTenant(id, data) {
    try {
      if (!id) throw new Error('Tenant ID is required');
      const response = await api.put(`/api/v1/tenants/${id}`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating tenant:', error);
      throw error.response?.status === 422
        ? new Error('Invalid tenant data')
        : error.response?.status === 404
        ? new Error('Tenant not found')
        : error.response?.status === 401
        ? new Error('Authentication required')
        : error.response?.status === 403
        ? new Error('Permission denied')
        : new Error('Failed to update tenant');
    }
  },
  async deleteTenant(id) {
    try {
      if (!id) throw new Error('Tenant ID is required');
      const response = await api.delete(`/api/v1/tenants/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting tenant:', error);
      throw error.response?.status === 404
        ? new Error('Tenant not found')
        : error.response?.status === 401
        ? new Error('Authentication required')
        : error.response?.status === 403
        ? new Error('Permission denied')
        : new Error('Failed to delete tenant');
    }
  },
};

// Dashboard API
const dashboardAPI = {
  async getDashboardData(params = {}) {
    try {
      const response = await api.get('/api/v1/dashboard', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      throw error.response?.status === 401
        ? new Error('Authentication required')
        : error.response?.status === 403
        ? new Error('Permission denied')
        : new Error('Failed to fetch dashboard data');
    }
  },
  async getUserDashboard(userId, params = {}) {
    try {
      if (!userId) throw new Error('User ID is required');
      const response = await api.get(`/api/v1/dashboard/user/${userId}`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching user dashboard:', error);
      throw error.response?.status === 404
        ? new Error('User dashboard not found')
        : error.response?.status === 401
        ? new Error('Authentication required')
        : error.response?.status === 403
        ? new Error('Permission denied')
        : new Error('Failed to fetch user dashboard');
    }
  },
  async updateDashboardConfig(id, data) {
    try {
      if (!id) throw new Error('Dashboard ID is required');
      const response = await api.put(`/api/v1/dashboard/${id}/config`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating dashboard config:', error);
      throw error.response?.status === 422
        ? new Error('Invalid dashboard configuration')
        : error.response?.status === 404
        ? new Error('Dashboard not found')
        : error.response?.status === 401
        ? new Error('Authentication required')
        : error.response?.status === 403
        ? new Error('Permission denied')
        : new Error('Failed to update dashboard config');
    }
  },
};

// Message API
const messageAPI = {
  async sendDirectMessage(data) {
    try {
      if (!data.sender_id || !data.recipient_id || !data.content || !data.timestamp) {
        throw new Error('Missing required message fields: sender_id, recipient_id, content, timestamp');
      }
      const response = await api.post('/api/v1/messages/direct', data);
      return response.data;
    } catch (error) {
      console.error('Error sending direct message:', error);
      throw error.response?.status === 422
        ? new Error('Invalid message data')
        : error.response?.status === 401
        ? new Error('Authentication required')
        : error.response?.status === 403
        ? new Error('Permission denied')
        : new Error('Failed to send direct message');
    }
  },
  async getUserMessages(userId, params = {}) {
    try {
      if (!userId) throw new Error('User ID is required');
      const response = await api.get(`/api/v1/messages/user/${userId}`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching user messages:', error);
      throw error.response?.status === 404
        ? new Error('Messages not found')
        : error.response?.status === 401
        ? new Error('Authentication required')
        : error.response?.status === 403
        ? new Error('Permission denied')
        : new Error('Failed to fetch user messages');
    }
  },
  async updateMessage(id, data) {
    try {
      if (!id) throw new Error('Message ID is required');
      const response = await api.put(`/api/v1/messages/${id}`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating message:', error);
      throw error.response?.status === 422
        ? new Error('Invalid message data')
        : error.response?.status === 404
        ? new Error('Message not found')
        : error.response?.status === 401
        ? new Error('Authentication required')
        : error.response?.status === 403
        ? new Error('Permission denied')
        : new Error('Failed to update message');
    }
  },
  async deleteMessage(id) {
    try {
      if (!id) throw new Error('Message ID is required');
      const response = await api.delete(`/api/v1/messages/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error.response?.status === 404
        ? new Error('Message not found')
        : error.response?.status === 401
        ? new Error('Authentication required')
        : error.response?.status === 403
        ? new Error('Permission denied')
        : new Error('Failed to delete message');
    }
  },
};

// Profile API
const profileAPI = {
  async getProfile(userId) {
    try {
      if (!userId) throw new Error('User ID is required');
      const response = await api.get(`/api/v1/profiles/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching profile:', error);
      throw error.response?.status === 404
        ? new Error('Profile not found')
        : error.response?.status === 401
        ? new Error('Authentication required')
        : error.response?.status === 403
        ? new Error('Permission denied')
        : new Error('Failed to fetch profile');
    }
  },
  async updateProfile(userId, data) {
    try {
      if (!userId) throw new Error('User ID is required');
      const response = await api.put(`/api/v1/profiles/${userId}`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error.response?.status === 422
        ? new Error('Invalid profile data')
        : error.response?.status === 404
        ? new Error('Profile not found')
        : error.response?.status === 401
        ? new Error('Authentication required')
        : error.response?.status === 403
        ? new Error('Permission denied')
        : new Error('Failed to update profile');
    }
  },
  async deleteProfile(userId) {
    try {
      if (!userId) throw new Error('User ID is required');
      const response = await api.delete(`/api/v1/profiles/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting profile:', error);
      throw error.response?.status === 404
        ? new Error('Profile not found')
        : error.response?.status === 401
        ? new Error('Authentication required')
        : error.response?.status === 403
        ? new Error('Permission denied')
        : new Error('Failed to delete profile');
    }
  },
};

// NEW: Customer Service API
const customerServiceAPI = {
  async analyzeInteraction(data) {
    try {
      if (!data.text) {
        throw new Error('Text is required for analysis');
      }
      const response = await api.post('/api/customer-service/analyze', data);
      return response.data;
    } catch (error) {
      console.error('Error analyzing customer interaction:', error);
      throw error.response?.status === 422
        ? new Error('Invalid interaction data')
        : error.response?.status === 401
        ? new Error('Authentication required')
        : error.response?.status === 500
        ? new Error('Analysis failed due to server error')
        : new Error('Failed to analyze interaction');
    }
  },
  subscribe(handler) {
    // Subscribe to WebSocket customer analysis events
    wsManager.onMessage('customer_analysis', handler);
    return () => wsManager.offMessage('customer_analysis', handler);
  },
};

// Export everything
export {
  api,
  authAPI,
  userAPI,
  chatAPI,
  documentAPI,
  eventAPI,
  notificationAPI,
  metricsAPI,
  presenceAPI,
  activityAPI,
  analyticsAPI,
  ollamaAPI,
  mlServiceAPI,
  rbacAPI,
  tenantAPI,
  dashboardAPI,
  messageAPI,
  profileAPI,
  customerServiceAPI, // NEW: Export customerServiceAPI
  wsManager,
};