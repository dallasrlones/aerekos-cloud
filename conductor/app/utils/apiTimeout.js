'use strict';

const SLOW_AI = /\/(llm|tts|stt|embeddings|intelligence|memory|rag)\//i;

function resolveClientTimeout(url, timeout, defaultTimeout, slowTimeout) {
  if (SLOW_AI.test(String(url || '')) && (timeout == null || timeout === defaultTimeout)) {
    return slowTimeout;
  }
  return timeout;
}

module.exports = { SLOW_AI, resolveClientTimeout };
