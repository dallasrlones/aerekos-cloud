'use strict';

const { projectId } = require('./crudCore');

function knockoutTry(serviceName) {
  const express = require('express');
  const r = express.Router();
  r.post('/try', (req, res) => {
    const pid = projectId(req);
    res.json({
      ok: true,
      preview: true,
      service: serviceName,
      project_id: pid,
      skipped: process.env.SKIP_OUTBOUND === '1',
      note: 'v1 try-it path (preview only — not a live run)',
      echo: req.body || {},
    });
  });
  return r;
}

module.exports = { knockoutTry };
