'use strict';

const express = require('express');
const { PullRequest, PullComment, PullReview, CheckRun, Repository } = require('../models');
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
    const comments = await PullComment.findAll({ where: { pull_id: pull.id, project_id: q(req) } }).catch(() => []);
    const reviews = await PullReview.findAll({ where: { pull_id: pull.id, project_id: q(req) } }).catch(() => []);
    const checks = await CheckRun.findAll({ where: { repo_id: pull.repo_id, project_id: q(req) } }).catch(() => []);
    res.json({ pull, diff, comments, reviews, checks });
  } catch (e) { next(e); }
});

r.post('/:id/comments', async (req, res, next) => {
  try {
    const project_id = q(req);
    const rows = await PullRequest.findAll({ where: { id: req.params.id, project_id } });
    if (!rows.length) return res.status(404).json({ error: { message: 'not found' } });
    if (!req.body.body) return res.status(400).json({ error: { message: 'body required' } });
    const row = await PullComment.create({
      project_id,
      pull_id: req.params.id,
      author: req.body.author || req.user?.username || 'console',
      body: req.body.body,
      path: req.body.path || '',
      line: req.body.line == null ? 0 : Number(req.body.line),
    });
    res.status(201).json({ comment: row });
  } catch (e) { next(e); }
});

r.post('/:id/reviews', async (req, res, next) => {
  try {
    const project_id = q(req);
    const rows = await PullRequest.findAll({ where: { id: req.params.id, project_id } });
    if (!rows.length) return res.status(404).json({ error: { message: 'not found' } });
    const state = String(req.body.state || '').toLowerCase();
    if (!['approved', 'changes_requested', 'commented'].includes(state)) {
      return res.status(400).json({ error: { message: 'state must be approved, changes_requested, or commented' } });
    }
    const row = await PullReview.create({
      project_id,
      pull_id: req.params.id,
      author: req.body.author || req.user?.username || 'console',
      state,
      body: req.body.body || '',
    });
    res.status(201).json({ review: row });
  } catch (e) { next(e); }
});

let mergeLock = Promise.resolve();

r.post('/:id/merge', async (req, res, next) => {
  const run = async () => {
    const rows = await PullRequest.findAll({ where: { id: req.params.id, project_id: q(req) } });
    if (!rows.length) {
      const e = new Error('not found');
      e.status = 404;
      throw e;
    }
    const pull = rows[0];
    const raw = await repos.getRaw(pull.repo_id, q(req));
    const dir = repos.repoDir(raw.project_id, raw.name);
    if (pull.status === 'merged') {
      const e = new Error('already merged');
      e.status = 409;
      throw e;
    }
    const reviews = await PullReview.findAll({ where: { pull_id: pull.id, project_id: q(req) } }).catch(() => []);
    if (reviews.some((rv) => rv.state === 'changes_requested')) {
      const e = new Error('changes requested — cannot merge');
      e.status = 409;
      throw e;
    }
    const repoRows = await Repository.findAll({ where: { id: pull.repo_id } }).catch(() => []);
    const requireApproval = Number(repoRows[0]?.require_approval || 0) === 1;
    if (requireApproval && !reviews.some((rv) => rv.state === 'approved')) {
      const e = new Error('approval required');
      e.status = 409;
      throw e;
    }
    const checks = await CheckRun.findAll({ where: { repo_id: pull.repo_id, project_id: q(req) } }).catch(() => []);
    const recent = {};
    for (const c of checks) recent[c.name] = c;
    const failed = Object.values(recent).filter((c) => c.status === 'failed');
    if (failed.length) {
      const e = new Error(`checks failed: ${failed.map((c) => c.name).join(', ')}`);
      e.status = 409;
      throw e;
    }
    try {
      const { proxy } = require('../../../shared/conductorProxy');
      await proxy({
        service: 'queue_manager',
        method: 'POST',
        path: '/api/v1/queues/git-merge/messages',
        projectId: q(req),
        body: { project_id: q(req), body: JSON.stringify({ pull_id: pull.id, repo: raw.name }) },
        timeout: 8000,
      });
    } catch (_) { /* queue is observational */ }
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
        from_merge: true,
        merged: true,
      });
    } catch (hookErr) {
      console.warn('[git_manager] merge cicd trigger skipped:', hookErr.message);
    }
    return { pull: { ...pull, status: 'merged' }, merged: true, sha: result?.sha || '' };
  };
  try {
    const done = mergeLock.then(run, run);
    mergeLock = done.catch(() => {});
    res.json(await done);
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
