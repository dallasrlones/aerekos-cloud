import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Resolve API base per request — never cache at module load (SSR/bundle init has no window).
 * No localhost, loopback, or RFC1918 fallbacks. Off-LAN clients use EXPO_PUBLIC_API_URL
 * (prod: public conductor). Browser on cloud.* derives cloudapi.* of the same zone.
 */
export const getApiBaseUrl = () => {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv && String(fromEnv).trim()) {
    return String(fromEnv).replace(/\/$/, '');
  }

  if (typeof window !== 'undefined' && window.location?.hostname) {
    const { protocol, hostname } = window.location;
    if (hostname.startsWith('cloud.')) {
      return `${protocol}//cloudapi.${hostname.slice('cloud.'.length)}`.replace(/\/$/, '');
    }
  }

  throw new Error('EXPO_PUBLIC_API_URL is required (no localhost or LAN fallback)');
};

const apiClient = axios.create({
  timeout: parseInt(process.env.EXPO_PUBLIC_API_TIMEOUT_MS || process.env.CONDUCTOR_PROXY_TIMEOUT_MS || '1800000', 10),
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
    config.baseURL = getApiBaseUrl();
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

// Response interceptor — only invalidate session on auth endpoints.
// Manager proxies (ai_manager, storage, etc.) may 401 for scope/resource reasons
// without meaning the user's console JWT is bad; wiping the token caused logout loops.
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {};
    const status = error.response?.status;

    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const url = String(originalRequest.url || '');
      const isSessionAuth =
        url.includes('/api/auth/me')
        || url.includes('/api/auth/login')
        || url.includes('/api/auth/logout');

      if (isSessionAuth) {
        await removeToken();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('aerekos:session-expired'));
        }
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
