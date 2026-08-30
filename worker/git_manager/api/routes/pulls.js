'use strict';

const express = require('express');
const { PullRequest } = require('../models');
const { RepoService } = require('../services/RepoService');
const { GitService } = require('../services/GitService');

const r = express.Router();
const repos = new RepoService();
const git = new GitService();
const q = (req) => req.query.project_id || req.body?.project_id || req.headers['x-project-id'];

r.post('/', async (req, res, next) => {
  try {
    const project_id = q(req);
    if (!project_id) return res.status(400).json({ error: { message: 'project_id required' } });
    const row = await PullRequest.create({
      project_id,
      repo_id: req.body.repo_id,
      title: req.body.title || 'PR',
      source_branch: req.body.source_branch || req.body.source,
      target_branch: req.body.target_branch || req.body.target || 'main',
      status: 'open',
      body: req.body.body || '',
      notes: '',
    });
    res.status(201).json({ pull: row });
  } catch (e) { next(e); }
});

r.get('/', async (req, res, next) => {
  try {
    const where = {};
    if (q(req)) where.project_id = q(req);
    if (req.query.repo_id) where.repo_id = req.query.repo_id;
    const items = await PullRequest.findAll(Object.keys(where).length ? { where } : {});
    res.json({ pulls: items });
  } catch (e) { next(e); }
});

r.get('/:id', async (req, res, next) => {
  try {
    const rows = await PullRequest.findAll({ where: { id: req.params.id, project_id: q(req) } });
    if (!rows.length) return res.status(404).json({ error: { message: 'not found' } });
    const pull = rows[0];
    let diff = '';
    try {
      const raw = await repos.getRaw(pull.repo_id, q(req));
      const dir = repos.repoDir(raw.project_id, raw.name);
      diff = await git.diff(dir, { source: pull.source_branch, target: pull.target_branch });
    } catch (_) { /* repo may be empty */ }
    res.json({ pull, diff });
  } catch (e) { next(e); }
});

r.post('/:id/merge', async (req, res, next) => {
  try {
    const rows = await PullRequest.findAll({ where: { id: req.params.id, project_id: q(req) } });
    if (!rows.length) return res.status(404).json({ error: { message: 'not found' } });
    const pull = rows[0];
    const raw = await repos.getRaw(pull.repo_id, q(req));
    const dir = repos.repoDir(raw.project_id, raw.name);
    if (pull.status === 'merged') {
      return res.status(409).json({ error: { message: 'already merged' } });
    }
    const target = pull.target_branch || 'main';
    const result = await git.mergeFastForward(dir, { source: pull.source_branch, target });
    await PullRequest.update(req.params.id, { status: 'merged' });
    try {
      const sha = result?.sha || '';
      await repos.recordPush({
        project_id: q(req),
        repo_id: pull.repo_id,
        repo_name: raw.name,
        ref: `refs/heads/${target}`,
        old_sha: '',
        new_sha: sha,
        pusher: 'merge',
      });
    } catch (hookErr) {
      console.warn('[git_manager] merge cicd trigger skipped:', hookErr.message);
    }
    res.json({ pull: { ...pull, status: 'merged' }, merged: true, sha: result?.sha || '' });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

r.post('/:id/notes', async (req, res, next) => {
  try {
    const rows = await PullRequest.findAll({ where: { id: req.params.id, project_id: q(req) } });
    if (!rows.length) return res.status(404).json({ error: { message: 'not found' } });
    const notes = `${rows[0].notes || ''}\n${req.body.note || ''}`.trim();
    await PullRequest.update(req.params.id, { notes });
    res.json({ pull: { ...rows[0], notes } });
  } catch (e) { next(e); }
});

module.exports = r;
