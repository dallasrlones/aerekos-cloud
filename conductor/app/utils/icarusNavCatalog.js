'use strict';

function resolveProject(phrase, projects = [], current) {
  const t = String(phrase || '');
  const named = t.match(/project\s+([a-zA-Z0-9._-]+)/i);
  if (named) {
    const q = named[1].toLowerCase();
    const hit = (projects || []).find((p) => String(p.name || '').toLowerCase() === q
      || String(p.display_name || '').toLowerCase() === q
      || String(p.id || '').startsWith(q));
    if (hit) return hit;
  }
  return current || null;
}

function matchNav(phrase, ctx = {}) {
  const t = String(phrase || '').trim();
  if (!t) return { kind: 'unknown' };
  const shopLike = /\b(learn|fix|implement|deploy|integrate|make .+ better|e2e|ingest)\b/i.test(t);
  if (shopLike && !/\b(take me|show me|go to|open)\b/i.test(t)) return { kind: 'shop', text: t };

  const envM = t.match(/\benv(?:ironment)?\s+([a-z0-9_-]+)/i);
  const env = envM ? envM[1] : ctx.currentEnv;
  const project = resolveProject(t, ctx.projects, ctx.currentProject);

  if (/\b(take me to |go to |open |show me )?(the )?agents\b/i.test(t)) {
    return { kind: 'nav', screen: 'aiAgents', env, project };
  }
  if (/\b(containers?|compute)\b/i.test(t) && /\b(show|take me|go to|open)\b/i.test(t)) {
    return {
      kind: 'nav',
      screen: 'computeManager',
      env,
      project,
      anchor: 'compute-list',
      projectName: project?.name,
    };
  }
  if (/\bsettings\b/i.test(t) && /\b(take me|go to|open|show)\b/i.test(t)) {
    return { kind: 'nav', screen: 'settings', env, project, anchor: 'settings-token' };
  }
  if (/\b(dashboard|home)\b/i.test(t) && /\b(take me|go to)\b/i.test(t)) {
    return { kind: 'nav', screen: 'dashboard', env, project };
  }
  if (/\b(friends|share (the )?project|project invite|invite (a )?friend)\b/i.test(t)
    && /\b(take me|go to|open|show)\b/i.test(t)) {
    return { kind: 'nav', screen: 'icarusFriends', env, project, params: { section: 'friends' } };
  }
  if (/\b(federation|federated|remote peer|peer conductor)\b/i.test(t)
    && /\b(take me|go to|open|show)\b/i.test(t)) {
    return {
      kind: 'nav',
      screen: 'icarusFriends',
      env,
      project,
      params: { section: 'friends', tab: 'federation' },
    };
  }
  if (/\b(icarus\s*)?(ide|adonis|editor|monaco)\b/i.test(t) && /\b(take me|go to|open|show)\b/i.test(t)) {
    return { kind: 'nav', screen: 'adonis', env, project, params: { section: 'ide' } };
  }
  if (/\b(services?\s*map|stack|infra\s*tab)\b/i.test(t) && /\b(take me|go to|open|show)\b/i.test(t)) {
    return { kind: 'nav', screen: 'adonis', env, project, params: { section: 'services' }, anchor: 'services-map' };
  }
  if (/\b(functions?|lambdas?)\b/i.test(t) && /\b(take me|go to|open|show)\b/i.test(t)) {
    return { kind: 'nav', screen: 'functionManager', env, project };
  }
  if (/\b(api\s*gateway|api\s*manager|data\s*api)\b/i.test(t) && /\b(take me|go to|open|show)\b/i.test(t)) {
    return { kind: 'nav', screen: 'apiManager', env, project };
  }
  if (/\b(storage|buckets?)\b/i.test(t) && /\b(take me|go to|open|show)\b/i.test(t)) {
    return { kind: 'nav', screen: 'storageManager', env, project };
  }
  if (/\b(git|repos?|pull\s*requests?)\b/i.test(t) && /\b(take me|go to|open|show)\b/i.test(t)) {
    return { kind: 'nav', screen: 'gitManager', env, project };
  }
  if (/\b(icarus\s*)?(chat|talk)\b/i.test(t) && /\b(take me|go to|open|show)\b/i.test(t)) {
    return { kind: 'nav', screen: 'icarus', env, project, params: { section: 'chat' } };
  }

  const restart = t.match(/\b(restart|start|stop)\s+(?:container\s+)?([a-zA-Z0-9._-]+)/i);
  if (restart) {
    const action = restart[1].toLowerCase();
    const name = restart[2];
    if (/vllm|xtts|ollama|auth_manager|wipe|remove-orphans/i.test(t)) {
      return { kind: 'deny', reason: 'that mutation is denied' };
    }
    return {
      kind: 'mutate',
      action: `compute.${action}`,
      target: name,
      screen: 'computeManager',
      env,
      project,
      ask: `I'm on project ${project?.name || 'this'} containers. ${action} ${name}. Sound good?`,
    };
  }

  // Ambiguous navigation-ish utterance → dock Icarus chat with the phrase (not a blind guess).
  if (/\b(take me|show me|go to|open)\b/i.test(t)) {
    return { kind: 'chat', screen: 'icarus', params: { section: 'chat', seed: t }, text: t };
  }
  return { kind: 'shop', text: t };
}

module.exports = { matchNav, resolveProject };
