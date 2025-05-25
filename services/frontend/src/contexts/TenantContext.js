import React, { createContext, useContext, useState, useEffect } from 'react';
import { tenantAPI } from '../services/api';
import { wsManager } from '../services/api';

const TenantContext = createContext();

export function useTenant() {
  return useContext(TenantContext);
}

export function TenantProvider({ children }) {
  const [tenants, setTenants] = useState([]);
  const [activeTenant, setActiveTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tenantStats, setTenantStats] = useState(null);
  const [tenantSettings, setTenantSettings] = useState(null);

  useEffect(() => {
    fetchTenants();
    setupWebSocket();
    return () => {
      wsManager.offMessage('tenant_update', handleTenantUpdate);
      wsManager.offMessage('tenant_stats', handleTenantStats);
    };
  }, []);

  const setupWebSocket = () => {
    wsManager.onMessage('tenant_update', handleTenantUpdate);
    wsManager.onMessage('tenant_stats', handleTenantStats);
  };

  const handleTenantUpdate = (tenant) => {
    setTenants((prev) =>
      prev.map((t) => (t.id === tenant.id ? { ...t, ...tenant } : t))
    );
    if (activeTenant?.id === tenant.id) {
      setActiveTenant((prev) => ({ ...prev, ...tenant }));
    }
  };

  const handleTenantStats = (stats) => {
    setTenantStats(stats);
  };

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const response = await tenantAPI.getTenants();
      setTenants(response);
      if (response.length > 0) {
        setActiveTenant(response[0]);
      }
    } catch (error) {
      setError('Failed to fetch tenants');
      console.error('Error fetching tenants:', error);
    } finally {
      setLoading(false);
    }
  };

  const createTenant = async (tenantData) => {
    try {
      const response = await tenantAPI.createTenant(tenantData);
      setTenants((prev) => [...prev, response]);
      return response;
    } catch (error) {
      setError('Failed to create tenant');
      console.error('Error creating tenant:', error);
      throw error;
    }
  };

  const updateTenant = async (tenantId, tenantData) => {
    try {
      const response = await tenantAPI.updateTenant(tenantId, tenantData);
      setTenants((prev) =>
        prev.map((t) => (t.id === tenantId ? { ...t, ...response } : t))
      );
      if (activeTenant?.id === tenantId) {
        setActiveTenant((prev) => ({ ...prev, ...response }));
      }
      return response;
    } catch (error) {
      setError('Failed to update tenant');
      console.error('Error updating tenant:', error);
      throw error;
    }
  };

  const deleteTenant = async (tenantId) => {
    try {
      await tenantAPI.deleteTenant(tenantId);
      setTenants((prev) => prev.filter((t) => t.id !== tenantId));
      if (activeTenant?.id === tenantId) {
        setActiveTenant(null);
      }
    } catch (error) {
      setError('Failed to delete tenant');
      console.error('Error deleting tenant:', error);
      throw error;
    }
  };

  const getTenantStats = async (tenantId = activeTenant?.id) => {
    try {
      const response = await tenantAPI.getTenantStats(tenantId);
      setTenantStats(response);
      return response;
    } catch (error) {
      console.error('Error fetching tenant stats:', error);
      return null;
    }
  };

  const getTenantSettings = async (tenantId = activeTenant?.id) => {
    try {
      const response = await tenantAPI.getTenantSettings(tenantId);
      setTenantSettings(response);
      return response;
    } catch (error) {
      console.error('Error fetching tenant settings:', error);
      return null;
    }
  };

  const updateTenantSettings = async (tenantId, settings) => {
    try {
      const response = await tenantAPI.updateTenantSettings(tenantId, settings);
      setTenantSettings(response);
      return response;
    } catch (error) {
      console.error('Error updating tenant settings:', error);
      throw error;
    }
  };

  const value = {
    tenants,
    activeTenant,
    loading,
    error,
    tenantStats,
    tenantSettings,
    setActiveTenant,
    createTenant,
    updateTenant,
    deleteTenant,
    getTenantStats,
    getTenantSettings,
    updateTenantSettings,
    refreshTenants: fetchTenants,
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
} 