import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, CancelTokenSource } from 'axios';
import { toast } from 'react-toastify';
import { ApiConfig, ApiError, ApiResponse } from '../types/api';
import { security } from '../utils/security';

class ApiClient {
  private instance: AxiosInstance;
  private cancelTokens: Map<string, CancelTokenSource>;

  constructor(config: ApiConfig) {
    this.instance = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
      withCredentials: config.withCredentials,
    });

    this.cancelTokens = new Map();
    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.instance.interceptors.request.use(
      (config) => {
        // Add CSRF token if available
        const csrfToken = security.getCsrfToken();
        if (csrfToken) {
          config.headers['X-CSRF-Token'] = csrfToken;
        }

        // Add auth token if available
        const token = security.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add request ID for tracking
        config.headers['X-Request-ID'] = this.generateRequestId();

        return config;
      },
      (error) => {
        return Promise.reject(this.handleError(error));
      }
    );

    // Response interceptor
    this.instance.interceptors.response.use(
      (response) => {
        // Handle successful response
        return this.handleResponse(response);
      },
      (error) => {
        return Promise.reject(this.handleError(error));
      }
    );
  }

  private generateRequestId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  private handleResponse<T>(response: AxiosResponse<ApiResponse<T>>): T {
    // Handle token refresh
    if (response.headers['x-refresh-token']) {
      security.setToken(response.headers['x-refresh-token']);
    }

    return response.data.data;
  }

  private handleError(error: any): ApiError {
    if (axios.isCancel(error)) {
      return {
        code: 'REQUEST_CANCELLED',
        message: 'Request was cancelled',
        status: 499,
      };
    }

    if (!error.response) {
      return {
        code: 'NETWORK_ERROR',
        message: 'Network error occurred',
        status: 0,
      };
    }

    const apiError: ApiError = {
      code: error.response.data?.code || 'UNKNOWN_ERROR',
      message: error.response.data?.message || 'An unexpected error occurred',
      details: error.response.data?.details,
      status: error.response.status,
    };

    // Handle specific error cases
    switch (error.response.status) {
      case 401:
        security.removeToken();
        window.location.href = '/login';
        break;
      case 403:
        toast.error('You do not have permission to perform this action');
        break;
      case 429:
        toast.error('Too many requests. Please try again later');
        break;
      default:
        toast.error(apiError.message);
    }

    return apiError;
  }

  public async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ method: 'GET', url, ...config });
  }

  public async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ method: 'POST', url, data, ...config });
  }

  public async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ method: 'PUT', url, data, ...config });
  }

  public async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ method: 'DELETE', url, ...config });
  }

  private async request<T>(config: AxiosRequestConfig): Promise<T> {
    const requestId = this.generateRequestId();
    const source = axios.CancelToken.source();
    this.cancelTokens.set(requestId, source);

    try {
      const response = await this.instance.request<ApiResponse<T>>({
        ...config,
        cancelToken: source.token,
      });
      return this.handleResponse<T>(response);
    } finally {
      this.cancelTokens.delete(requestId);
    }
  }

  public cancelRequest(requestId: string): void {
    const source = this.cancelTokens.get(requestId);
    if (source) {
      source.cancel('Request cancelled by user');
      this.cancelTokens.delete(requestId);
    }
  }

  public cancelAllRequests(): void {
    this.cancelTokens.forEach((source) => {
      source.cancel('All requests cancelled');
    });
    this.cancelTokens.clear();
  }
}

// Create API client instance
const apiClient = new ApiClient({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost',
  timeout: 10000,
  headers: security.getSecureHeaders(),
  withCredentials: true,
});

export default apiClient; 