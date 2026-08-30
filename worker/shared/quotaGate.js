'use strict';

async function assertQuota(projectId, meter) {
  if (!projectId || process.env.SKIP_QUOTA === '1') return { allowed: true, skipped: true };
  try {
    const { proxy } = require('./conductorProxy');
    const r = await proxy({
      service: 'billing_manager',
      method: 'POST',
      path: '/api/v1/evaluate-quota',
      projectId,
      body: { project_id: projectId, meter },
    });
    const allowed = r?.allowed !== false && r?.data?.allowed !== false;
    if (!allowed) {
      try {
        await proxy({
          service: 'slack_manager',
          method: 'POST',
          path: '/api/v1/messages',
          projectId,
          body: { project_id: projectId, text: `quota exceeded: ${meter}` },
        });
      } catch (_) { /* alert is best-effort */ }
      const e = new Error(`quota exceeded: ${meter}`);
      e.status = 429;
      e.code = 'QUOTA_EXCEEDED';
      throw e;
    }
    return r;
  } catch (e) {
    if (e.status === 429) throw e;
    return { allowed: true, skipped: true, error: e.message };
  }
}

module.exports = { assertQuota };
