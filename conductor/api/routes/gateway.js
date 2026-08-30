'use strict';

const express = require('express');
const appProxyAuth = require('../middleware/appProxyAuth');
const gatewayService = require('../services/GatewayService');

const router = express.Router();

/**
 * Pretty invoke URLs — /v1/projects/{project_id}/… → manager proxy with ARN injection.
 * @see docs/plans/platform_app_access.md Phase 9
 */
router.use('/v1', appProxyAuth, async (req, res, next) => {
  try {
    await gatewayService.proxyRequest(req, res);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        error: {
          message: error.message,
          status: error.status,
          code: error.code || 'GATEWAY_ERROR',
        },
      });
    }
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({
        error: {
          message: 'Gateway backend is not reachable',
          status: 503,
          code: 'GATEWAY_UNREACHABLE',
        },
      });
    }
    return next(error);
  }
});

module.exports = router;
