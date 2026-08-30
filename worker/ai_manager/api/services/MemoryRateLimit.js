const { createRateLimiter } = require('../../../shared/rateLimit');

function projectId(req) {
  return req.query.project_id || req.body?.project_id || 'unknown';
}

function buildIngestLimiter(getConfig) {
  return async (req, res, next) => {
    try {
      const pid = projectId(req);
      const config = await getConfig(pid);
      const perSession = Number(config?.ingest_rpm_per_session) || 120;
      const perUser = Number(config?.ingest_rpm_per_user) || 300;
      const sessionId = req.body?.session_id || 'unknown';
      const userId = req.body?.user_id || 'unknown';

      const sessionLimiter = createRateLimiter({
        windowMs: 60_000,
        max: perSession,
        keyFn: () => `mem:ingest:sess:${pid}:${sessionId}`,
        message: 'ingest rate limit exceeded for session',
      });
      const userLimiter = createRateLimiter({
        windowMs: 60_000,
        max: perUser,
        keyFn: () => `mem:ingest:user:${pid}:${userId}`,
        message: 'ingest rate limit exceeded for user',
      });

      return sessionLimiter(req, res, (err) => {
        if (err) return next(err);
        return userLimiter(req, res, next);
      });
    } catch (e) {
      return next(e);
    }
  };
}

module.exports = { buildIngestLimiter };
