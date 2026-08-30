const express = require('express');
const router = express.Router();
const ProjectService = require('../services/ProjectService');
const authenticate = require('../middleware/auth');

/**
 * GET /api/deployments/orphaned
 * Get all orphaned deployments (for cleanup tracking)
 * Protected route
 */
router.get('/orphaned', authenticate, async (req, res, next) => {
  try {
    const deployments = await ProjectService.getOrphanedDeployments();
    
    res.json({
      deployments: deployments.map(d => ({
        id: d.id,
        service_id: d.service_id,
        worker_id: d.worker_id,
        project_id: d.project_id,
        status: d.status,
        deployed_at: d.deployed_at,
        orphaned: d.orphaned === 1,
        created_at: d.created_at,
        updated_at: d.updated_at
      }))
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
