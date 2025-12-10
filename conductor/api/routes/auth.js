const express = require('express');
const router = express.Router();
const UserService = require('../services/UserService');
const authenticate = require('../middleware/auth');

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: {
          message: 'Username and password are required',
          status: 400
        }
      });
    }

    const result = await UserService.authenticate(username, password);
    
    res.json({
      token: result.token,
      user: result.user
    });
  } catch (error) {
    if (error.message === 'Invalid credentials') {
      return res.status(401).json({
        error: {
          message: 'Invalid credentials',
          status: 401
        }
      });
    }
    next(error);
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user
 * Protected route - requires authentication
 */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await UserService.getCurrentUser(req.userId);
    res.json({ user });
  } catch (error) {
    if (error.message === 'User not found') {
      return res.status(404).json({
        error: {
          message: 'User not found',
          status: 404
        }
      });
    }
    next(error);
  }
});

/**
 * POST /api/auth/logout
 * Logout (client-side token removal)
 * Note: With JWT, logout is handled client-side by removing the token
 */
router.post('/logout', authenticate, (req, res) => {
  res.json({
    message: 'Logged out successfully'
  });
});

/**
 * POST /api/auth/reset-password
 * Reset user password
 * Protected route - requires authentication
 */
router.post('/reset-password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: {
          message: 'Current password and new password are required',
          status: 400
        }
      });
    }

    const result = await UserService.updatePassword(
      req.userId,
      currentPassword,
      newPassword
    );

    res.json({
      message: 'Password updated successfully',
      user: result
    });
  } catch (error) {
    if (error.message === 'Current password is incorrect') {
      return res.status(401).json({
        error: {
          message: 'Current password is incorrect',
          status: 401
        }
      });
    }
    if (error.message === 'User not found') {
      return res.status(404).json({
        error: {
          message: 'User not found',
          status: 404
        }
      });
    }
    if (error.message.includes('must be at least')) {
      return res.status(400).json({
        error: {
          message: error.message,
          status: 400
        }
      });
    }
    next(error);
  }
});

/**
 * PUT /api/auth/profile
 * Update user profile (username and/or email)
 * Protected route - requires authentication
 */
router.put('/profile', authenticate, async (req, res, next) => {
  try {
    const { username, email } = req.body;

    if (!username && !email) {
      return res.status(400).json({
        error: {
          message: 'At least one field (username or email) is required',
          status: 400
        }
      });
    }

    const result = await UserService.updateProfile(req.userId, {
      username,
      email
    });

    res.json({
      message: 'Profile updated successfully',
      user: result
    });
  } catch (error) {
    if (error.message === 'User not found') {
      return res.status(404).json({
        error: {
          message: 'User not found',
          status: 404
        }
      });
    }
    if (error.message.includes('already exists') || 
        error.message.includes('cannot be empty') ||
        error.message.includes('must be at least') ||
        error.message.includes('Invalid email')) {
      return res.status(400).json({
        error: {
          message: error.message,
          status: 400
        }
      });
    }
    next(error);
  }
});

module.exports = router;
