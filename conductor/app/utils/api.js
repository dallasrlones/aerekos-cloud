import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Get API base URL from environment or default to localhost
// For Docker dev mode, use conductor service name or localhost
const getApiBaseUrl = () => {
  // Check for environment variable first (set at build time or runtime)
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  
  // For web builds in browser, try to detect API URL
  if (typeof window !== 'undefined' && window.location) {
    // In browser, use localhost:3000 (backend is exposed on host)
    const host = window.location.hostname;
    // Always use localhost:3000 when accessing from browser
    // Docker port mapping exposes conductor:3000 -> localhost:3000
    return 'http://localhost:3000';
  }
  
  // Default fallback
  return 'http://localhost:3000';
};

const API_BASE_URL = getApiBaseUrl();

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token storage keys
const TOKEN_KEY = '@aerekos_cloud_token';

/**
 * Get stored JWT token
 */
export const getStoredToken = async () => {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    return token;
  } catch (error) {
    console.error('Error getting stored token:', error);
    return null;
  }
};

/**
 * Store JWT token
 */
export const storeToken = async (token) => {
  try {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } catch (error) {
    console.error('Error storing token:', error);
  }
};

/**
 * Remove stored JWT token
 */
export const removeToken = async () => {
  try {
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch (error) {
    console.error('Error removing token:', error);
  }
};

// Request interceptor - attach token to requests
apiClient.interceptors.request.use(
  async (config) => {
    const token = await getStoredToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not already retried, try to refresh or logout
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // Remove invalid token
      await removeToken();
      
      // Reject with error
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

export default apiClient;
