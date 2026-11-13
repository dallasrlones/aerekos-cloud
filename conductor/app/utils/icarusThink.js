'use strict';

function isPlaceholderContent(content) {
  const c = String(content || '').trim();
  return !c || c === '…' || c === 'Thinking…' || /^Queued on intelligence/i.test(c);
}

function jobIsLive(status) {
  return ['queued', 'running', 'called', 'waiting'].includes(String(status || ''));
}

function isLiveThinking(message, stream, gateway) {
  if (!isPlaceholderContent(message?.content)) return false;
  const st = stream?.status || stream?.phase;
  if (stream?.jobId && jobIsLive(st)) {
    if (!message.job_id || message.job_id === stream.jobId) return true;
  }
  const inflight = gateway?.in_flight || [];
  return inflight.some((j) => j.id && j.id === message.job_id);
}

function llmPhase(stream, gateway) {
  const inflight = gateway?.in_flight || [];
  const queued = gateway?.queued || [];
  const st = String(stream?.status || stream?.phase || '');
  if (['succeeded', 'done', 'failed', 'cancelled'].includes(st)) {
    return {
      phase: 'done',
      label: st === 'failed' || st === 'cancelled' ? `Brain · ${st}` : 'Brain · done',
    };
  }
  if (st === 'running' || st === 'waiting' || stream?.partial) {
    const lane = inflight[0]?.lane || 'user';
    return { phase: 'waiting', label: `Brain · ${lane} · waiting` };
  }
  if (st === 'queued' || st === 'called' || queued.length) {
    const lane = queued[0]?.lane || inflight[0]?.lane || 'user';
    return { phase: 'called', label: `Brain · ${lane} · called` };
  }
  if (inflight.length) {
    return { phase: 'waiting', label: `Brain · ${inflight[0].lane} · waiting` };
  }
  return { phase: 'idle', label: '' };
}

function livePrompt(phase, partial) {
  if (phase === 'called') return 'Called the brain…';
  if (phase === 'waiting') return String(partial || '').trim() || 'Waiting on the brain…';
  // Keep final tokens visible until chat history reload lands the assistant row.
  if (phase === 'done') return String(partial || '').trim();
  return '';
}

module.exports = {
  isPlaceholderContent,
  isLiveThinking,
  llmPhase,
  jobIsLive,
  livePrompt,
};
