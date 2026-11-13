'use strict';

const { isPlaceholderContent, isLiveThinking, llmPhase, livePrompt } = require('../../app/utils/icarusThink');

describe('icarusThink', () => {
  it('does not treat a real reply as thinking', () => {
    expect(isPlaceholderContent('Hey there, good to hear from you!')).toBe(false);
    expect(isLiveThinking({ content: 'Hey there' }, null, null)).toBe(false);
  });

  it('hides stale Thinking bubbles when no job is live', () => {
    const msg = { content: 'Thinking…', job_id: 'old' };
    expect(isPlaceholderContent(msg.content)).toBe(true);
    expect(isLiveThinking(msg, null, { in_flight: [] })).toBe(false);
  });

  it('shows thinking only while that job is in flight', () => {
    const msg = { content: 'Thinking…', job_id: 'j1' };
    expect(isLiveThinking(msg, { jobId: 'j1', status: 'running' }, null)).toBe(true);
    expect(isLiveThinking(msg, { jobId: 'j1', status: 'succeeded' }, null)).toBe(false);
  });

  it('maps llm phases called / waiting / done', () => {
    expect(llmPhase({ status: 'queued' }, {}).phase).toBe('called');
    expect(llmPhase({ status: 'running' }, {}).phase).toBe('waiting');
    expect(llmPhase({ status: 'succeeded' }, {}).phase).toBe('done');
    expect(llmPhase(null, { in_flight: [{ lane: 'execute' }] }).label).toMatch(/execute · waiting/);
    expect(llmPhase(null, {}).phase).toBe('idle');
  });

  it('live prompt copy', () => {
    expect(livePrompt('called')).toBe('Called the brain…');
    expect(livePrompt('waiting', 'Hello')).toBe('Hello');
    expect(livePrompt('waiting', '')).toMatch(/Waiting/);
    expect(livePrompt('done', 'Final answer')).toBe('Final answer');
    expect(livePrompt('done', '')).toBe('');
    expect(livePrompt('idle')).toBe('');
  });
});
