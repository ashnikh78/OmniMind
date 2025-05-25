import { toast } from 'react-toastify';

class WebSocketService {
  constructor() {
    this.ws = null;
    this.subscribers = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.presenceInterval = null;
    this.heartbeatInterval = null;
    this.lastHeartbeat = null;
    this.heartbeatTimeout = 30000; // 30 seconds
    this.currentUser = null;
    this.currentToken = null;
  }

  connect(user, token) {
    if (!user || !token) return;
    
    // Store user and token for reconnection attempts
    this.currentUser = user;
    this.currentToken = token;

    const wsUrl = `${process.env.REACT_APP_WS_URL || 'ws://localhost:8000'}/ws/${user.id}?token=${token}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      this.startPresenceUpdates();
      this.startHeartbeat();
      toast.success('Real-time connection established');
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        // Handle heartbeat response
        if (message.type === 'heartbeat') {
          this.lastHeartbeat = Date.now();
          return;
        }

        this.notifySubscribers(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        toast.error('Error processing real-time update');
      }
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason);
      this.stopPresenceUpdates();
      this.stopHeartbeat();
      
      if (event.code === 1000) {
        // Normal closure
        return;
      }
      
      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      toast.error('Real-time connection error');
    };
  }

  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'User initiated disconnect');
      this.stopPresenceUpdates();
      this.stopHeartbeat();
    }
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'heartbeat' }));
        
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

  startPresenceUpdates() {
    this.presenceInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'presence' }));
      }
    }, 30000); // Update presence every 30 seconds
  }

  stopPresenceUpdates() {
    if (this.presenceInterval) {
      clearInterval(this.presenceInterval);
      this.presenceInterval = null;
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
      
      console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect(this.currentUser, this.currentToken);
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
      toast.error('Unable to establish real-time connection. Please refresh the page.');
    }
  }

  subscribe(type, callback) {
    if (!this.subscribers.has(type)) {
      this.subscribers.set(type, new Set());
    }
    this.subscribers.get(type).add(callback);
  }

  unsubscribe(type, callback) {
    if (this.subscribers.has(type)) {
      this.subscribers.get(type).delete(callback);
    }
  }

  notifySubscribers(message) {
    const { type } = message;
    if (this.subscribers.has(type)) {
      this.subscribers.get(type).forEach(callback => {
        try {
          callback(message);
        } catch (error) {
          console.error('Error in WebSocket subscriber callback:', error);
        }
      });
    }
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not connected');
    }
  }

  broadcast(message) {
    this.send({
      type: 'broadcast',
      data: message
    });
  }

  sendPersonalMessage(targetId, message) {
    this.send({
      type: 'personal',
      target_id: targetId,
      data: message
    });
  }
}

export const wsService = new WebSocketService();
export default wsService; 