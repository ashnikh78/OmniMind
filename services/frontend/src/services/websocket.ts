import { WebSocketConfig, WebSocketMessage } from '../types/api';
import { security } from '../utils/security';
import { toast } from 'react-toastify';
import { store } from '@/store';
import { setError } from '@/store/slices/uiSlice';

type MessageHandler<T = unknown> = (data: T) => void;

export class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private readonly url: string;
  private readonly onMessage: (message: WebSocketMessage) => void;

  constructor(url: string, onMessage: (message: WebSocketMessage) => void) {
    this.url = url;
    this.onMessage = onMessage;
  }

  public connect(): void {
    try {
      this.ws = new WebSocket(this.url);
      this.setupEventHandlers();
      this.startHeartbeat();
    } catch (error) {
      this.handleError(error);
    }
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.cleanup();
      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.handleError(error);
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;
        this.onMessage(message);
        this.notifyHandlers(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', payload: { timestamp: Date.now() } }));
      }
    }, 30000); // Send heartbeat every 30 seconds
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      store.dispatch(setError('Failed to connect to WebSocket server'));
      return;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  private handleError(error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : 'Unknown WebSocket error';
    store.dispatch(setError(errorMessage));
    this.cleanup();
  }

  private cleanup(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  public disconnect(): void {
    this.cleanup();
  }

  public on<T>(type: string, handler: MessageHandler<T>): void {
    const handlers = this.messageHandlers.get(type) || [];
    handlers.push(handler as MessageHandler);
    this.messageHandlers.set(type, handlers);
  }

  public off<T>(type: string, handler: MessageHandler<T>): void {
    const handlers = this.messageHandlers.get(type) || [];
    const index = handlers.indexOf(handler as MessageHandler);
    if (index !== -1) {
      handlers.splice(index, 1);
      this.messageHandlers.set(type, handlers);
    }
  }

  public send<T>(message: WebSocketMessage<T>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      store.dispatch(setError('WebSocket is not connected'));
    }
  }

  private notifyHandlers(message: WebSocketMessage): void {
    const handlers = this.messageHandlers.get(message.type) || [];
    handlers.forEach(handler => handler(message.payload));
  }
}

// Create WebSocket service instance
const wsService = new WebSocketService(process.env.REACT_APP_WS_URL || 'ws://localhost', (data) => {
  // Handle incoming WebSocket message
});

export default wsService; 