'use strict';

/**
 * Laya decision engine inside ai_manager.
 * Typed predict(state, questions) with heuristic fallbacks when weights unavailable.
 * Icarus consumes in-process via IcarusFacade.
 */

const fs = require('fs');
const path = require('path');

const PACKS = {
  lane: {
    id: 'lane',
    options: ['talk', 'info', 'browser', 'manager', 'steer'],
    mapRoute: {
      talk: 'CHAT', info: 'CHAT', browser: 'WEB', manager: 'MANAGER', steer: 'STEER',
    },
  },
  context_gate: { id: 'context_gate', options: ['enough', 'self_fetch', 'ask_human'] },
  done_gate: { id: 'done_gate', options: ['complete', 'retry', 'escalate'] },
  plan_split: { id: 'plan_split', options: ['ready', 'need_more_detail', 'too_fat_split'] },
  spawn: { id: 'spawn', options: ['yes_one_subtask', 'split_further', 'no'] },
  regroup: { id: 'regroup', options: ['next_ready', 'replan', 'options_out_user'] },
  finetune_pick: { id: 'finetune_pick', options: ['none', 'personality', 'domain'] },
  hitl_risk: { id: 'hitl_risk', options: ['auto', 'ask_human', 'deny'] },
  info_path: { id: 'info_path', options: ['rag', 'web_fetch', 'browser', 'status_tools'] },
  tool_family: { id: 'tool_family', options: ['hangout', 'platform', 'full_shop'] },
  cron_vs_now: { id: 'cron_vs_now', options: ['run_now', 'propose_cron', 'skip'] },
  learn_disposition: {
    id: 'learn_disposition',
    options: ['fetch_only', 'learn_job', 'rag_ingest', 'skip'],
  },
  flow_pick: {
    id: 'flow_pick',
    options: [
      'none', 'new_project_app', 'new_worker_fleet', 'safe_self_update',
      'safe_deps_upgrade', 'iac_spool', 'browse_learn_ingest', 'heal_computer_browser',
    ],
  },
  intake_next: {
    id: 'intake_next',
    options: ['ask_field', 'ready_to_act', 'clarify'],
  },
  config_vs_code: {
    id: 'config_vs_code',
    options: ['configure_stack', 'call_manager', 'edit_function', 'edit_fe', 'edit_platform_self'],
  },
  worker_setup_step: {
    id: 'worker_setup_step',
    options: ['ask_queue', 'ask_concurrency', 'wire_producer', 'deploy_consumer', 'done'],
  },
};

const FLOW_SLOTS = {
  new_project_app: {
    required: ['intent', 'models', 'db', 'domain'],
    optional: ['fe'],
    defaults: { fe: 'admin_crud' },
    askCopy: {
      intent: 'What are you building? One sentence is enough.',
      models: 'What models/entities do you need? (fields or paste a schema)',
      db: 'Which database? Postgres, SQLite, or Mongo?',
      fe: 'Frontend: default admin CRUD UI, or describe custom pages?',
      domain: 'What domain or subdomain should be public?',
    },
    options: {
      db: ['Postgres', 'SQLite', 'Mongo'],
      fe: ['Default admin CRUD', 'Custom pages', 'Skip FE for now'],
    },
  },
  new_worker_fleet: {
    required: ['job', 'engine', 'concurrency'],
    optional: ['payload'],
    defaults: { engine: 'standard', concurrency: '1' },
    askCopy: {
      job: 'What jobs or events should workers process?',
      engine: 'Queue engine: standard, fifo, rabbitmq, or redis_stream?',
      concurrency: 'How many concurrent consumers?',
      payload: 'Payload shape, or link to your API models?',
    },
    options: {
      engine: ['standard', 'fifo', 'rabbitmq', 'redis_stream'],
    },
  },
  iac_spool: {
    required: ['intent', 'scope'],
    optional: ['domain'],
    defaults: { scope: 'project-stack' },
    askCopy: {
      intent: 'What should the stack do? (APIs, queues, tunnels…)',
      scope: 'System stack or project-stack? (never prod)',
      domain: 'Any public hostname?',
    },
    options: {
      scope: ['project-stack', 'system-stack'],
    },
  },
  safe_self_update: {
    required: ['claim', 'goal'],
    optional: ['health_check'],
    defaults: { claim: 'aerekos-cloud', health_check: 'compose' },
    askCopy: {
      claim: 'Which claim/folder for the self-update PR?',
      goal: 'What should the safe self-update change?',
      health_check: 'Health gate after deploy? (compose, http, skip)',
    },
    options: {
      health_check: ['compose', 'http', 'skip'],
    },
  },
  safe_deps_upgrade: {
    required: ['tree'],
    optional: ['ecosystem'],
    defaults: { tree: 'aerekos/aerekos-cloud', ecosystem: 'npm' },
    askCopy: {
      tree: 'Which repo path or claim tree should I scan for outdated packages?',
      ecosystem: 'Package ecosystem: npm (default), gem, or system?',
    },
    options: {
      ecosystem: ['npm', 'gem', 'system'],
    },
  },
  browse_learn_ingest: {
    required: ['topic'],
    optional: ['source'],
    defaults: {},
    askCopy: {
      topic: 'What should I learn and ingest?',
      source: 'URL or “search the web”?',
    },
  },
  heal_computer_browser: {
    required: ['target'],
    optional: ['symptom'],
    defaults: {},
    askCopy: {
      target: 'Heal Computer or Browser (or both)?',
      symptom: 'What failed? (OOM, disconnect, timeout…)',
    },
    options: {
      target: ['computer', 'browser', 'both'],
    },
  },
};

const STEER_RE = /\b(pause|stop|cancel|priorit|first|instead|nudge|steer|focus on|do .+ (?:first|now)|skip)\b/i;
const WEB_RE = /\b(search|google|look up|browse|open (?:the )?site|https?:\/\/)\b/i;
const INFO_RE = /\b(what is|explain|tell me about|history of|science|article|docs?|documentation|how does)\b/i;
const BROWSER_RE = /\b(browser|screenshot|navigate|click on (?:the )?page)\b/i;
const MANAGER_RE = /\b(build|implement|deploy|fix|ship|run (?:the )?plan|start work|spawn|refactor|create (?:a )?(?:project|pr|deploy|api|app|folder|directory)|scaffold|stack apply|mkdir)\b/i;
const FLOW_APP_RE = /\b(new (?:project|app|api)|spin up|stand up|create (?:an? )?(?:app|api|saas))\b/i;
const FLOW_WORKER_RE = /\b(queue|worker fleet|async jobs|consumers?|background jobs?)\b/i;
const SELF_UPDATE_RE = /\b(update (?:your|my|the) (?:own )?codebase|self[- ]?update|patch aerekos)\b/i;
const DEPS_UPGRADE_RE = /\b(upgrade|bump|update).*(deps|dependencies|packages|npm)|\boutdated npm\b/i;

function argmax(probs) {
  let best = null;
  let v = -1;
  for (const [k, p] of Object.entries(probs || {})) {
    if (p > v) { v = p; best = k; }
  }
  return best;
}

function softmaxScores(scores) {
  const keys = Object.keys(scores);
  if (!keys.length) return {};
  const max = Math.max(...keys.map((k) => scores[k]));
  const exps = {};
  let sum = 0;
  for (const k of keys) {
    exps[k] = Math.exp(scores[k] - max);
    sum += exps[k];
  }
  const out = {};
  for (const k of keys) out[k] = sum ? exps[k] / sum : 0;
  return out;
}

class LayaDecisionService {
  constructor({ checkpointDir } = {}) {
    this.checkpointDir = checkpointDir
      || process.env.LAYA_CHECKPOINT
      || path.join(process.env.AI_MANAGER_DATA || '/tmp/ai_manager', 'laya');
    this._agent = null;
    this._loadTried = false;
  }

  packs() {
    return { ...PACKS };
  }

  flowSlots() {
    return { ...FLOW_SLOTS };
  }

  /** Attempt to load real Laya weights; null = heuristics only. */
  _ensureAgent() {
    if (this._loadTried) return this._agent;
    this._loadTried = true;
    try {
      // Optional peer dep — heuristic path is first-class until trained.
      // eslint-disable-next-line import/no-unresolved, global-require
      const laya = require('laya');
      const ckpt = path.join(this.checkpointDir, 'checkpoint');
      if (fs.existsSync(ckpt) || fs.existsSync(this.checkpointDir)) {
        this._agent = laya.load(fs.existsSync(ckpt) ? ckpt : this.checkpointDir);
      }
    } catch {
      this._agent = null;
    }
    return this._agent;
  }

  /**
   * @param {object} state — text, hasLivePlan, flowId, slots, adapters, toolName, …
   * @param {object} questions — { [name]: { options?: string[], instructions?: string } }
   */
  async predict(state = {}, questions = {}) {
    const agent = this._ensureAgent();
    const answers = {};
    const names = Object.keys(questions || {});
    if (!names.length) {
      return { answers: {}, source: 'empty', at: Date.now() };
    }

    if (agent && typeof agent.predict === 'function') {
      try {
        const result = await agent.predict(state, questions);
        return {
          answers: result.answers || result,
          source: 'laya',
          usage: result.usage || null,
          at: Date.now(),
        };
      } catch { /* fall through */ }
    }

    for (const name of names) {
      const q = questions[name] || {};
      const pack = PACKS[name] || PACKS[q.pack] || null;
      const options = q.options || pack?.options || [];
      answers[name] = this._heuristic(name, state, options);
    }
    return { answers, source: 'heuristic', at: Date.now() };
  }

  _heuristic(name, state, options) {
    const text = String(state.text || state.message || '').trim();
    const scores = {};
    for (const o of options) scores[o] = 0.1;

    const bump = (opt, n) => {
      if (opt in scores) scores[opt] += n;
    };

    if (name === 'lane' || name === 'agent_choice') {
      if (state.hasLivePlan && STEER_RE.test(text)) bump('steer', 2);
      else if (BROWSER_RE.test(text)) bump('browser', 2);
      else if (WEB_RE.test(text) && !MANAGER_RE.test(text)) bump('browser', 1.2);
      else if (FLOW_APP_RE.test(text) || FLOW_WORKER_RE.test(text) || MANAGER_RE.test(text)) bump('manager', 2);
      else if (INFO_RE.test(text)) bump('info', 1.5);
      else bump('talk', 1.2);
    } else if (name === 'flow_pick') {
      if (SELF_UPDATE_RE.test(text)) bump('safe_self_update', 2);
      else if (DEPS_UPGRADE_RE.test(text)) bump('safe_deps_upgrade', 2);
      else if (FLOW_APP_RE.test(text)) bump('new_project_app', 2);
      else if (FLOW_WORKER_RE.test(text)) bump('new_worker_fleet', 2);
      else if (/\biac\b|stack apply|project-stack/i.test(text)) bump('iac_spool', 2);
      else if (/\blearn\b|ingest|article/i.test(text)) bump('browse_learn_ingest', 1.5);
      else if (/\bheal\b|computer (?:is )?down|browser down/i.test(text)) bump('heal_computer_browser', 2);
      else bump('none', 1);
    } else if (name === 'intake_next') {
      const flowId = state.flowId || state.flow_id;
      const slots = state.slots || {};
      const spec = FLOW_SLOTS[flowId];
      if (!spec) bump('clarify', 1);
      else {
        const missing = (spec.required || []).filter((k) => !slots[k]);
        if (!missing.length) bump('ready_to_act', 2);
        else bump('ask_field', 2);
      }
    } else if (name === 'hitl_risk') {
      const tool = String(state.toolName || state.tool || '');
      if (/prod|destroy|delete.*all|live.?send|auth_manager/i.test(tool + text)) bump('deny', 3);
      else if (/apply|deploy|push|merge|self|aerekos-cloud|iac_apply|commit/i.test(tool + text)) bump('ask_human', 2);
      else bump('auto', 1.5);
    } else if (name === 'info_path') {
      if (BROWSER_RE.test(text)) bump('browser', 2);
      else if (WEB_RE.test(text)) bump('web_fetch', 1.5);
      else if (/\bstatus\b|health|managers?/i.test(text)) bump('status_tools', 1.5);
      else bump('rag', 1.5);
    } else if (name === 'learn_disposition') {
      if (/\bingest\b|skills rag|remember/i.test(text)) bump('rag_ingest', 2);
      else if (/\blearn\b|article|whitepaper|update yourself/i.test(text)) bump('learn_job', 1.5);
      else if (WEB_RE.test(text) || INFO_RE.test(text)) bump('fetch_only', 2);
      else bump('skip', 1.2);
    } else if (name === 'config_vs_code') {
      if (SELF_UPDATE_RE.test(text)) bump('edit_platform_self', 2);
      else if (/\bfrontend\b|\bui\b|\breact\b/i.test(text)) bump('edit_fe', 1.5);
      else if (/\blambda\b|function|hook/i.test(text)) bump('edit_function', 1.5);
      else if (/\bstack\b|iac|data.?api|configure/i.test(text)) bump('configure_stack', 2);
      else bump('call_manager', 1);
    } else if (name === 'finetune_pick') {
      const adapters = state.adapters || [];
      if (!adapters.length) bump('none', 2);
      else if (state.wantPersonality) bump('personality', 1.5);
      else bump('none', 1.2);
    } else if (name === 'done_gate') {
      if (state.prOpened && state.checksOk) bump('complete', 3);
      else if (state.error || state.checksFailed) bump('retry', 2.5);
      else if ((state.replanCount || 0) >= 3) bump('escalate', 2);
      else bump('retry', 2);
    } else if (name === 'plan_split') {
      const title = String(state.taskTitle || text);
      if (title.length > 120 || /\band\b.*,/i.test(title)) bump('too_fat_split', 2);
      else if (!state.hasDetail) bump('need_more_detail', 1);
      else bump('ready', 1.5);
    } else if (name === 'regroup') {
      if (state.optionsOut) bump('options_out_user', 2);
      else if (state.failed) bump('replan', 1.5);
      else bump('next_ready', 1.5);
    } else if (name === 'context_gate') {
      if (state.hasEnoughContext) bump('enough', 2);
      else if (state.canSelfFetch) bump('self_fetch', 1.5);
      else bump('ask_human', 1);
    } else if (options[0]) {
      bump(options[0], 1);
    }

    const probabilities = softmaxScores(scores);
    const choice = argmax(probabilities) || options[0] || null;
    return {
      choice,
      probabilities,
      confidence: choice ? (probabilities[choice] || 0.5) : 0,
      field: name === 'intake_next' ? this._nextField(state) : undefined,
    };
  }

  _nextField(state) {
    const flowId = state.flowId || state.flow_id;
    const slots = state.slots || {};
    const spec = FLOW_SLOTS[flowId];
    if (!spec) return null;
    const missing = (spec.required || []).filter((k) => !slots[k]);
    if (missing.length) return missing[0];
    const optMissing = (spec.optional || []).filter((k) => slots[k] == null && !spec.defaults?.[k]);
    return optMissing[0] || null;
  }

  /** Map Laya lane → existing gate route. */
  async routeLane(text, ctx = {}) {
    const out = await this.predict(
      { text, hasLivePlan: Boolean(ctx.hasLivePlan) },
      { lane: { options: PACKS.lane.options } },
    );
    const ans = out.answers.lane || {};
    const choice = ans.choice || 'talk';
    const route = PACKS.lane.mapRoute[choice] || 'CHAT';
    // info stays on user lane like CHAT but tagged
    return {
      route: choice === 'info' ? 'CHAT' : route,
      lane_choice: choice,
      confidence: ans.confidence || 0.6,
      reasons: [`laya_${out.source}`, choice],
      source: out.source,
      laya: out,
    };
  }

  intakeAsk(flowId, slots = {}) {
    const spec = FLOW_SLOTS[flowId];
    if (!spec) return null;
    const missing = (spec.required || []).filter((k) => !slots[k]);
    const field = missing[0]
      || (spec.optional || []).find((k) => slots[k] == null && !spec.defaults?.[k]);
    if (!field) {
      return {
        ready: true,
        summary: this._summary(flowId, { ...spec.defaults, ...slots }),
      };
    }
    return {
      ready: false,
      field,
      text: spec.askCopy[field] || `Need: ${field}`,
      options: spec.options?.[field] || ['Other'],
      recommended: (spec.options?.[field] || [])[0] || 'Other',
    };
  }

  _summary(flowId, slots) {
    if (flowId === 'new_project_app') {
      return `API + FE on ${slots.domain || '?'}, DB=${slots.db || '?'}, models=${String(slots.models || '').slice(0, 80)}, FE=${slots.fe || 'admin_crud'} — apply?`;
    }
    if (flowId === 'new_worker_fleet') {
      return `Queue workers: job=${String(slots.job || '').slice(0, 60)}, engine=${slots.engine}, concurrency=${slots.concurrency} — create?`;
    }
    if (flowId === 'safe_deps_upgrade') {
      return `Upgrade deps in ${slots.tree || '?'} (${slots.ecosystem || 'npm'}): branch icarus/deps-*, open PR, run checks, rolling apply — never auto-merge?`;
    }
    return `Run flow ${flowId} with ${JSON.stringify(slots)}?`;
  }

  mergeSlots(flowId, slots, utterance) {
    const next = { ...(slots || {}) };
    const text = String(utterance || '').trim();
    const spec = FLOW_SLOTS[flowId];
    if (!spec || !text) return next;

    const field = this._nextField({ flowId, slots: next });
    // Multi-field dump heuristics
    if (/\bnpm\b/i.test(text) && !next.ecosystem && flowId === 'safe_deps_upgrade') next.ecosystem = 'npm';
    if (/\bgem(s|ruby)?\b/i.test(text) && !next.ecosystem && flowId === 'safe_deps_upgrade') next.ecosystem = 'gem';
    if (/postgres|sqlite|mongo/i.test(text) && !next.db) {
      if (/postgres/i.test(text)) next.db = 'Postgres';
      else if (/sqlite/i.test(text)) next.db = 'SQLite';
      else if (/mongo/i.test(text)) next.db = 'Mongo';
    }
    if (/\b([\w.-]+\.[a-z]{2,})(?:\/\S*)?\b/i.test(text) && !next.domain && flowId === 'new_project_app') {
      next.domain = text.match(/\b([\w.-]+\.[a-z]{2,}(?:\/\S*)?)\b/i)[1];
    }
    if (field && !next[field]) {
      next[field] = text.slice(0, 2000);
    } else if (!field) {
      /* ready */
    } else if (field !== 'db' && field !== 'domain') {
      next[field] = text.slice(0, 2000);
    }
    return next;
  }
}

const layaDecision = new LayaDecisionService();

module.exports = {
  LayaDecisionService,
  layaDecision,
  PACKS,
  FLOW_SLOTS,
};
