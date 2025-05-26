import { Middleware } from 'redux';
import { RootState } from './index';
import { security } from '../utils/security';

// Logging middleware
export const loggingMiddleware: Middleware<{}, RootState> = (store) => (next) => (action) => {
  const timestamp = new Date().toISOString();
  console.group(`Action: ${action.type} [${timestamp}]`);
  console.log('Previous State:', store.getState());
  console.log('Action:', action);
  
  const result = next(action);
  
  console.log('Next State:', store.getState());
  console.groupEnd();
  
  return result;
};

// Analytics middleware
export const analyticsMiddleware: Middleware<{}, RootState> = (store) => (next) => (action) => {
  const result = next(action);
  
  // Track specific actions
  if (action.type.startsWith('auth/')) {
    // Track authentication events
    security.trackEvent('auth', {
      action: action.type,
      userId: store.getState().auth.user?.id,
      timestamp: new Date().toISOString(),
    });
  }
  
  return result;
};

// Error handling middleware
export const errorHandlingMiddleware: Middleware<{}, RootState> = (store) => (next) => (action) => {
  try {
    return next(action);
  } catch (error) {
    console.error('Redux Error:', error);
    
    // Log error to error tracking service
    security.logError('redux_error', {
      action: action.type,
      error: error.message,
      stack: error.stack,
      state: store.getState(),
    });
    
    // Dispatch error action
    store.dispatch({
      type: 'error/occurred',
      payload: {
        action: action.type,
        error: error.message,
      },
    });
    
    throw error;
  }
};

// State persistence middleware
export const persistenceMiddleware: Middleware<{}, RootState> = (store) => (next) => (action) => {
  const result = next(action);
  
  // Persist specific parts of state
  if (action.type.startsWith('auth/') || action.type.startsWith('ui/')) {
    const state = store.getState();
    localStorage.setItem('redux_state', JSON.stringify({
      auth: state.auth,
      ui: state.ui,
    }));
  }
  
  return result;
};

// Rate limiting middleware
export const rateLimitingMiddleware: Middleware<{}, RootState> = (store) => (next) => (action) => {
  const actionType = action.type;
  
  // Check rate limit for specific actions
  if (actionType.startsWith('api/')) {
    const key = `rate_limit_${actionType}`;
    if (!security.rateLimiter.check(key)) {
      console.warn(`Rate limit exceeded for action: ${actionType}`);
      return;
    }
  }
  
  return next(action);
};

// Combine all middleware
export const middleware = [
  loggingMiddleware,
  analyticsMiddleware,
  errorHandlingMiddleware,
  persistenceMiddleware,
  rateLimitingMiddleware,
]; 