import { configureStore, Middleware } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import uiReducer from './slices/uiSlice';
import tenantReducer from './slices/tenantSlice';
import { loggingMiddleware, errorHandlingMiddleware } from './middleware';

const rootReducer = {
  auth: authReducer,
  ui: uiReducer,
  tenant: tenantReducer,
};

const middleware: Middleware[] = [
  loggingMiddleware,
  errorHandlingMiddleware,
];

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ['auth/setToken', 'auth/logout'],
        // Ignore these field paths in all actions
        ignoredActionPaths: ['payload.user', 'payload.token'],
        // Ignore these paths in the state
        ignoredPaths: ['auth.user', 'auth.token'],
      },
    }).concat(middleware),
});

export type RootState = {
  auth: ReturnType<typeof authReducer>;
  ui: ReturnType<typeof uiReducer>;
  tenant: ReturnType<typeof tenantReducer>;
};

export type AppDispatch = typeof store.dispatch; 