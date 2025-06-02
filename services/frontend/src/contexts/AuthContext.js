import React, { createContext, useState, useEffect, useContext } from 'react';
import { authAPI } from '../api';
import wsManager from '../services/wsManager';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    const fetchUser = async () => {
      if (token) {
        try {
          const response = await authAPI.getCurrentUser(token); // Assuming token is required
          setUser(response.user || response);
        } catch (error) {
          console.error('Failed to fetch user:', error);
          setToken(null);
          localStorage.removeItem('token');
        }
      }
    };
    fetchUser();
  }, [token]);

  const login = async (credentials) => {
    try {
      const response = await authAPI.login(credentials);
      setToken(response.access_token);
      setUser(response.user);
      localStorage.setItem('token', response.access_token);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');

    // Remove or wrap wsManager.disconnect() safely if you need it
    if (typeof wsManager !== 'undefined' && wsManager.disconnect) {
      wsManager.disconnect();
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Optional helper hook for easy access to auth context
export const useAuth = () => useContext(AuthContext);
