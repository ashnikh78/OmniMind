import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Tenant {
  id: string;
  name: string;
  domain: string;
  status: 'active' | 'inactive' | 'suspended';
  settings: {
    theme: string;
    features: string[];
    limits: {
      users: number;
      storage: number;
      apiCalls: number;
    };
  };
  createdAt: string;
  updatedAt: string;
}

interface TenantState {
  currentTenant: Tenant | null;
  tenants: Tenant[];
  loading: boolean;
  error: string | null;
}

const initialState: TenantState = {
  currentTenant: null,
  tenants: [],
  loading: false,
  error: null,
};

const tenantSlice = createSlice({
  name: 'tenant',
  initialState,
  reducers: {
    setCurrentTenant: (state, action: PayloadAction<Tenant>) => {
      state.currentTenant = action.payload;
    },
    setTenants: (state, action: PayloadAction<Tenant[]>) => {
      state.tenants = action.payload;
    },
    addTenant: (state, action: PayloadAction<Tenant>) => {
      state.tenants.push(action.payload);
    },
    updateTenant: (state, action: PayloadAction<Tenant>) => {
      const index = state.tenants.findIndex(t => t.id === action.payload.id);
      if (index !== -1) {
        state.tenants[index] = action.payload;
      }
      if (state.currentTenant?.id === action.payload.id) {
        state.currentTenant = action.payload;
      }
    },
    removeTenant: (state, action: PayloadAction<string>) => {
      state.tenants = state.tenants.filter(t => t.id !== action.payload);
      if (state.currentTenant?.id === action.payload) {
        state.currentTenant = null;
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const {
  setCurrentTenant,
  setTenants,
  addTenant,
  updateTenant,
  removeTenant,
  setLoading,
  setError,
} = tenantSlice.actions;

export default tenantSlice.reducer; 