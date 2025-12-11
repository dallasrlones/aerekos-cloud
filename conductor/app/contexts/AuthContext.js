import React, { createContext, useState, useEffect, useContext } from 'react';
import { Platform } from 'react-native';
import { authService } from '../services/authService';
import { getStoredToken } from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check if user is authenticated on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await getStoredToken();
      if (token) {
        const result = await authService.getCurrentUser();
        if (result.success) {
          setUser(result.user);
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } else {
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error('Auth check error:', err);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await authService.login(username, password);
      
      if (result.success) {
        setUser(result.user);
        setIsAuthenticated(true);
        return { success: true };
      } else {
        setError(result.error);
        setIsAuthenticated(false);
        return { success: false, error: result.error };
      }
    } catch (err) {
      const errorMessage = err.message || 'Login failed';
      setError(errorMessage);
      setIsAuthenticated(false);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await authService.logout();
      setUser(null);
      setIsAuthenticated(false);
      setError(null);
      
      // Update URL to /login on web
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.history.pushState({}, '', '/login');
      }
    } catch (err) {
      console.error('Logout error:', err);
      // Still clear local state even if API call fails
      setUser(null);
      setIsAuthenticated(false);
      
      // Update URL to /login on web even if API call fails
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.history.pushState({}, '', '/login');
      }
    } finally {
      setLoading(false);
    }
  };

  // Get token for WebSocket auth
  const getToken = async () => {
    return await getStoredToken();
  };

  const value = {
    user,
    loading,
    error,
    isAuthenticated,
    login,
    logout,
    checkAuth,
    getToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
