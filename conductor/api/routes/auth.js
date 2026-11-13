const express = require('express');
const router = express.Router();
const UserService = require('../services/UserService');
const authenticate = require('../middleware/auth');
const { loginRateLimit } = require('../middleware/loginRateLimit');

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
router.post('/login', loginRateLimit, async (req, res, next) => {
  try {
    const { username, password, totp } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: {
          message: 'Username and password are required',
          status: 400
        }
      });
    }

    console.log(`[auth] Login attempt for username: ${username}`);

    const result = await UserService.authenticate(username, password, totp);
    
    console.log(`[auth] Login successful for username: ${username}`);
    
    res.json({
      token: result.token,
      must_change_password: result.must_change_password,
      user: result.user
    });
  } catch (error) {
    console.error(`[auth] Login error for username: ${req.body?.username || 'unknown'}`, error.message);
    
    if (error.message === 'TOTP required' || error.code === 'TOTP_REQUIRED') {
      return res.status(401).json({
        error: { message: 'TOTP required', code: 'TOTP_REQUIRED', status: 401 },
      });
    }
    if (error.message === 'Invalid credentials') {
      return res.status(401).json({
        error: {
          message: 'Invalid credentials',
          status: 401
        }
      });
    }
    
    // Log unexpected errors
    console.error('[auth] Unexpected login error:', error);
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

/**
 * POST /api/auth/users
 * Admin-only: create a console user (friends e2e + ops).
 * Body: { username, email, password, role? }
 */
router.post('/users', authenticate, async (req, res, next) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        error: { message: 'admin only', code: 'ADMIN_REQUIRED', status: 403 },
      });
    }
    const { username, email, password, role } = req.body || {};
    if (!username || !email || !password) {
      return res.status(400).json({
        error: { message: 'username, email, and password are required', status: 400 },
      });
    }
    if (String(password).length < 6) {
      return res.status(400).json({
        error: { message: 'password must be at least 6 characters', status: 400 },
      });
    }
    const { hashPassword } = require('../utils/password');
    const user = await UserService.createUser({
      username: String(username).trim(),
      email: String(email).trim(),
      password_hash: await hashPassword(String(password)),
      role: role === 'admin' ? 'admin' : 'user',
    });
    res.status(201).json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    if (error.message.includes('already exists')) {
      return res.status(409).json({ error: { message: error.message, status: 409 } });
    }
    next(error);
  }
});

router.post('/totp/enable', authenticate, async (req, res, next) => {
  try {
    const { generateSecret, verifyTotp } = require('../utils/totp');
    const UserRepository = require('../repos/UserRepository');
    const secret = generateSecret();
    if (req.body?.code && !verifyTotp(secret, req.body.code)) {
      return res.status(400).json({ error: { message: 'invalid totp code', status: 400 } });
    }
    await UserRepository.update(req.userId, { totp_secret: secret, totp_enabled: 1 });
    res.json({ totp_enabled: true, secret });
  } catch (err) { next(err); }
});

router.post('/totp/disable', authenticate, async (req, res, next) => {
  try {
    const UserRepository = require('../repos/UserRepository');
    await UserRepository.update(req.userId, { totp_secret: '', totp_enabled: 0 });
    res.json({ totp_enabled: false });
  } catch (err) { next(err); }
});

module.exports = router;
