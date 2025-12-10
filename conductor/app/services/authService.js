import apiClient from '../utils/api';
import { storeToken, removeToken } from '../utils/api';

export const authService = {
  /**
   * Login with username and password
   */
  async login(username, password) {
    try {
      const response = await apiClient.post('/api/auth/login', {
        username,
        password,
      });
      
      // Store token
      if (response.data.token) {
        await storeToken(response.data.token);
      }
      
      return {
        success: true,
        token: response.data.token,
        user: response.data.user,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error?.message || 'Login failed',
      };
    }
  },

  /**
   * Get current authenticated user
   */
  async getCurrentUser() {
    try {
      const response = await apiClient.get('/api/auth/me');
      return {
        success: true,
        user: response.data.user,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error?.message || 'Failed to get user',
      };
    }
  },

  /**
   * Logout (client-side token removal)
   */
  async logout() {
    try {
      await apiClient.post('/api/auth/logout');
      await removeToken();
      return { success: true };
    } catch (error) {
      // Even if API call fails, remove token locally
      await removeToken();
      return { success: true };
    }
  },

  /**
   * Reset password
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   */
  async resetPassword(currentPassword, newPassword) {
    try {
      const response = await apiClient.post('/api/auth/reset-password', {
        currentPassword,
        newPassword,
      });
      
      return {
        success: true,
        message: response.data.message,
        user: response.data.user,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error?.message || 'Password reset failed',
      };
    }
  },

  /**
   * Update user profile (username and/or email)
   * @param {string} username - New username (optional)
   * @param {string} email - New email (optional)
   */
  async updateProfile(username, email) {
    try {
      const response = await apiClient.put('/api/auth/profile', {
        username,
        email,
      });
      
      return {
        success: true,
        message: response.data.message,
        user: response.data.user,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error?.message || 'Profile update failed',
      };
    }
  },
};
