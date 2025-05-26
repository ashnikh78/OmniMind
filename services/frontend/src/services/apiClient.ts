import axios, { AxiosRequestConfig, AxiosError } from 'axios';
import { ApiConfig, ApiError, ApiResponse } from '@/types/api';
import { security } from '@/utils/security';
import type { SecureHeaders } from '@/types/security';
import { toast } from 'react-toastify';

interface ErrorResponse {
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
}

class ApiClient {
  private baseURL: string;
  private config: ApiConfig;

  constructor(baseURL: string, config: Partial<ApiConfig>) {
    this.baseURL = baseURL;
    this.config = {
      baseURL,
      timeout: config.timeout || 30000,
      headers: security.getSecureHeaders(),
      withCredentials: true,
    };
  }

  private async request<T>(config: AxiosRequestConfig): Promise<T> {
    try {
      const token = await security.getToken();
      const headers = {
        ...this.config.headers,
        ...config.headers,
      } as SecureHeaders;

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await axios({
        ...config,
        baseURL: this.baseURL,
        headers,
        timeout: this.config.timeout,
        withCredentials: this.config.withCredentials,
      });

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private handleError(error: unknown): ApiError {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<ErrorResponse>;
      const status = axiosError.response?.status || 500;
      const errorData = axiosError.response?.data || {};
      const message = errorData.message || axiosError.message || 'An unexpected error occurred';

      if (status === 401) {
        toast.error('Authentication required. Please log in again.');
        // Optionally dispatch logout action here
      } else if (status === 403) {
        toast.error('You do not have permission to perform this action.');
      } else if (status === 404) {
        toast.error('The requested resource was not found.');
      } else if (status === 429) {
        toast.error('Too many requests. Please try again later.');
      } else if (status >= 500) {
        toast.error('Server error. Please try again later.');
      } else {
        toast.error(message);
      }

      return {
        code: errorData.code || 'UNKNOWN_ERROR',
        message,
        status,
        details: errorData.details,
      };
    }

    const genericError = error as Error;
    toast.error(genericError.message || 'An unexpected error occurred');
    return {
      code: 'UNKNOWN_ERROR',
      message: genericError.message || 'An unexpected error occurred',
      status: 500,
    };
  }

  public async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({
      ...config,
      method: 'GET',
      url,
    });
  }

  public async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({
      ...config,
      method: 'POST',
      url,
      data,
    });
  }

  public async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({
      ...config,
      method: 'PUT',
      url,
      data,
    });
  }

  public async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({
      ...config,
      method: 'DELETE',
      url,
    });
  }
}

const apiClient = new ApiClient(
  process.env.REACT_APP_API_URL || 'http://localhost',
  {
    timeout: 30000,
  }
);

export default apiClient; 