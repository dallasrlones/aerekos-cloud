const express = require('express');
const { ApiRouteService } = require('../services/ApiRouteService');

const router = express.Router();
const service = new ApiRouteService();

router.post('/', async (req, res, next) => {
  try {
    const projectId = req.body.project_id || req.query.project_id || req.headers['x-project-id'];
    const result = await service.seedPresets(projectId);
    res.status(200).json(result);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message, code: e.code } });
    next(e);
  }
});

module.exports = router;
