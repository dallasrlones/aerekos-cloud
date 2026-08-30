const { getSecretValue } = require('./secretsClient');

/**
 * Load platform secrets from secrets_manager into process.env.
 * Safe to call repeatedly until secrets_manager is reachable (boot race with KMS).
 */
async function bootstrapPlatformSecrets() {
  if (process.env.CONDUCTOR_CLIENT_SECRET) return;

  const projectId = process.env.DEFAULT_PROJECT_ID || process.env.PROJECT_ID;
  if (!projectId) return;

  const clientName = process.env.CONDUCTOR_CLIENT_SECRET_NAME || 'conductor.client_secret';
  try {
    const secret = await getSecretValue(clientName, projectId);
    if (secret) {
      process.env.CONDUCTOR_CLIENT_SECRET = secret;
      console.log('✓ Loaded conductor client secret from secrets_manager');
    }
  } catch (err) {
    console.warn('platformSecrets: could not load conductor client secret:', err.message);
  }
}

module.exports = { bootstrapPlatformSecrets };
