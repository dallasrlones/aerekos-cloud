'use strict';

process.env.SKIP_SERVICE_REGISTRATION = 'true';
process.env.SKIP_JOB_CONSUMER = '1';
process.env.SKIP_BROKER = '1';

const { localDefaults } = require('../../api/services/LocalIntegrationSeed');

describe('ai_manager unit (Wave 2 closeout scoped)', () => {
  test('localDefaults enables Ollama LLM by default', () => {
    const rows = localDefaults({ LLM_BACKEND: 'ollama' });
    const ollama = rows.find((r) => r.provider === 'ollama' && r.capability === 'llm');
    expect(ollama).toBeTruthy();
    expect(ollama.enabled).toBe('true');
    expect(ollama.is_default).toBe('true');
  });

  test('default listen port is 3126', () => {
    expect(parseInt(process.env.PORT || '3126', 10)).toBe(3126);
  });
});
