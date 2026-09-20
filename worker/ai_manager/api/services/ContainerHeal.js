'use strict';

const GPU = new Set(['vllm', 'tts_xtts', 'ollama', 'aerekos-vllm', 'aerekos-ollama', 'aerekos-tts-xtts']);
const NEVER = new Set(['auth_manager', 'aerekos-auth-manager', 'aerekos-cloud-auth']);
const CHEAP = new Set([
  'aerekos-icarus-workspace', 'aerekos-icarus-browser', 'aerekos-cloud-frontend', 'aerekos-cloud-conductor',
  'aerekos-stt', 'aerekos-tts-kokoro', 'aerekos-tts-cache',
]);

function inspectState(info = {}) {
  const state = info.State || info.state || {};
  const exit = Number(state.ExitCode != null ? state.ExitCode : info.exit_code);
  const oom = !!(state.OOMKilled || info.OOMKilled);
  const running = !!(state.Running || info.running);
  const finished = String(state.FinishedAt || info.FinishedAt || '');
  const error = String(state.Error || info.Error || '');
  const explicitStop = !running && !oom && exit === 0 && finished && !/oom/i.test(error);
  return {
    running,
    exit_code: Number.isFinite(exit) ? exit : null,
    oom: oom || exit === 137,
    explicit_stop: explicitStop,
  };
}

function shouldHeal(name, info = {}) {
  const n = String(name || '');
  if (NEVER.has(n) || /auth_manager/.test(n)) {
    return { heal: false, reason: 'auth_manager is left alone' };
  }
  const st = inspectState(info);
  if (st.running) return { heal: false, reason: 'already running', ...st };
  if (st.oom || st.exit_code === 137) {
    return { heal: false, reason: 'OOM 137 — leave stopped', ask: 'GPU OOM’d — leave it or try once?', ...st };
  }
  if (GPU.has(n) || /vllm|xtts|ollama/.test(n)) {
    if (st.explicit_stop) return { heal: false, reason: 'explicit stop — leave GPU engine', ...st };
    if (st.exit_code && st.exit_code !== 0 && st.exit_code !== 137) {
      return { heal: true, reason: 'flake exit', ...st };
    }
    return { heal: false, reason: 'GPU engine stopped — ASK', ask: `${n} is down — retry or leave it?`, ...st };
  }
  if (CHEAP.has(n) || /icarus-workspace|frontend|conductor|stt|kokoro|tts-cache/.test(n)) {
    return { heal: true, reason: 'cheap container', ...st };
  }
  return { heal: true, reason: 'default start known name', ...st };
}

module.exports = { GPU, NEVER, CHEAP, inspectState, shouldHeal };
