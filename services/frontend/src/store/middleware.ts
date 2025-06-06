import { Middleware } from '@reduxjs/toolkit';
import { RootState } from './index';
import { setError } from './slices/uiSlice';

interface ApiError extends Error {
  status?: number;
  code?: string;
  details?: unknown;
}

// Logging middleware
export const loggingMiddleware: Middleware = (store) => (next) => (action) => {
  console.log('Dispatching:', action);
  const result = next(action);
  console.log('Next State:', store.getState());
  return result;
};

// Error handling middleware
export const errorHandlingMiddleware: Middleware = (store) => (next) => (action) => {
  try {
    return next(action);
  } catch (error) {
    const apiError = error as ApiError;
    let errorMessage = 'An unexpected error occurred';

    if (apiError instanceof Error) {
      const status = apiError.status ?? 0;
      if (status === 401) {
        errorMessage = 'Please log in to continue';
      } else if (status === 403) {
        errorMessage = 'You do not have permission to perform this action';
      } else if (status >= 500) {
        errorMessage = 'Server error. Please try again later';
      } else {
        errorMessage = apiError.message || errorMessage;
      }
    }

    console.error('Error in middleware:', error);
    store.dispatch(setError(errorMessage));
    return next(action); // Continue execution instead of throwing
  }
}; 