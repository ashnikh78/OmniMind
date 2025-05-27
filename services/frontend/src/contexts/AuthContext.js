import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import { toast } from 'react-toastify';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchUserData();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUserData = async () => {
    try {
      console.log('Fetching user data...');
      setError(null);
      const response = await authAPI.verifyToken();
      console.log('User data received:', response);
      if (response.data) {
        setUser(response.data);
      } else {
        throw new Error('Invalid user data received');
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      setError(error.response?.data?.message || 'Failed to fetch user data');
      if (error.response?.status === 401) {
        logout();
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials) => {
    try {
      console.log('Attempting login...');
      setError(null);
      const response = await authAPI.login(credentials);
      console.log('Login response:', response);
      const { access_token, user } = response.data;
      
      if (!access_token) {
        throw new Error('No access token received');
      }
      
      localStorage.setItem('token', access_token);
      setUser(user);
      toast.success('Login successful');
      
      return user;
    } catch (error) {
      console.error('Login error:', error);
      setError(error.response?.data?.message || 'Login failed');
      toast.error(error.response?.data?.message || 'Login failed');
      throw error;
    }
  };

  const register = async (userData) => {
    try {
      console.log('Attempting registration...');
      setError(null);
      const response = await authAPI.register(userData);
      console.log('Registration response:', response);
      const { access_token, user } = response.data;
      
      if (!access_token) {
        throw new Error('No access token received');
      }
      
      localStorage.setItem('token', access_token);
      setUser(user);
      toast.success('Registration successful');
      
      return user;
    } catch (error) {
      console.error('Registration error:', error);
      setError(error.response?.data?.message || 'Registration failed');
      toast.error(error.response?.data?.message || 'Registration failed');
      throw error;
    }
  };

  const logout = () => {
    console.log('Logging out...');
    localStorage.removeItem('token');
    setUser(null);
    setError(null);
    toast.success('Logged out successfully');
    window.location.href = '/login';
  };

  const forgotPassword = async (email) => {
    try {
      console.log('Requesting password reset...');
      setError(null);
      await authAPI.forgotPassword(email);
      console.log('Password reset email sent');
      toast.success('Password reset email sent');
    } catch (error) {
      console.error('Forgot password error:', error);
      setError(error.response?.data?.message || 'Failed to send password reset email');
      toast.error(error.response?.data?.message || 'Failed to send password reset email');
      throw error;
    }
  };

  const resetPassword = async (token, newPassword) => {
    try {
      console.log('Resetting password...');
      setError(null);
      await authAPI.resetPassword({ token, new_password: newPassword });
      console.log('Password reset successful');
      toast.success('Password reset successful');
    } catch (error) {
      console.error('Reset password error:', error);
      setError(error.response?.data?.message || 'Failed to reset password');
      toast.error(error.response?.data?.message || 'Failed to reset password');
      throw error;
    }
  };

  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    forgotPassword,
    resetPassword,
    refreshUser: fetchUserData
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthContext; 