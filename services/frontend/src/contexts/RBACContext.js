import React, { createContext, useContext, useState, useEffect } from 'react';
import { rbacAPI } from '../services/api';
import { wsManager } from '../services/api';

const RBACContext = createContext();

export function useRBAC() {
  return useContext(RBACContext);
}

export function RBACProvider({ children }) {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [rolePermissions, setRolePermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [roleStats, setRoleStats] = useState(null);

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
    setupWebSocket();
    return () => {
      wsManager.offMessage('role_update', handleRoleUpdate);
      wsManager.offMessage('permission_update', handlePermissionUpdate);
      wsManager.offMessage('role_stats', handleRoleStats);
    };
  }, []);

  const setupWebSocket = () => {
    wsManager.onMessage('role_update', handleRoleUpdate);
    wsManager.onMessage('permission_update', handlePermissionUpdate);
    wsManager.onMessage('role_stats', handleRoleStats);
  };

  const handleRoleUpdate = (role) => {
    setRoles((prev) =>
      prev.map((r) => (r.id === role.id ? { ...r, ...role } : r))
    );
  };

  const handlePermissionUpdate = (permission) => {
    setPermissions((prev) =>
      prev.map((p) => (p.id === permission.id ? { ...p, ...permission } : p))
    );
  };

  const handleRoleStats = (stats) => {
    setRoleStats(stats);
  };

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const response = await rbacAPI.getRoles();
      setRoles(response);
    } catch (error) {
      setError('Failed to fetch roles');
      console.error('Error fetching roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissions = async () => {
    try {
      const response = await rbacAPI.getPermissions();
      setPermissions(response);
    } catch (error) {
      console.error('Error fetching permissions:', error);
    }
  };

  const createRole = async (roleData) => {
    try {
      const response = await rbacAPI.createRole(roleData);
      setRoles((prev) => [...prev, response]);
      return response;
    } catch (error) {
      setError('Failed to create role');
      console.error('Error creating role:', error);
      throw error;
    }
  };

  const updateRole = async (roleId, roleData) => {
    try {
      const response = await rbacAPI.updateRole(roleId, roleData);
      setRoles((prev) =>
        prev.map((r) => (r.id === roleId ? { ...r, ...response } : r))
      );
      return response;
    } catch (error) {
      setError('Failed to update role');
      console.error('Error updating role:', error);
      throw error;
    }
  };

  const deleteRole = async (roleId) => {
    try {
      await rbacAPI.deleteRole(roleId);
      setRoles((prev) => prev.filter((r) => r.id !== roleId));
    } catch (error) {
      setError('Failed to delete role');
      console.error('Error deleting role:', error);
      throw error;
    }
  };

  const getRolePermissions = async (roleId) => {
    try {
      const response = await rbacAPI.getRolePermissions(roleId);
      setRolePermissions((prev) => ({ ...prev, [roleId]: response }));
      return response;
    } catch (error) {
      console.error('Error fetching role permissions:', error);
      return null;
    }
  };

  const updateRolePermissions = async (roleId, permissionIds) => {
    try {
      const response = await rbacAPI.updateRolePermissions(roleId, permissionIds);
      setRolePermissions((prev) => ({ ...prev, [roleId]: response }));
      return response;
    } catch (error) {
      console.error('Error updating role permissions:', error);
      throw error;
    }
  };

  const getRoleStats = async () => {
    try {
      const response = await rbacAPI.getRoleStats();
      setRoleStats(response);
      return response;
    } catch (error) {
      console.error('Error fetching role stats:', error);
      return null;
    }
  };

  const checkPermission = (permissionId) => {
    // This function should be implemented based on the current user's role
    // and the role's permissions
    return true; // Placeholder implementation
  };

  const value = {
    roles,
    permissions,
    rolePermissions,
    loading,
    error,
    roleStats,
    createRole,
    updateRole,
    deleteRole,
    getRolePermissions,
    updateRolePermissions,
    getRoleStats,
    checkPermission,
    refreshRoles: fetchRoles,
  };

  return (
    <RBACContext.Provider value={value}>
      {children}
    </RBACContext.Provider>
  );
} 