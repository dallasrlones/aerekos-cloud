'use strict';

class OpsTimelineService {
  async timeline(projectId) {
    const events = [];
    try {
      const FleetHealthService = require('./FleetHealthService');
      const snap = await FleetHealthService.snapshot(projectId || null);
      for (const w of snap.workers || []) {
        if (w.status === 'online') continue;
        const status = w.status || 'offline';
        // Offline is expected fleet state — warn only. Degraded counts as broken.
        const severity = status === 'offline' ? 'warning' : 'error';
        events.push({
          at: w.last_seen || new Date().toISOString(),
          kind: 'worker',
          severity,
          title: `${w.hostname || w.id} is ${status}`,
          ref: { worker_id: w.id },
        });
      }
    } catch (_) { /* best effort */ }
    try {
      const JobService = require('./JobService');
      const jobs = await JobService.listRecent?.(projectId, 20);
      for (const j of jobs || []) {
        if (j.status === 'failed' || j.kind === 'backup-failed') {
          events.push({
            at: j.created_at || j.updated_at,
            kind: j.kind || 'job',
            severity: 'error',
            title: j.summary || j.kind || 'job failed',
            ref: { job_id: j.id },
          });
        }
      }
    } catch (_) { /* optional */ }
    events.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
    return {
      project_id: projectId || null,
      broken: events.filter((e) => e.severity === 'error').length,
      events: events.slice(0, 50),
    };
  }
}

module.exports = new OpsTimelineService();
