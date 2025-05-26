import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UIState {
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  notificationsOpen: boolean;
  loading: boolean;
  error: string | null;
  success: string | null;
}

const initialState: UIState = {
  theme: 'light',
  sidebarOpen: true,
  notificationsOpen: false,
  loading: false,
  error: null,
  success: null,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload;
    },
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    toggleNotifications: (state) => {
      state.notificationsOpen = !state.notificationsOpen;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setSuccess: (state, action: PayloadAction<string | null>) => {
      state.success = action.payload;
    },
    clearMessages: (state) => {
      state.error = null;
      state.success = null;
    },
  },
});

export const {
  setTheme,
  toggleSidebar,
  toggleNotifications,
  setLoading,
  setError,
  setSuccess,
  clearMessages,
} = uiSlice.actions;

export default uiSlice.reducer; 