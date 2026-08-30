const express = require('express');
const { IamService } = require('../services/IamService');

const router = express.Router();
const service = new IamService();

router.post('/', async (req, res, next) => {
  try {
    const body = {
      ...req.body,
      project_id: req.body.project_id || req.query.project_id || req.headers['x-project-id'],
    };
    const evaluation = await service.evaluateAccess(body);
    res.json({ evaluation });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: { message: e.message, code: e.code } });
    }
    next(e);
  }
});

module.exports = router;
