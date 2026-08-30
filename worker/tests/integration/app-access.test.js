'use strict';

const express = require('express');
const request = require('supertest');
const { requireResource } = require('../../shared/requireResource');
const { buildBucketArn, enrichBucket } = require('../../storage_manager/api/services/BucketArn');
const arn = require('../../shared/arn');
const scope = require('../../shared/scope');

const PID = 'd57d380d-acfe-49b0-b5a9-ba973892bc8b';
const LLM_ARN = `arn:aerekos:${PID}:ai:llm:endpoint/test-llm`;
const BUCKET_ARN = `arn:aerekos:${PID}:storage:bucket/uploads`;

function appWithAuth(scopeName) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const raw = req.headers['x-test-auth'];
    if (!raw) return res.status(401).json({ error: { message: 'no test auth' } });
    try {
      req.auth = JSON.parse(raw);
      next();
    } catch (e) {
      res.status(400).json({ error: { message: 'bad x-test-auth' } });
    }
  });
  app.post('/invoke', requireResource({ requiredScope: scopeName }), (req, res) => {
    res.json({ ok: true, resource: req.resourceArn });
  });
  return app;
}

describe('app-access middleware chain', () => {
  test('arn build/parse round-trip for AI endpoint', () => {
    const built = arn.build({ projectId: PID, namespace: 'ai', resourceType: 'llm:endpoint', name: 'my-llm' });
    const p = arn.parse(built);
    expect(p.namespace).toBe('ai');
    expect(p.resourceType).toBe('llm:endpoint');
    expect(p.name).toBe('my-llm');
  });

  test('arn.isAllowed wildcard patterns', () => {
    expect(arn.isAllowed([`arn:aerekos:${PID}:ai:llm:endpoint/*`], LLM_ARN)).toBe(true);
    expect(arn.isAllowed([`arn:aerekos:${PID}:storage:bucket/other`], BUCKET_ARN)).toBe(false);
  });

  test('scope.hasScope grants ai:InvokeLlm', () => {
    expect(scope.hasScope('ai:InvokeLlm', 'ai:InvokeLlm')).toBe(true);
    expect(scope.hasScope(['ai:*'], 'ai:InvokeLlm')).toBe(true);
    expect(scope.hasScope('storage:ListBucket', 'ai:InvokeLlm')).toBe(false);
  });

  test('requireResource rejects app token without resource', async () => {
    const app = appWithAuth('ai:InvokeLlm');
    const auth = JSON.stringify({ typ: 'app', resources: [LLM_ARN], scope: 'ai:InvokeLlm' });
    const r = await request(app).post('/invoke').set('x-test-auth', auth).send({ model: 'x' });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('ResourceRequired');
  });

  test('requireResource rejects wrong resource ARN', async () => {
    const app = appWithAuth('ai:InvokeLlm');
    const auth = JSON.stringify({
      typ: 'app',
      resources: [`arn:aerekos:${PID}:ai:llm:endpoint/other`],
      scope: 'ai:InvokeLlm',
    });
    const r = await request(app).post('/invoke').set('x-test-auth', auth).send({ resource: LLM_ARN });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('ResourceNotAllowed');
  });

  test('requireResource rejects insufficient scope', async () => {
    const app = appWithAuth('ai:InvokeLlm');
    const auth = JSON.stringify({ typ: 'app', resources: [LLM_ARN], scope: 'storage:ListBucket' });
    const r = await request(app).post('/invoke').set('x-test-auth', auth).send({ resource: LLM_ARN });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('InsufficientScope');
  });

  test('requireResource allows matching ARN + scope', async () => {
    const app = appWithAuth('ai:InvokeLlm');
    const auth = JSON.stringify({ typ: 'app', resources: [LLM_ARN], scope: 'ai:InvokeLlm' });
    const r = await request(app).post('/invoke').set('x-test-auth', auth).send({ resource: LLM_ARN });
    expect(r.status).toBe(200);
    expect(r.body.resource).toBe(LLM_ARN);
  });

  test('requireResource skips non-app tokens', async () => {
    const app = appWithAuth('ai:InvokeLlm');
    const auth = JSON.stringify({ typ: 'service', scope: '*' });
    const r = await request(app).post('/invoke').set('x-test-auth', auth).send({});
    expect(r.status).toBe(200);
  });

  test('BucketArn enrich adds arn on bucket row', () => {
    const row = { project_id: PID, name: 'uploads' };
    const out = enrichBucket(row);
    expect(out.arn).toBe(buildBucketArn(PID, 'uploads'));
  });
});
