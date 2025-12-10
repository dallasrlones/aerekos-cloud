const express = require('express');
const router = express.Router();
const TokenService = require('../services/TokenService');
const authenticate = require('../middleware/auth');

/**
 * GET /api/token
 * Get current registration token
 * Protected route - requires authentication
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const token = await TokenService.getCurrentToken();
    
    if (!token) {
      return res.status(404).json({
        error: {
          message: 'No active registration token found',
          status: 404
        }
      });
    }

    res.json({ token });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/token/regenerate
 * Regenerate registration token
 * Protected route - requires authentication
 */
router.post('/regenerate', authenticate, async (req, res, next) => {
  try {
    const newToken = await TokenService.regenerateToken();
    res.json({ 
      token: newToken,
      message: 'Registration token regenerated successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
