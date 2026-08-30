'use strict';

const express = require('express');
const authenticate = require('../middleware/auth');
const policyEvaluator = require('../services/PolicyEvaluator');

const router = express.Router();

/**
 * POST /api/iam/evaluate — evaluate IAM policies for a user/role + action + ARN.
 * Proxies to iam_manager; admin or project member may call (project membership TBD).
 */
router.post('/evaluate', authenticate, async (req, res, next) => {
  try {
    const {
      project_id: projectId,
      role_name: roleName,
      role_id: roleId,
      policy_ids: policyIds,
      action,
      resource_arn: resourceArn,
    } = req.body || {};

    if (!projectId) {
      return res.status(400).json({
        error: { message: 'project_id is required', status: 400, code: 'ProjectRequired' },
      });
    }
    if (!action || !resourceArn) {
      return res.status(400).json({
        error: {
          message: 'action and resource_arn are required',
          status: 400,
          code: 'InvalidRequest',
        },
      });
    }

    const evaluation = await policyEvaluator.evaluate({
      projectId,
      roleName,
      roleId,
      policyIds,
      action,
      resourceArn,
    });

    return res.json({ evaluation });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        error: {
          message: err.message,
          status: err.status,
          code: err.code || 'IAM_ERROR',
        },
      });
    }
    return next(err);
  }
});

module.exports = router;
