'use strict';

const { gatewayFor } = require('./AgentGateway');
const {
  executeTool, dangerClassify, classifyTool, toolSchemas, openaiToolSchemas,
  extractToolCalls, resolveInWorkspace, hangoutReadSchemas, workerToolSchemas,
} = require('./workspaceTools');
const { emitAgentPulse } = require('../utils/aiLive');
const { fail, json, scrubSecrets } = require('./agentArn');
const {
  WORK_RE, CONNECTOR_RE, formatAsk, friendSystem, managerSystem, workerSystem,
} = require('./agentPrompt');
const shop = require('./AgentShop');
const { packText, denyForPersona } = require('./workerRules/denylist');
const Deploy = require('./DeployService');
const Scaffold = require('./ScaffoldService');
const fs = require('fs');

const REMOTE_TOOLS = new Set([
  'file_read', 'file_list', 'file_write', 'file_edit', 'file_delete', 'file_copy',
  'file_search', 'grep', 'shell', 'scaffold', 'file_rollback', 'run_checks',
]);

class AgentRuntime {
  constructor(deps = {}) {
    this.agents = deps.agents || null;
    this.connectors = deps.connectors || null;
    this.jobs = deps.jobs || null;
    if (!this.agents) this.agents = new (require('./AgentService').AgentService)();
    if (!this.connectors) {
      try {
        this.connectors = new (require('./ConnectorService').ConnectorService)();
      } catch {
        this.connectors = { list: async () => [] };
      }
    }
    if (!this.jobs) {
      try {
        this.jobs = new (require('./IntelligenceJobService').IntelligenceJobService)();
      } catch {
        this.jobs = { submit: async () => { throw new Error('jobs unavailable'); } };
      }
    }
    const { AgentPlanService } = require('./AgentPlanService');
    const { AgentLearnService } = require('./AgentLearnService');
    this.plans = deps.plans || new AgentPlanService();
    this.learn = deps.learn || new AgentLearnService();
    this._checkpoints = new Map();
  }

  async _ctx(projectId, agentId) {
    const agent = await this.agents.resolve(projectId, agentId);
    const settings = await this.agents.getSettings(projectId);
    const pins = await this.agents.listPins(projectId, agent.id);
    const rolls = await this.agents.getRolls(projectId, agent.id);
    return { agent, settings, pins, rolls };
  }

  async _note(projectId, agentId, row) {
    if (typeof this.agents.addTimeline === 'function') {
      try { await this.agents.addTimeline(projectId, agentId, row); } catch { /* */ }
    }
  }

  async _createAsk(projectId, agentId, body) {
    try {
      const ask = await this.agents.createAsk(projectId, agentId, body);
      const speak = String(ask?.speak_text || ask?.text || '').trim();
      if (speak && ask.status !== 'pending') {
        const p = typeof body.payload === 'string' ? json(body.payload, {}) : (body.payload || {});
        const bits = [p.plan_id && `plan:${p.plan_id}`, p.task_id && `task:${p.task_id}`].filter(Boolean);
        const mark = bits.length ? ` <<LINK ${bits.join(' ')}>>` : '';
        await this.agents.addMessage(projectId, agentId, {
          role: 'assistant', content: `${speak}${mark}`, layer: 'user', ask_id: ask.id,
        });
      }
      return ask;
    } catch (e) {
      if (e.status === 409 && e.ask) return e.ask;
      throw e;
    }
  }

  async chat(projectId, agentId, body = {}) {
    const { agent, settings, pins, rolls } = await this._ctx(projectId, agentId);
    const text = String(body.content || body.text || body.message || '').trim();
    const images = body.images || body.image ? [].concat(body.images || body.image) : [];
    if (!text && !images.length) throw fail(400, 'content required');
    await this.agents.addMessage(projectId, agent.id, { role: 'user', content: text || '[image]', layer: 'user' });
    await this._note(projectId, agent.id, { layer: 'user', type: 'chat', summary: text.slice(0, 160) });

    // Dual-stream Context-Gate — user replies while manager keeps working
    const { forProject } = require('./IcarusFacade');
    const { uxSlo } = require('./UxSlo');
    const icarus = forProject(projectId, settings);
    if (typeof icarus.bindRuntime === 'function') icarus.bindRuntime(this);
    const t0 = Date.now();
    let livePlan = false;
    try {
      const plans = await icarus.graph.listPlans();
      livePlan = (plans || []).some((p) => p.status === 'active');
    } catch { /* memory/neo4j */ }
    const gated = await icarus.gate.route(text, { hasLivePlan: livePlan });
    uxSlo.record('gate_classify_ms', Date.now() - t0, { route: gated.route });
    await this._note(projectId, agent.id, {
      layer: 'user', type: 'laya', summary: `lane=${gated.lane_choice || gated.route}`, meta: {
        route: gated.route, lane_choice: gated.lane_choice, source: gated.source,
      },
    });

    // Guided user Flow intake (Laya flow_pick + intake_next) — hand-holding ASKs
    const flowOut = await this._maybeFlowIntake(projectId, agent, text, icarus, gated);
    if (flowOut) return { ...flowOut, gate: gated };

    const route = shop.routeChat(agent.mode);
    const userId = body.user_id || agent.user_id || 'console';
    const ctx = {
      text, userId, pins, rolls, images, gate: gated, icarus,
    };

    if (gated.route === 'STEER' && livePlan) {
      await this._note(projectId, agent.id, {
        layer: 'user', type: 'steer', summary: text.slice(0, 160), meta: gated,
      });
      icarus.ledger.append({
        projectId, agentId: agent.id, lane: 'user', tool: 'steer', args: { text, gate: gated },
      });
      // STEER wakes manager with report + graph nudge
      try {
        if (typeof icarus.graph.invalidateFromSteer === 'function') {
          await icarus.graph.invalidateFromSteer(text);
        }
      } catch { /* optional */ }
      setImmediate(() => {
        this.runManager(projectId, agent.id, {
          text, userId, report: { steer: true, text },
        }).catch(() => {});
      });
    }

    // Gate owns friend vs work. Ask/Plan/Agent are UX hints.
    // Clear shop briefs always sync-shop. Agent-mode CHAT without a clear brief still
    // hits shop for the free_text "what should we get done?" ASK (not a plan preview).
    // MANAGER dual-streams: user reply immediate + shop in background.
    const clearShop = shop.briefIsClear(text);
    const infoOnly = gated.lane_choice === 'info' || gated.policy.info_lane;
    const friendOnly = (gated.route === 'CHAT' || gated.route === 'CLARIFY') && !clearShop && !route.shop;
    const wantShop = Boolean(route.shop) && !friendOnly && !infoOnly;
    // Tiny clear briefs (folder/file) always sync-shop for preview ASK.
    // Broader MANAGER intents dual-stream: user reply now + shop in background.
    const dualManager = wantShop && gated.route === 'MANAGER' && gated.policy.wake_manager && !clearShop;

    if (wantShop && !dualManager) {
      const shopOut = await this._shopTurn(projectId, agent, settings, ctx);
      return { ...shopOut, gate: gated };
    }

    const userOut = await this._userTurn(projectId, agent, settings, {
      ...ctx,
      shop: false,
    });
    if (dualManager) {
      setImmediate(() => {
        this._shopTurn(projectId, agent, settings, ctx).catch(() => {});
      });
      return { ...userOut, gate: gated, dual_stream: true };
    }
    return { ...userOut, gate: gated };
  }

  async _userTurn(projectId, agent, settings, { text, userId, pins, rolls, images, shop: inShop, gate }) {
    if (inShop) {
      return { agent_id: agent.id, job_id: null, reply: '', handed_off: false, messages: [] };
    }
    const target = shop.resolveTarget(text, { projectId, agent, settings });
    const peek = await this._peekTarget(settings, target);
    const history = typeof this.agents.listMessages === 'function'
      ? await this.agents.listMessages(projectId, agent.id, { limit: 24 })
      : [];
    const prior = (history || [])
      .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.layer !== 'inter')
      .filter((m) => !/^Queued on intelligence/i.test(String(m.content || '')))
      .slice(-16)
      .map((m) => ({ role: m.role, content: scrubSecrets(m.content || '') }))
      .filter((m) => m.content && m.content !== '…' && m.content !== 'Thinking…');
    const system = friendSystem(agent, pins, rolls, target)
      + `\nPEEK of ${target.claim}:\n${peek.text}`;
    const infoLane = Boolean(gate?.lane_choice === 'info' || gate?.policy?.info_lane);
    let infoVerifyAppendix = '';
    if (infoLane || gate) {
      try {
        const { planInfoVerify, executeInfoVerify } = require('./InfoVerifyGate');
        const ragSearch = async (pid, coll, opts) => {
          const { RagCollectionService } = require('./RagCollectionService');
          const rag = new RagCollectionService();
          return rag.search(pid, coll, opts);
        };
        const plan = await planInfoVerify({ text, projectId, agent, gate, ragSearch });
        if (plan.required) {
          const verified = await executeInfoVerify({
            text, projectId, agent, bucket: agent.storage_bucket,
          });
          if (verified.appendix) {
            infoVerifyAppendix = verified.appendix;
            if (verified.corpus?.hash) {
              const { forProject } = require('./IcarusFacade');
              forProject(projectId, settings).loraTrain.recordCorpusRow(projectId, {
                hash: verified.corpus.hash,
                prefix: verified.corpus.prefix,
                url: verified.sources?.[0]?.url,
                query: text,
                normalized: verified.appendix,
                title: verified.sources?.[0]?.title,
                prompt: text,
              });
            }
          }
        } else if (infoLane && plan.factual) {
          infoVerifyAppendix = 'Factual info lane: cite RAG/skills only; if uncertain, say you cannot verify — never invent.';
        }
      } catch { /* verify optional */ }
    }

    const messages = [
      { role: 'system', content: scrubSecrets(system) },
      ...prior,
    ];
    if (infoVerifyAppendix) {
      messages.splice(1, 0, { role: 'system', content: scrubSecrets(infoVerifyAppendix) });
    }
    if (!prior.length || prior[prior.length - 1].content !== text) {
      messages.push({
        role: 'user',
        content: scrubSecrets(images.length ? `${text}\n[images attached: ${images.length}]` : text),
      });
    }

    const seesCode = /\b(see (your )?(own )?(code|codebase|repo)|your own codebase)\b/i.test(text);
    if (seesCode) {
      const reply = `Yes. I'm Icarus on aerekos-cloud. I can read ${target.claim}. ${peek.text.slice(0, 400)}`;
      await this.agents.addMessage(projectId, agent.id, {
        role: 'assistant', content: reply, layer: 'user', job_id: '',
      });
      this._pulse(projectId, agent.id);
      return { agent_id: agent.id, job_id: null, reply, handed_off: false, messages, target };
    }
    const gw = gatewayFor(projectId, settings);
    let job = null;
    const { resolveLaneIntelligence } = require('./laneIntelligence');
    const chatLane = infoLane ? 'info' : 'user';
    const lane = resolveLaneIntelligence(agent, 'user');
    const opts = json(agent.options, {});
    const names = [
      lane.intelligence,
      lane.fallback,
      agent.intelligence,
      opts.fallback_intelligence,
    ].filter((n, i, a) => n && a.indexOf(n) === i);
    const tools = hangoutReadSchemas();
    if (names.length) {
      try {
        job = await gw.enqueue('user', async () => {
          let last;
          for (const name of names) {
            try {
              return await this.jobs.submit(projectId, {
                intelligence: name,
                messages,
                user_id: userId,
                session_id: `agent:${agent.id}`,
                message_id: `u-${Date.now()}`,
                lane: chatLane,
                agent_id: agent.id,
                priority_class: 1,
                tools,
                tool_choice: 'auto',
                hangout: {
                  claim: target.claim,
                  workspace_root: settings.workspace_root || '',
                  workspace_worker_id: settings.workspace_worker_id || '',
                },
              });
            } catch (e) { last = e; }
          }
          throw last || fail(502, 'intelligence submit failed');
        }, { agentId: agent.id, priorityClass: 1 });
      } catch {
        job = null;
      }
    }
    const reply = job
      ? 'Thinking…'
      : 'Got it. (Bind a queued intelligence on this agent to think with the local brain.)';
    if (!job) {
      await this.agents.addMessage(projectId, agent.id, {
        role: 'assistant', content: reply, layer: 'user', job_id: '',
      });
    }
    this._pulse(projectId, agent.id);
    return { agent_id: agent.id, job_id: job?.id || null, reply, handed_off: false, messages, target };
  }

  async _peekTarget(settings, target) {
    const claim = String(target?.claim || shop.SELF_CLAIM);
    try {
      const ran = await this._runTool('file_list', { path: claim }, settings, settings.project_id || '', 'research');
      if (ran.computer_down) {
        return { text: `${claim} (computer down — I'll read when we're back)`, entries: [] };
      }
      const names = ran.entries || String(ran.stdout || '').split('\n').filter(Boolean);
      return { text: names.slice(0, 40).join(', ') || `(empty or missing: ${claim})`, entries: names };
    } catch (e) {
      return { text: `${claim} (${e.message || 'not on this disk'})`, entries: [] };
    }
  }

  async _shopTurn(projectId, agent, settings, ctx) {
    const asks = typeof this.agents.listAsks === 'function'
      ? await this.agents.listAsks(projectId, agent.id) : [];
    const open = (asks || []).find((a) => a.status === 'open');
    const workers = typeof this.agents.listWorkers === 'function'
      ? await this.agents.listWorkers(projectId, agent.id) : [];
    const inflight = (workers || []).filter((w) => ['running', 'queued', 'waiting_ask'].includes(w.status));

    if (open && open.kind === 'browse' && !shop.isReorder(ctx.text)) {
      return this.approve(projectId, agent.id, { ask_id: open.id, answer: ctx.text });
    }
    if (open && ['plan', 'plan_q', 'learn', 'cron'].includes(open.kind)) {
      const intent = shop.voiceIntent(ctx.text, open);
      if (intent.action === 'approve') {
        return this.approve(projectId, agent.id, { ask_id: open.id, answer: intent.answer });
      }
      if (open.kind === 'plan' || open.kind === 'plan_q') {
        return this._revisePlanFromChat(projectId, agent, settings, ctx, open);
      }
      const user = await this._userTurn(projectId, agent, settings, { ...ctx, shop: true });
      this._pulse(projectId, agent.id);
      return {
        agent_id: agent.id, job_id: user.job_id,
        reply: open.speak_text || open.text, handed_off: true, ask: open,
      };
    }
    if (shop.isReorder(ctx.text)) {
      if (open && open.kind === 'browse' && /stop this|pause browse/i.test(ctx.text)) {
        await this.agents.approve(projectId, agent.id, open.id, 'pause');
      }
      const user = await this._userTurn(projectId, agent, settings, { ...ctx, shop: true });
      const mgr = await this.runManager(projectId, agent.id, {
        text: ctx.text, userId: ctx.userId, report: { reorder: ctx.text },
      });
      this._pulse(projectId, agent.id);
      return {
        agent_id: agent.id, job_id: user.job_id, reply: mgr.ask?.speak_text || mgr.reply || user.reply,
        handed_off: true, ask: mgr.ask, reorder: true,
      };
    }
    if (open && open.kind === 'preview') {
      const user = await this._userTurn(projectId, agent, settings, { ...ctx, shop: true });
      this._pulse(projectId, agent.id);
      return {
        agent_id: agent.id, job_id: user.job_id,
        reply: open.speak_text || open.text, handed_off: true, ask: open,
      };
    }
    if (inflight.length && !shop.briefIsClear(ctx.text)) {
      const user = await this._userTurn(projectId, agent, settings, { ...ctx, shop: true });
      const mgr = await this.runManager(projectId, agent.id, {
        text: ctx.text, userId: ctx.userId, report: { inflight: true, text: ctx.text },
      });
      this._pulse(projectId, agent.id);
      return {
        agent_id: agent.id, job_id: user.job_id,
        reply: mgr.ask?.speak_text || mgr.reply || user.reply, handed_off: true, ask: mgr.ask, inflight: true,
      };
    }
    if (typeof this.plans.ensureLoaded === 'function') {
      await this.plans.ensureLoaded(projectId, agent.id);
    }
    const cronIntent = shop.parseCronIntent(ctx.text);
    if (cronIntent && !open) {
      return this._proposeCron(projectId, agent, settings, ctx, cronIntent);
    }
    const previewGuess = shop.inferPreview(ctx.text);
    if (shop.needsPlan(ctx.text, previewGuess) && !open) {
      return this._startPlan(projectId, agent, settings, ctx, previewGuess);
    }
    if (!shop.briefIsClear(ctx.text)) {
      const user = await this._userTurn(projectId, agent, settings, { ...ctx, shop: true });
      const ask = await this._createAsk(projectId, agent.id, {
        text: 'What should we get done? One sentence is enough.',
        options: ['Other'],
        recommended: 'Other',
        kind: 'free_text',
        from_layer: 'user',
        speak_text: 'What should we get done?',
        payload: { gaps: ['goal'] },
      });
      this._pulse(projectId, agent.id);
      return {
        agent_id: agent.id, job_id: user.job_id, reply: ask.speak_text, handed_off: false, ask, brief: null,
      };
    }

    const user = await this._userTurn(projectId, agent, settings, { ...ctx, shop: true });
    if (typeof this.agents.upsertBrief === 'function') {
      await this.agents.upsertBrief(projectId, agent.id, shop.briefFromText(ctx.text));
    }
    const mgr = await this.runManager(projectId, agent.id, { text: ctx.text, userId: ctx.userId });
    const reply = mgr.ask?.speak_text || mgr.ask?.text || user.reply;
    this._pulse(projectId, agent.id);
    return {
      agent_id: agent.id,
      job_id: user.job_id,
      reply,
      handed_off: true,
      goal_id: mgr.goal_id || null,
      task_id: mgr.task_id || null,
      worker_id: mgr.worker_id || null,
      ask: mgr.ask,
      brief: mgr.brief,
    };
  }

  async runManager(projectId, agentId, { text, userId, report, plan_id, step_id } = {}) {
    const { agent, settings } = await this._ctx(projectId, agentId);
    if (report?.flow === 'browse_learn_ingest') {
      return this._browseLearnIngest(projectId, agent, report.slots || {}, settings, {
        text: text || '',
        userId,
      });
    }
    if (report?.flow === 'safe_deps_upgrade') {
      return this._safeDepsUpgradeManager(projectId, agent, report.slots || {}, settings);
    }
    const gw = gatewayFor(projectId, settings);
    const board = typeof this.agents.shopBoard === 'function'
      ? await this.agents.shopBoard(projectId, agent.id)
      : null;
    let brief = typeof this.agents.latestBrief === 'function'
      ? await this.agents.latestBrief(projectId, agent.id)
      : null;
    if (!brief && text && !report) {
      brief = typeof this.agents.upsertBrief === 'function'
        ? await this.agents.upsertBrief(projectId, agent.id, shop.briefFromText(text))
        : shop.briefFromText(text);
    }
    const { resolveLaneIntelligence } = require('./laneIntelligence');
    const mgrLane = resolveLaneIntelligence(agent, 'manager');
    const mgrIntel = mgrLane.intelligence || agent.intelligence;
    if (mgrIntel && (report || shop.inferPreview(text || brief?.client_words || brief?.goal || '').type === 'other')) {
      try {
        await gw.enqueue('manager', async () => {
          const job = await this.jobs.submit(projectId, {
            intelligence: mgrIntel,
            messages: [
              {
                role: 'system',
                content: managerSystem(
                  settings.workspace_root || '/home/aerekos/work',
                  board,
                  json(agent.options, {}),
                  shop.resolveTarget(text || brief?.client_words || brief?.goal || '', { projectId, agent, settings }),
                ),
              },
              { role: 'user', content: scrubSecrets(JSON.stringify({ brief, report: report || null, text, board })) },
            ],
            user_id: userId || `manager:${agent.id}`,
            session_id: `agent:${agent.id}:manager`,
            tools: openaiToolSchemas(),
            tool_choice: 'auto',
            lane: 'manager',
            agent_id: agent.id,
            hangout: {
              claim: '',
              workspace_root: settings.workspace_root || '',
              workspace_worker_id: settings.workspace_worker_id || '',
            },
          });
          // Manager tool loop: execute tool calls from the job result when present
          try {
            await this._managerToolLoop(projectId, agent.id, job, settings);
          } catch { /* deterministic path still runs */ }
          return job;
        }, { agentId: agent.id });
      } catch { /* deterministic path still runs */ }
    }

    if (report && (report.reorder || report.inflight)) {
      const now = String(report.text || text || 'the current chunk').slice(0, 120);
      const speak = report.reorder ? `Now is ${now}.` : 'Still on the current chunk — no new shop.';
      return { ask: null, brief, board, inflight: !!report.inflight, reorder: !!report.reorder, reply: speak };
    }
    if (report) {
      return this._managerReport(projectId, agent, report);
    }

    if (!brief || !String(brief.goal || '').trim()) {
      const ask = await this._createAsk(projectId, agent.id, {
        text: 'What should we get done? One sentence is enough.',
        options: ['Other'],
        recommended: 'Other',
        kind: 'free_text',
        from_layer: 'user',
        speak_text: 'What should we get done?',
        payload: { gaps: ['goal'] },
      });
      if (brief && typeof this.agents.updateBrief === 'function') {
        await this.agents.updateBrief(brief.id, { status: 'need_more' });
      }
      return { ask, brief, accepted: false };
    }

    if (typeof this.agents.updateBrief === 'function' && brief.id) {
      await this.agents.updateBrief(brief.id, { status: 'accepted' });
    }
    let goal = null;
    let task = null;
    if (plan_id && typeof this.agents.listWork === 'function') {
      const items = await this.agents.listWork(projectId, agent.id);
      const payloadOf = (w) => (typeof w.payload === 'string' ? json(w.payload, {}) : (w.payload || {}));
      task = items.find((w) => w.kind === 'task' && payloadOf(w).plan_id === plan_id
        && (!step_id || payloadOf(w).step_id === step_id));
      goal = items.find((w) => w.kind === 'goal' && payloadOf(w).plan_id === plan_id)
        || items.find((w) => w.id === task?.parent_id);
    }
    if (!goal) {
      goal = await this.agents.createWork(projectId, agent.id, {
        kind: 'goal', title: String(brief.goal).slice(0, 180), status: 'running',
        dod: brief.done_when || '', payload: { brief, plan_id: plan_id || '', step_id: step_id || '' },
      });
    }
    if (!task) {
      task = await this.agents.createWork(projectId, agent.id, {
        kind: 'task', parent_id: goal.id, title: String(brief.goal).slice(0, 180),
        status: 'queued', priority: '2', payload: { brief, plan_id: plan_id || '', step_id: step_id || '' },
      });
    }
    const preview = shop.inferPreview(brief.client_words || brief.goal || text);
    const target = shop.resolveTarget(brief.client_words || text || '', { projectId, agent });
    preview.target_label = target.label;
    preview.target_kind = target.kind;
    const speak = shop.speakPreview(preview);
    const ask = await this._createAsk(projectId, agent.id, {
      text: speak,
      options: ['Yes', 'No', 'Other'],
      recommended: 'Yes',
      kind: 'preview',
      from_layer: 'user',
      speak_text: speak,
      payload: { ...preview, goal_id: goal.id, task_id: task.id, plan_id: plan_id || '', step_id: step_id || '', claim: preview.claim || target.claim },
    });
    await this._note(projectId, agent.id, { layer: 'manager', type: 'preview', ref_id: ask.id, summary: speak });
    return {
      accepted: true, brief, goal_id: goal.id, task_id: task.id, ask, preview, worker_id: null,
    };
  }

  async _managerReport(projectId, agent, report) {
    const workers = await this.agents.listWorkers(projectId, agent.id);
    const w = workers.find((x) => x.id === report.worker_id) || workers[workers.length - 1];
    const replans = Number(w?.replan_count || 0) + 1;
    if (w && typeof this.agents.updateWorker === 'function') {
      await this.agents.updateWorker(w.id, { replan_count: String(replans), status: replans >= shop.MAX_REPLAN ? 'paused' : 'queued' });
    }
    await this._note(projectId, agent.id, {
      layer: 'manager', type: 'replan', ref_id: w?.id || '', summary: report.tried || report.error || 'retry',
    });
    if (replans >= shop.MAX_REPLAN) {
      const ask = await this._createAsk(projectId, agent.id, {
        text: 'A few approaches did not land. Which way next?',
        options: ['Try another path', 'Narrow the goal', 'Stop', 'Other'],
        recommended: 'Try another path',
        kind: 'choice',
        from_layer: 'user',
        speak_text: 'A few approaches did not land. Which way next?',
        payload: { report, worker_id: w?.id },
      });
      return { ask, replans, options_out: true };
    }
    if (w) await this.runWorker(projectId, agent.id, w.id, { dry: agent.mode !== 'agent', approved: !!w.chunk_grant });
    return { replans, options_out: false, worker_id: w?.id };
  }

  async interrupt(projectId, agentId, body = {}) {
    const agent = await this.agents.resolve(projectId, agentId);
    const note = String(body.content || body.text || body.reason || 'stop');
    const stop = /stop|cancel|abort/i.test(note) || body.stop === true;
    await this.agents.addMessage(projectId, agent.id, { role: 'user', content: `[interrupt] ${note}`, layer: 'user' });
    const workers = await this.agents.listWorkers(projectId, agent.id);
    const jobIds = new Set();
    for (const w of workers) {
      const t = json(w.transcript, []);
      for (const ev of t) if (ev.job_id) jobIds.add(ev.job_id);
    }
    for (const w of workers.filter((x) => x.status === 'running' || x.status === 'queued')) {
      if (typeof this.agents.updateWorker === 'function') {
        await this.agents.updateWorker(w.id, { status: stop ? 'paused' : w.status });
      } else {
        w.status = stop ? 'paused' : w.status;
      }
    }
    if (stop && typeof this.agents.cancelOpenAsks === 'function') {
      await this.agents.cancelOpenAsks(projectId, agent.id);
    }
    if (stop && this.jobs && typeof this.jobs.cancel === 'function') {
      try {
        const msgs = await this.agents.listMessages(projectId, agent.id, { limit: 40 });
        for (const m of msgs) if (m.job_id) jobIds.add(m.job_id);
      } catch { /* */ }
      for (const id of jobIds) {
        try { await this.jobs.cancel(id, projectId); } catch { /* already terminal */ }
      }
    }
    if (stop) {
      const work = await this.agents.listWork(projectId, agent.id);
      for (const item of work.filter((i) => i.status === 'running')) {
        if (typeof this.agents.updateWork === 'function') {
          await this.agents.updateWork(item.id, { status: 'paused' });
        } else {
          item.status = 'paused';
        }
      }
    }
    const reply = stop ? 'Stopped the shop. What should change?' : `Added context for the manager: ${note}`;
    await this.agents.addMessage(projectId, agent.id, { role: 'assistant', content: reply, layer: 'user' });
    this._pulse(projectId, agent.id);
    return { agent_id: agent.id, stopped: !!stop, reply };
  }

  async approve(projectId, agentId, body = {}) {
    const agent = await this.agents.resolve(projectId, agentId);
    if (typeof this.plans.ensureLoaded === 'function') {
      await this.plans.ensureLoaded(projectId, agent.id);
    }
    const askId = body.ask_id || body.id;
    const answer = body.answer || body.choice || body.other || '';
    const ask = await this.agents.approve(projectId, agent.id, askId, answer);
    const payload = json(ask.payload, {});
    const yes = /go ahead|yes|apply|start computer|start browser|merge|run it|ingest/i.test(String(answer));

    if (ask.kind === 'flow_confirm' || ask.kind === 'flow_intake') {
      if (ask.kind === 'flow_intake') {
        const { FlowIntakeService } = require('./FlowIntakeService');
        const flowIntake = new FlowIntakeService(this.agents);
        const advanced = await flowIntake.advance(projectId, agent, answer, {
          flowId: payload.flow_id,
        });
        if (advanced.confirm) {
          const next = await this._createAsk(projectId, agent.id, {
            text: advanced.confirm.text,
            options: advanced.confirm.options,
            recommended: 'Yes',
            kind: 'flow_confirm',
            from_layer: 'user',
            speak_text: advanced.confirm.text,
            payload: { flow_id: advanced.confirm.flow_id, slots: advanced.confirm.slots },
          });
          this._pulse(projectId, agent.id);
          return { ask: next, reply: next.speak_text };
        }
        if (advanced.ask) {
          const next = await this._createAsk(projectId, agent.id, advanced.ask);
          this._pulse(projectId, agent.id);
          return { ask: next, reply: next.speak_text };
        }
      }
      return this._runFlowConfirm(projectId, agent, ask, payload, yes);
    }
    if (ask.kind === 'plan_q') {
      return this._answerPlanQ(projectId, agent, ask, answer, payload);
    }
    if (ask.kind === 'plan') {
      return this._answerPlan(projectId, agent, ask, answer, payload, yes);
    }
    if (ask.kind === 'learn' && (yes || /^ingest$/i.test(answer))) {
      return this._ingestLearn(projectId, agent, ask, payload);
    }
    if (ask.kind === 'cron' && yes) {
      return this._acceptCron(projectId, agent, ask, payload);
    }

    if (ask.kind === 'browse') {
      return this._continueBrowse(projectId, agent, ask, answer, payload);
    }
    if (ask.kind === 'pr') {
      return this._finishPr(projectId, agent, ask, answer, payload);
    }
    if (ask.kind === 'iac' && yes) {
      const Iac = require('./IacShop');
      const result = await Iac.apply(payload.project_id || projectId);
      try { await this.agents.notifyDone(projectId, agent.id, { title: 'Icarus', body: 'Project stack applied.' }); } catch { /* */ }
      this._pulse(projectId, agent.id);
      return { ask, result, reply: 'Project is up.' };
    }

    if (ask.kind === 'preview' && yes) {
      const settings = await this.agents.getSettings(projectId);
      const claim = payload.type === 'browse'
        ? 'browser'
        : (shop.claimPath(payload, payload.path || payload.name || payload.claim) || payload.claim || '');
      const workers = await this.agents.listWorkers(projectId, agent.id);
      const clash = shop.claimClash(workers, claim);
      if (clash) {
        const wait = await this._createAsk(projectId, agent.id, {
          text: 'That path is live with another worker. Wait, pick another folder, or take over?',
          options: ['Wait', 'Other folder', 'Take over'],
          recommended: 'Wait',
          kind: 'choice',
          from_layer: 'user',
          speak_text: 'That folder is already in play. Wait, other folder, or take over?',
          payload: { clash_id: clash.id, claim },
        });
        this._pulse(projectId, agent.id);
        return { ask: wait, blocked: true, reply: wait.speak_text };
      }
      const applied = await this._applyPreview(projectId, agent, settings, payload);
      if (applied?.computer_down) {
        this._pulse(projectId, agent.id);
        return { ask: applied.ask, applied, reply: applied.ask?.speak_text || 'Computer is down.' };
      }
      if (applied?.pending_deploy) {
        this._pulse(projectId, agent.id);
        return { ask: applied.ask || ask, applied, reply: applied.ask?.speak_text || 'Deploy next.' };
      }
      const worker = await this.agents.createWorker(projectId, agent.id, {
        work_item_id: payload.task_id || '',
        persona: payload.type === 'browse' ? 'research' : (agent.mode === 'plan' ? 'research' : 'dev'),
        status: 'queued',
        objective: payload.why || ask.text,
        claim_prefix: claim,
        chunk_grant: ask.id,
        transcript: [{ at: new Date().toISOString(), event: 'preview_yes', payload }],
      });
      if (payload.type === 'browse') {
        const browse = await this._startBrowse(projectId, agent, worker, payload, settings);
        this._pulse(projectId, agent.id);
        return { ask: browse.ask, worker, applied, reply: browse.ask?.speak_text || 'On the site.' };
      }
      await this.runWorker(projectId, agent.id, worker.id, {
        dry: agent.mode !== 'agent',
        approved: agent.mode === 'agent',
      });
      this._pulse(projectId, agent.id);
      return { ask, worker, applied, reply: ask.speak_text || 'On it.' };
    }

    if (ask.kind === 'handoff' && yes) {
      const workers = await this.agents.listWorkers(projectId, agent.id);
      const w = workers.find((x) => x.status === 'queued');
      if (w) {
        if (typeof this.agents.updateWorker === 'function') {
          await this.agents.updateWorker(w.id, { chunk_grant: ask.id });
        }
        await this.runWorker(projectId, agent.id, w.id, { dry: false, approved: true });
      }
    }
    if (ask.kind === 'tool' && yes) {
      const pending = payload;
      if (pending.name) {
        const result = await this.executeApprovedTool(projectId, agent.id, {
          name: pending.name, args: pending.args || {}, actor: body.actor || 'console', approved: true,
          persona: pending.persona, chunkGrant: ask.id,
        });
        this._pulse(projectId, agent.id);
        return { ask, result, reply: `Applied ${pending.name}` };
      }
    }
    if (ask.kind === 'deploy' && yes) {
      const target = payload.target || payload.name;
      if (payload.rollback) {
        const result = await Deploy.run(target, { rollback: true, checkpoint: payload.checkpoint });
        this._pulse(projectId, agent.id);
        return { ask, result, reply: 'Restored the checkpoint.' };
      }
      const result = await Deploy.run(target);
      await this._note(projectId, agent.id, { layer: 'manager', type: 'deploy', summary: String(target) });
      if (result && result.ok === false) {
        const rb = await this._createAsk(projectId, agent.id, {
          text: `Deploy ${target} failed health. Restore the checkpoint and restart?`,
          options: ['Yes', 'No'],
          recommended: 'Yes',
          kind: 'deploy',
          from_layer: 'user',
          speak_text: `Deploy ${target} failed. Roll back?`,
          payload: { target, rollback: true, checkpoint: result.checkpoint },
        });
        this._pulse(projectId, agent.id);
        return { ask: rb, result, reply: rb.speak_text };
      }
      try { await this.agents.notifyDone(projectId, agent.id, { title: 'Icarus', body: `Deploy ${target} healthy.` }); } catch { /* */ }
      this._pulse(projectId, agent.id);
      return { ask, result, reply: Deploy.RECIPES[target]?.speak || `Deploy ${target}` };
    }
    if (/start computer/i.test(String(answer)) || payload.dep === 'computer') {
      await this._healComputer(projectId);
    }
    if (/start browser/i.test(String(answer)) || payload.dep === 'browser') {
      await this._healBrowser(projectId);
    }
    if (ask.kind === 'connect' && answer && !/^cancel|other$/i.test(answer)) {
      this._pulse(projectId, agent.id);
      return { ask, reply: `Connect ${answer} from the Connectors panel (OAuth or API key).` };
    }
    this._pulse(projectId, agent.id);
    return { ask, reply: `Noted: ${answer}` };
  }

  async _applyPreview(projectId, agent, settings, payload) {
    const root = settings.workspace_root || process.cwd();
    const workerId = settings.workspace_worker_id;
    if (payload.type === 'deploy') {
      const target = payload.name || payload.target || 'frontend';
      const denied = Deploy.denyReason(target);
      if (denied) throw fail(403, denied);
      const speak = shop.speakPreview({ type: 'deploy', name: target });
      const ask = await this._createAsk(projectId, agent.id, {
        text: speak,
        options: ['Yes', 'No'],
        recommended: 'Yes',
        kind: 'deploy',
        from_layer: 'user',
        speak_text: speak,
        payload: { target },
      }).catch(() => null);
      return { pending_deploy: true, ask };
    }
    if (payload.type === 'browse' || payload.type === 'iac') {
      return { ok: true, type: payload.type };
    }
    const cmd = this._scaffoldCmd(payload, root);
    if (workerId) {
      if (!cmd) return { ok: true, type: payload.type, remote: true };
      const ran = await this._remoteExec(workerId, root, cmd);
      if (ran.computer_down) {
        const ask = await this._createAsk(projectId, agent.id, {
          text: 'Computer is down. Start it?',
          options: ['Start Computer', 'Type instead', 'Leave it'],
          recommended: 'Start Computer',
          kind: 'confirm',
          from_layer: 'user',
          speak_text: 'Computer is down. Start it, type instead, or leave it?',
          payload: { dep: 'computer' },
        }).catch((e) => e.ask || null);
        return { ...ran, ask };
      }
      return { ...ran, type: payload.type };
    }
    return Scaffold.apply(root, payload);
  }

  _scaffoldCmd(payload, root) {
    const cwd = `cd ${JSON.stringify(root)}`;
    const branch = `icarus/${String(payload.task_id || payload.name || payload.path || 'task').replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 40)}`;
    const gitBranch = `(git rev-parse --is-inside-work-tree >/dev/null 2>&1 && git checkout -B ${JSON.stringify(branch)} || true)`;
    if (payload.type === 'folder') {
      return `${cwd} && mkdir -p ${JSON.stringify(payload.path || payload.name || 'scratch')}`;
    }
    if (payload.type === 'repo') {
      return `${cwd} && mkdir -p ${JSON.stringify(payload.path || payload.name || '.')} && git -C ${JSON.stringify(payload.path || payload.name || '.')} init && ${gitBranch}`;
    }
    if (payload.type === 'service') {
      const n = String(payload.name || 'new_service').replace(/[^a-zA-Z0-9._-]/g, '');
      return `${cwd} && mkdir -p ${JSON.stringify(`aerekos/aerekos-cloud/worker/${n}`)} && printf %s ${JSON.stringify(`# ${n}\n`)} > ${JSON.stringify(`aerekos/aerekos-cloud/worker/${n}/README.md`)} && ${gitBranch}`;
    }
    if (payload.type === 'other') return `${cwd} && ${gitBranch}`;
    return '';
  }

  async waitJob(projectId, jobId, { timeoutMs = 180000, intervalMs = 400 } = {}) {
    if (!jobId || !this.jobs || typeof this.jobs.get !== 'function') return null;
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const snap = await this.jobs.get(jobId, projectId);
      if (['succeeded', 'failed', 'cancelled'].includes(snap?.status)) return snap;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    return { id: jobId, status: 'timeout' };
  }

  async runWorker(projectId, agentId, workerId, { dry = false, approved = false } = {}) {
    const { agent, settings } = await this._ctx(projectId, agentId);
    const workers = await this.agents.listWorkers(projectId, agentId);
    const worker = workers.find((w) => w.id === workerId);
    if (!worker) throw fail(404, 'worker not found');
    if (typeof this.agents.updateWorker === 'function') {
      await this.agents.updateWorker(workerId, { status: 'running' });
    } else {
      worker.status = 'running';
    }
    const root = settings.workspace_root || process.cwd();
    const gw = gatewayFor(projectId, settings);
    const tools = workerToolSchemas();
    const names = tools.map((t) => t.function?.name || t.name).filter(Boolean).join(', ');
    const pack = packText(worker.persona || 'dev');
    const saved = json(worker.messages_json, []);
    const browse = worker.claim_prefix === 'browser' || /browse|browser/i.test(worker.objective || '');
    const cap = browse ? shop.MAX_ACT : shop.MAX_TURNS;
    const board = typeof this.agents.shopBoard === 'function'
      ? await this.agents.shopBoard(projectId, agentId)
      : null;
    const messages = saved.length ? saved : [
      {
        role: 'system',
        content: workerSystem(worker.persona || 'dev', root, pack, json(agent.options, {}), {
          kind: 'claim', claim: worker.claim_prefix || '', label: worker.claim_prefix || root,
        })
          + ` Tools: ${names}. Never approve_pr or merge — open_pr only. Board: ${JSON.stringify({ locks: board?.locks, claim: worker.claim_prefix }).slice(0, 1500)}`,
      },
      { role: 'user', content: worker.objective },
    ];
    const transcript = json(worker.transcript, []);
    transcript.push({ at: new Date().toISOString(), event: 'start', dry });
    let lastJob = null;
    let pendingAsk = null;
    const steps = [];
    let retries = Number(worker.retry_count || 0);
    const grant = worker.chunk_grant || '';

    if (!dry && agent.intelligence) {
      for (let i = 0; i < cap; i += 1) {
        let job = null;
        try {
          job = await gw.enqueue('execute', async () => this.jobs.submit(projectId, {
            intelligence: agent.intelligence,
            messages,
            user_id: `worker:${workerId}`,
            session_id: `agent:${agent.id}:worker:${workerId}`,
            tools,
            tool_choice: 'auto',
            lane: 'execute',
            agent_id: agent.id,
          }), { agentId: agent.id });
        } catch { break; }
        lastJob = job;
        transcript.push({ at: new Date().toISOString(), event: 'job', job_id: job?.id || null, step: i });
        const snap = job?.status === 'succeeded' ? job : await this.waitJob(projectId, job?.id);
        if (!snap || snap.status !== 'succeeded') {
          retries += 1;
          transcript.push({ at: new Date().toISOString(), event: 'job_end', status: snap?.status || 'missing' });
          if (retries >= shop.MAX_RETRY) {
            pendingAsk = await this._reportManager(projectId, agent, worker, { tried: 'model turn', error: snap?.status || 'failed' });
            break;
          }
          continue;
        }
        const result = snap.result || {};
        const calls = extractToolCalls(result);
        const content = result?.message?.content || snap.partial || '';
        if (shop.userFacingImpossible(content)) {
          pendingAsk = await this._reportManager(projectId, agent, worker, { tried: 'model', error: 'refused user-facing impossible' });
          break;
        }
        if (!calls.length) {
          if (!String(content).trim() || !/"success"\s*:\s*true/.test(content)) {
            pendingAsk = await this._reportManager(projectId, agent, worker, { tried: 'empty prose', error: 'not done' });
            break;
          }
          steps.push({ done: true, content });
          break;
        }
        messages.push({ role: 'assistant', content, tool_calls: result?.message?.tool_calls || calls });
        let stopForAsk = false;
        for (const call of calls) {
          if (call.name === 'report_manager') {
            pendingAsk = await this._reportManager(projectId, agent, worker, call.args || {});
            stopForAsk = true;
            break;
          }
          const ran = await this.executeApprovedTool(projectId, agentId, {
            name: call.name,
            args: call.args,
            actor: `worker:${workerId}`,
            approved: approved && !!grant,
            persona: worker.persona || 'dev',
            chunkGrant: grant,
            mode: agent.mode,
            claim: worker.claim_prefix,
            goal: worker.objective,
            workerId,
            preview: json(worker.transcript, [])[0]?.payload || {},
          });
          steps.push({ tool: call.name, pending: !!ran.pending, result: ran.result || null });
          transcript.push({ at: new Date().toISOString(), event: 'tool', name: call.name, pending: !!ran.pending });
          if (ran.denied || ran.result?.denied) {
            retries += 1;
            if (retries >= shop.MAX_RETRY) {
              pendingAsk = await this._reportManager(projectId, agent, worker, {
                tried: call.name, error: ran.result?.error || ran.error || 'denied', deny: true,
              });
              stopForAsk = true;
              break;
            }
          }
          if (ran.pending) {
            pendingAsk = ran.ask;
            stopForAsk = true;
            break;
          }
          messages.push({
            role: 'tool',
            name: call.name,
            content: scrubSecrets(JSON.stringify(ran.result || {}).slice(0, 8000)),
          });
        }
        if (stopForAsk) break;
      }
    } else if (dry) {
      steps.push({ done: true, content: 'plan-only, no writes' });
    }

    const patch = {
      status: pendingAsk ? 'waiting_ask' : (dry ? 'succeeded' : (steps.some((s) => s.done) ? 'succeeded' : 'running')),
      transcript: JSON.stringify(transcript),
      messages_json: JSON.stringify(messages),
      retry_count: String(retries),
      compressed: JSON.stringify({
        success: !pendingAsk,
        data: dry ? 'plan-only, no writes' : (steps[steps.length - 1] || { job_id: lastJob?.id || null }),
        job_id: lastJob?.id || null,
        steps: steps.length,
      }),
    };
    if (typeof this.agents.updateWorker === 'function') {
      await this.agents.updateWorker(workerId, patch);
    } else {
      Object.assign(worker, patch);
    }
    this._pulse(projectId, agent.id);
    return { worker_id: workerId, job_id: lastJob?.id || null, dry, approved, ask: pendingAsk, steps };
  }

  async _reportManager(projectId, agent, worker, report) {
    const payload = { tried: report.tried || '', error: report.error || '', deny: !!report.deny, worker_id: worker.id };
    if (typeof this.agents.sendInter === 'function') {
      try {
        await this.agents.sendInter(projectId, agent.id, agent.id, JSON.stringify(payload));
      } catch { /* */ }
    }
    await this._note(projectId, agent.id, { layer: 'worker', type: 'report_manager', ref_id: worker.id, summary: payload.error });
    return this.runManager(projectId, agent.id, { report: payload });
  }

  async spawnWorker(projectId, agentId, body = {}) {
    const parent = body.parent_worker_id || '';
    const workers = await this.agents.listWorkers(projectId, agentId);
    const clash = shop.claimClash(workers, body.claim_prefix);
    if (clash) throw fail(409, `path claimed by worker ${clash.id}`);
    const worker = await this.agents.createWorker(projectId, agentId, {
      ...body,
      parent_worker_id: parent,
      status: 'queued',
      claim_prefix: body.claim_prefix || `wt-${Date.now().toString(36)}`,
    });
    await this.agents.audit(projectId, agentId, { kind: 'spawn', tool: 'worker', meta: { worker_id: worker.id, parent } });
    return worker;
  }

  async executeApprovedTool(projectId, agentId, {
    name, args, actor, approved = false, persona = 'dev', chunkGrant = '', mode,
    claim = '', goal = '', workerId = '', preview = {}, branch = '',
  }) {
    const { settings, agent } = await this._ctx(projectId, agentId);
    const root = settings.workspace_root || process.cwd();
    const useMode = mode || agent.mode;
    const packed = denyForPersona(persona, name, args);
    if (packed && packed.level === 'deny') {
      const e = fail(403, packed.reason);
      e.denied = true;
      throw e;
    }
    const danger = dangerClassify(name, args, root, persona);
    if (danger.level === 'deny') throw fail(403, danger.reason);

    const { spendCap } = require('./SpendCapService');
    const capHit = spendCap.checkTool(projectId, name);
    if (!capHit.allow) {
      return { result: { ok: false, denied: true, error: capHit.reason, spend_cap: true }, pending: false };
    }

    const { guardToolCall } = require('./ToolSandbox');
    const sandboxBlock = guardToolCall(name, args, { root, projectId, persona });
    if (sandboxBlock) {
      return { result: sandboxBlock, pending: false };
    }

    const mutateBlock = this._mutateGateCheck(name, args, settings);
    if (mutateBlock) {
      return { result: mutateBlock, pending: false };
    }

    const Browser = require('./BrowserSession');
    const verified = shop.verifyTool({ name, args }, {
      goal, claim, preview, mode: useMode, projectId, worker_id: workerId,
      browser_owner: Browser.sessionOf(projectId, agentId)?.owner,
      branch,
      actor,
    });
    if (!verified.ok && verified.level === 'deny') {
      return { result: { ok: false, denied: true, error: verified.reason, report_manager: true }, pending: false };
    }
    if (verified.ask || verified.hitl) {
      const ask = await this._createAsk(projectId, agentId, {
        text: verified.reason,
        options: verified.hitl ? ['Take over', 'Skip', 'Other'] : ['Go ahead', 'Skip', 'Other'],
        recommended: verified.hitl ? 'Take over' : 'Go ahead',
        kind: verified.hitl ? 'confirm' : 'tool',
        from_layer: 'user',
        speak_text: verified.reason,
        payload: { name, args, persona, claim, hitl: !!verified.hitl },
      });
      return { ask, pending: true, hitl: !!verified.hitl };
    }

    if (name === 'submit_brief' || name === 'update_brief') {
      const openPlan = this.plans.list(projectId, agentId).find((p) => p.status === 'accepted' || p.status === 'running');
      const verified = shop.verifyTool({ name, args }, { requirePlan: shop.needsPlan(args.goal || args.client_words || ''), planAccepted: !!openPlan });
      if (!verified.ok && verified.level === 'deny') {
        return { result: { ok: false, error: verified.reason }, pending: false };
      }
      const brief = typeof this.agents.upsertBrief === 'function'
        ? await this.agents.upsertBrief(projectId, agentId, args)
        : args;
      return { result: { ok: true, brief }, pending: false };
    }
    if (name === 'open_plan_q' || name === 'propose_plan' || name === 'revise_plan') {
      const settings = await this.agents.getSettings(projectId);
      const agent = await this.agents.resolve(projectId, agentId);
      if (name === 'revise_plan') {
        return this._revisePlanFromChat(projectId, agent, settings, { text: args.note || args.text || '' }, null);
      }
      return this._startPlan(projectId, agent, settings, { text: args.origin || args.text || '', userId: actor }, shop.inferPreview(args.origin || ''));
    }
    if (name === 'learn_propose') {
      const agent = await this.agents.resolve(projectId, agentId);
      return this._startLearnAsk(projectId, agent, { sources: args.sources, text: args.text || '' }, { grant: chunkGrant });
    }
    if (name === 'learn_ingest') {
      const verified = shop.verifyTool({ name, args }, {
        chunkGrant, preview: { type: 'learn' }, askKind: 'learn', planAccepted: !!chunkGrant,
      });
      if (!verified.ok) {
        const ask = await this._createAsk(projectId, agentId, {
          text: 'Ingest these sources into skills?',
          options: ['Ingest', 'Skip', 'Other'],
          recommended: 'Ingest',
          kind: 'learn',
          from_layer: 'user',
          speak_text: 'Ingest into skills?',
          payload: args,
        });
        return { ask, pending: true };
      }
      const agent = await this.agents.resolve(projectId, agentId);
      return this._ingestLearn(projectId, agent, { payload: JSON.stringify(args) }, args);
    }
    if (name === 'open_ask') {
      const ask = await this._createAsk(projectId, agentId, {
        text: args.text || args.question,
        options: args.options || ['Yes', 'No', 'Other'],
        recommended: args.recommended,
        kind: args.kind || 'free_text',
        from_layer: 'user',
        speak_text: args.speak_text || args.text,
        payload: args,
      });
      return { ask, pending: true };
    }
    if (name === 'preview') {
      const p = { type: args.type || 'other', path: args.path, name: args.name, why: args.why };
      const speak = shop.speakPreview(p);
      const ask = await this._createAsk(projectId, agentId, {
        text: speak, options: ['Yes', 'No', 'Other'], recommended: 'Yes',
        kind: 'preview', from_layer: 'user', speak_text: speak, payload: p,
      });
      return { ask, pending: true };
    }
    if (name === 'propose_deploy') {
      const proposed = await Deploy.propose(args.target);
      const speak = shop.speakPreview({ type: 'deploy', name: args.target });
      const ask = await this._createAsk(projectId, agentId, {
        text: speak, options: ['Yes', 'No'], recommended: 'Yes',
        kind: 'deploy', from_layer: 'user', speak_text: speak, payload: { target: args.target, proposed },
      });
      return { ask, pending: true };
    }
    if (name === 'report_manager') {
      return { result: { ok: true, reported: true, ...args }, pending: false, report: true };
    }
    if (name === 'report_user') {
      const ask = await this._createAsk(projectId, agentId, {
        text: args.text || args.message || 'Options for you',
        options: args.options || ['OK', 'Other'],
        recommended: Array.isArray(args.options) ? args.options[0] : 'OK',
        kind: 'choice',
        from_layer: 'user',
        speak_text: args.speak_text || args.text || 'Options for you',
        payload: args,
      });
      return { ask, pending: true };
    }
    if (name === 'ui_navigate') {
      return {
        result: { ok: true, navigate: String(args.path || '/'), note: String(args.note || '') },
        pending: false,
      };
    }
    if (name === 'project_create') {
      const ask = await this._createAsk(projectId, agentId, {
        text: `Create project "${args.name || 'new'}"${args.template ? ` from ${args.template}` : ''}?`,
        options: ['Yes', 'No', 'Other'],
        recommended: 'Yes',
        kind: 'confirm',
        from_layer: 'user',
        speak_text: `Create project ${args.name || ''}?`,
        payload: { name: 'project_create', args },
      });
      return { ask, pending: true };
    }
    if (name === 'spawn_worker') {
      const worker = await this.spawnWorker(projectId, agentId, {
        persona: args.persona || 'dev',
        objective: args.objective || args.goal || '',
        claim_prefix: args.claim || args.claim_prefix || '',
        parent_worker_id: workerId || '',
      });
      return { result: { ok: true, worker }, pending: false };
    }
    if (name === 'update_work') {
      const id = args.work_id || args.id;
      if (!id) throw fail(400, 'work_id required');
      const patch = {};
      if (args.status != null) patch.status = String(args.status);
      if (args.title != null) patch.title = String(args.title).slice(0, 180);
      if (args.priority != null) patch.priority = String(args.priority);
      const item = await this.agents.updateWork(id, patch);
      return { result: { ok: true, work: item }, pending: false };
    }
    if (name === 'aerekos_status' || name === 'aerekos_search_docs' || name === 'aerekos_call'
      || name === 'rag_ingest' || name === 'data_api_apply' || name === 'project_services'
      || name === 'safe_deps_detect' || name === 'safe_deps_upgrade' || name === 'safe_deps_rollback') {
      const PlatformToolkit = require('./PlatformToolkit');
      return PlatformToolkit.execute(projectId, agentId, name, args, {
        approved, runtime: this, settings, agent,
      });
    }
    if (name === 'replan_worker') {
      const wid = args.worker_id || workerId;
      const mgr = await this.runManager(projectId, agentId, {
        report: { worker_id: wid, tried: args.note || args.tried || 'replan', error: args.error || '' },
      });
      return { result: { ok: true, ...mgr }, pending: !!mgr?.ask, ask: mgr?.ask };
    }
    if (name === 'approve_pr') {
      return this._approvePrTool(projectId, agentId, args);
    }
    if (name === 'lora_propose') {
      return this._loraProposeTool(projectId, agentId, args, { approved, chunkGrant });
    }
    if (name === 'plan_query' || name === 'plan_ready' || name === 'plan_subgraph' || name === 'explain_why') {
      return this._icarusGraphTool(projectId, agentId, name, args, settings);
    }
    if (name === 'scaffold' || name === 'file_rollback') {
      const result = await this._runTool(name, { ...args, claim }, settings, projectId, persona);
      return { result, pending: false };
    }
    if (name === 'iac_schema' || name === 'iac_put' || name === 'iac_diff' || name === 'iac_apply' || name === 'iac_rollback') {
      return this._iacTool(projectId, agentId, name, args, { approved, chunkGrant });
    }
    if (name === 'open_pr') {
      return this._openPr(projectId, agentId, args, { claim, workerId });
    }
    if (String(name).startsWith('browser_')) {
      return this._browserTool(projectId, agentId, name, args, { settings, workerId, mode: useMode });
    }
    if (name === 'git_push' && !approved) {
      const ask = await this._createAsk(projectId, agentId, {
        text: 'Push this branch? Sound good?',
        options: ['Go ahead', 'Skip', 'Other'],
        recommended: 'Go ahead',
        kind: 'tool',
        from_layer: 'user',
        speak_text: 'Push this branch?',
        payload: { name, args, persona, claim },
      });
      return { ask, pending: true };
    }

    const write = classifyTool(name, args) === 'write';
    if (write && useMode === 'plan' && (persona === 'research' || String(actor || '').startsWith('worker:'))) {
      throw fail(403, 'plan mode is read-only');
    }
    if (write && useMode === 'agent' && String(actor || '').startsWith('worker:') && !shop.canWrite({ mode: useMode, chunkGrant, approved })) {
      return {
        result: { ok: false, error: 'need preview grant', report_manager: true },
        pending: false,
      };
    }
    const exceptions = settings.write_exceptions || [];
    const pinned = exceptions.includes(name);
    if (write && settings.write_policy === 'ask_writes' && !pinned && !approved && !chunkGrant) {
      const ask = await this._createAsk(projectId, agentId, {
        text: `Allow ${name}? ${danger.reason}`,
        options: ['Go ahead', 'Skip', 'Other'],
        recommended: 'Go ahead',
        kind: 'tool',
        payload: { name, args, persona, claim },
        from_layer: 'user',
        speak_text: `Allow ${name}?`,
      });
      return { ask, pending: true };
    }
    if (name === 'connector.invoke') {
      const result = await this.connectors.invoke(projectId, args, {
        audit: (row) => this.agents.audit(projectId, agentId, { actor, ...row }),
      });
      return { result, pending: false };
    }
    if (name === 'web_search' || name === 'semantic_search') {
      const result = await this._lookup(projectId, agent, name, args, settings);
      await this.agents.audit(projectId, agentId, { actor, kind: 'tool', tool: name, meta: { q: args.q || args.query } });
      return { result, pending: false };
    }
    if (name === 'web_fetch') {
      const Web = require('./WebSearchService');
      const result = await Web.webFetch(args.url);
      return { result, pending: false };
    }
    await this.agents.audit(projectId, agentId, {
      actor, kind: 'tool', tool: name, meta: { name, task_id: args.task_id || '', worker_id: workerId || '' },
    });
    if (write && workerId && String(actor || '').startsWith('worker:')) {
      await this._ensureCheckpoint(workerId, settings, projectId, persona, claim);
    }
    const result = await this._runTool(name, { ...args, claim }, settings, projectId, persona);
    try {
      const { forProject } = require('./IcarusFacade');
      forProject(projectId, settings).ledger.append({
        projectId,
        agentId,
        lane: String(actor || '').startsWith('worker:') ? 'execute' : 'user',
        tool: name,
        taskId: args.task_id || args.taskId || '',
        workerId: workerId || '',
        args: { ...args, task_id: args.task_id || args.taskId || '' },
        ok: result?.ok !== false && !result?.error,
        after: { ok: result?.ok !== false },
      });
    } catch { /* live ledger optional */ }
    if (result.snapshot && result.path) {
      this._snaps = this._snaps || new Map();
      this._snaps.set(`${projectId}:${result.path}`, result.snapshot);
      const ck = workerId && this._checkpoints.get(workerId);
      if (ck && result.path) ck.snaps[result.path] = result.snapshot;
    }
    if (result.computer_down) {
      const ask = await this._createAsk(projectId, agentId, {
        text: 'Computer is down. Start it?',
        options: ['Start Computer', 'Type instead', 'Leave it'],
        recommended: 'Start Computer',
        kind: 'confirm',
        from_layer: 'user',
        speak_text: 'Computer is down. Start it, type instead, or leave it?',
        payload: { dep: 'computer' },
      }).catch((e) => e.ask || null);
      return { ask, pending: true, result };
    }
    if (['file_edit', 'file_write', 'file_delete'].includes(name) && result?.ok !== false) {
      await this._emitIdeFile(projectId, agentId, {
        path: args.path,
        content: name === 'file_write' ? args.content : undefined,
        patch: name === 'file_edit' ? { old: args.old, new: args.new } : undefined,
        ref: branch || undefined,
      });
    }
    if (write && workerId && String(actor || '').startsWith('worker:') && name !== 'run_checks') {
      return this._afterMutate(projectId, agentId, {
        workerId, settings, persona, claim, result, actor,
      });
    }
    return { result, pending: false };
  }

  async _ensureCheckpoint(workerId, settings, projectId, persona, claim) {
    if (this._checkpoints.get(workerId)) return;
    const branch = `icarus/${String(workerId || 'task').replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 40)}`;
    await this._runTool('git_checkout', { branch, create: branch }, settings, projectId, persona);
    const head = await this._runTool('shell', { cmd: 'git rev-parse HEAD' }, settings, projectId, persona);
    this._checkpoints.set(workerId, {
      head: String(head.stdout || head.content || '').trim(),
      claim: claim || '',
      snaps: {},
      branch,
    });
  }

  _checksPassed(checks) {
    if (!checks) return false;
    if (checks.passed === true) return true;
    if (checks.passed === false) return false;
    const blob = `${checks.stdout || ''} ${checks.stderr || ''} ${checks.error || ''}`;
    if (/\bFAIL\b|Tests:\s*[1-9]\d*\s+failed/i.test(blob)) return false;
    return checks.ok !== false;
  }

  async _afterMutate(projectId, agentId, { workerId, settings, persona, claim, result, actor }) {
    const checks = await this._runTool('run_checks', { claim: claim || '.' }, settings, projectId, persona);
    if (this._checksPassed(checks)) {
      return { result: { ...result, checks }, pending: false };
    }
    const rolled = await this._rollbackClaim(workerId, settings, projectId, persona, claim);
    const workers = typeof this.agents.listWorkers === 'function'
      ? await this.agents.listWorkers(projectId, agentId) : [];
    const w = workers.find((x) => x.id === workerId);
    const n = Number(w?.replan_count || 0) + 1;
    if (w && typeof this.agents.updateWorker === 'function') {
      await this.agents.updateWorker(workerId, { replan_count: String(n) });
    }
    if (n >= shop.MAX_REPLAN) {
      const ask = await this._createAsk(projectId, agentId, {
        text: 'Rolled back. Checks still fail. Try another path, narrow, or stop?',
        options: ['Try another path', 'Narrow the goal', 'Stop', 'Other'],
        recommended: 'Try another path',
        kind: 'choice',
        from_layer: 'user',
        speak_text: 'Rolled back the chunk. Try another path, narrow, or stop?',
        payload: { worker_id: workerId, rolled_back: true, checks },
      });
      return { result: { ...result, checks, rolled_back: true }, ask, pending: true };
    }
    void actor;
    return {
      result: { ok: false, checks, rolled_back: true, ...rolled, report_manager: true },
      pending: false,
    };
  }

  /** Context-Gate / Done-Gate / InfoVerifyGate — fail closed on mutate (write) tools when flags set. */
  _mutateGateCheck(name, args, settings = {}) {
    const { classifyTool } = require('./workspaceTools');
    if (classifyTool(name, args) !== 'write') return null;

    if (settings.context_gate_deny === true || settings.block_mutate === true) {
      return { ok: false, denied: true, error: 'Context-Gate denied mutate tool' };
    }

    const requireDone = settings.require_done_gate === true
      || process.env.ICARUS_REQUIRE_DONE_GATE === '1';
    if (requireDone) {
      try {
        const { layaDecision } = require('./LayaDecisionService');
        const st = settings.done_gate_state || settings.gate_state || {};
        const hit = layaDecision.predict(st, { done_gate: {} });
        const choice = hit?.answers?.done_gate?.choice || 'retry';
        if (choice !== 'complete') {
          return { ok: false, denied: true, error: `done_gate: ${choice}` };
        }
      } catch {
        return { ok: false, denied: true, error: 'done_gate: unavailable' };
      }
    }

    if (settings.info_verify_required === true) {
      try {
        require('./InfoVerifyGate');
        return { ok: false, denied: true, error: 'InfoVerifyGate: verification required before mutate' };
      } catch {
        return { ok: false, denied: true, error: 'InfoVerifyGate unavailable' };
      }
    }

    return null;
  }

  async _rollbackClaim(workerId, settings, projectId, persona, claim) {
    const ck = this._checkpoints.get(workerId) || { snaps: {} };
    const paths = Object.keys(ck.snaps || {});
    for (const p of paths) {
      const snap = ck.snaps[p];
      await this._runTool('file_rollback', { path: p, content: snap?.content || '' }, settings, projectId, persona);
    }
    if (claim && ck.head) {
      await this._runTool('shell', {
        cmd: `git checkout ${JSON.stringify(ck.head)} -- ${JSON.stringify(claim)} || true`,
      }, settings, projectId, persona);
    }
    return { rolled_back: true, files: paths };
  }

  async _runTool(name, args, settings, projectId, persona = 'dev') {
    const root = settings.workspace_root || process.cwd();
    const { guardToolCall } = require('./ToolSandbox');
    const sandboxBlock = guardToolCall(name, args, { root, projectId, persona });
    if (sandboxBlock) return sandboxBlock;
    const mutateBlock = this._mutateGateCheck(name, args, settings);
    if (mutateBlock) return mutateBlock;
    const workerId = settings.workspace_worker_id;
    const remote = workerId && (REMOTE_TOOLS.has(name) || String(name).startsWith('git_'));
    if (remote) {
      if (name === 'file_edit') {
        const read = await this._remoteExec(workerId, root, `cat -- ${JSON.stringify(args.path || '')}`);
        if (read.computer_down || !read.ok) return read;
        const cur = String(read.stdout || '');
        const next = cur.split(String(args.old || args.find || '')).join(String(args.new || args.replace || ''));
        const writeCmd = `mkdir -p "$(dirname ${JSON.stringify(args.path)})" && printf %s ${JSON.stringify(next)} > ${JSON.stringify(args.path)}`;
        return this._remoteExec(workerId, root, writeCmd);
      }
      const cmd = this._toolToShell(name, args, root);
      if (!cmd) return { ok: false, error: `no remote mapping for ${name}` };
      return this._remoteExec(workerId, root, cmd.replace(/^cd .*? && /, ''));
    }
    return executeTool(name, args, { root, projectId, persona });
  }

  async _remoteExec(workerId, root, cmd) {
    try {
      const { proxy } = require('../../../shared/conductorProxy');
      const full = `cd ${JSON.stringify(root)} && ${cmd}`;
      const res = await proxy('POST', `/api/workers/${encodeURIComponent(workerId)}/containers/${encodeURIComponent('aerekos-icarus-workspace')}/exec`, {
        timeout: 30000,
        data: { cmd: ['sh', '-lc', full] },
      });
      if ((res.status || 200) < 400) {
        const stdout = scrubSecrets(String(res.data?.stdout || res.data?.output || JSON.stringify(res.data || {})).slice(0, 8000));
        return { ok: true, remote: true, stdout };
      }
      return { ok: false, computer_down: true, error: `computer exec HTTP ${res.status}`, ask: 'Start Computer' };
    } catch (e) {
      return { ok: false, computer_down: true, error: e.message || 'computer down', ask: 'Start Computer' };
    }
  }

  _toolToShell(name, args, root) {
    const cwd = `cd ${JSON.stringify(root)}`;
    if (name === 'file_read') return `${cwd} && cat -- ${JSON.stringify(args.path || '')}`;
    if (name === 'file_list') return `${cwd} && ls -1 -- ${JSON.stringify(args.path || '.')} | head -n 80`;
    if (name === 'file_write') {
      return `${cwd} && mkdir -p "$(dirname ${JSON.stringify(args.path)})" && printf %s ${JSON.stringify(String(args.content ?? args.body ?? ''))} > ${JSON.stringify(args.path)}`;
    }
    if (name === 'file_delete') return `${cwd} && rm -f -- ${JSON.stringify(args.path || '')}`;
    if (name === 'shell') return `${cwd} && ${args.cmd || args.command || 'true'}`;
    if (name === 'grep' || name === 'file_search') {
      return `${cwd} && grep -R -n -- ${JSON.stringify(args.pattern || args.query || '')} ${JSON.stringify(args.path || '.')} | head -n 50 || true`;
    }
    if (name === 'git_status') return `${cwd} && git status --short`;
    if (name === 'git_diff') return `${cwd} && git diff -- ${JSON.stringify(args.path || '')}`;
    if (name === 'git_log') return `${cwd} && git log -n 12 --oneline`;
    if (name === 'git_commit') return `${cwd} && ${shop.gitAddCmd(args.claim || args.path, args.message)}`;
    if (name === 'git_push') return `${cwd} && git push origin ${JSON.stringify(args.branch || 'HEAD')}`;
    if (name === 'git_checkout') {
      const b = String(args.branch || args.create || 'HEAD');
      if (args.create) return `${cwd} && git checkout -B ${JSON.stringify(args.create || b)}`;
      return `${cwd} && git checkout ${JSON.stringify(b)}`;
    }
    if (name === 'run_checks') {
      const claim = String(args.claim || args.path || '.');
      const inAi = /ai_manager/.test(claim);
      const pattern = inAi
        ? 'tests/unit --testPathPattern="shop|agents.e2e|learnNav|offgrid"'
        : '--testPathPattern=tests/unit';
      return `${cwd} && cd ${JSON.stringify(claim)} 2>/dev/null || cd .; npx jest ${pattern} --no-coverage`;
    }
    if (name === 'file_rollback') {
      const content = args.content != null ? String(args.content) : String(args.snapshot?.content || '');
      return `${cwd} && mkdir -p "$(dirname ${JSON.stringify(args.path)})" && printf %s ${JSON.stringify(content)} > ${JSON.stringify(args.path)}`;
    }
    if (String(name).startsWith('git_')) return `${cwd} && git ${name.replace('git_', '')}`;
    return '';
  }

  async _lookup(projectId, agent, name, args, settings = {}) {
    const q = String(args.q || args.query || args.pattern || '');
    if (name === 'web_search') {
      const Web = require('./WebSearchService');
      return Web.webSearch(q, { url: settings.web_search_url || process.env.WEB_SEARCH_URL });
    }
    if (name === 'semantic_search' && agent.rag_collection) {
      try {
        const { RagCollectionService } = require('./RagCollectionService');
        const rag = new RagCollectionService();
        return await rag.search(projectId, agent.rag_collection, { query: q, top_k: 8 });
      } catch (e) {
        return { ok: false, stub: false, note: e.message };
      }
    }
    try {
      const { proxy } = require('../../../shared/conductorProxy');
      const res = await proxy('POST', '/api/services/search_manager/api/v1/query', {
        projectId, timeout: 15000, data: { project_id: projectId, q },
      });
      return { ok: (res.status || 200) < 400, results: res.data };
    } catch (e) {
      return { ok: false, query: q, note: e.message || 'search_manager unavailable' };
    }
  }

  async _healComputer(projectId) {
    const settings = await this.agents.getSettings(projectId);
    if (!settings.workspace_worker_id) return { healed: false };
    try {
      const { EngineService } = require('./EngineService');
      const engines = new EngineService();
      const found = await engines.inspectOnWorker(settings.workspace_worker_id, 'aerekos-icarus-workspace');
      return engines.healNamed(settings.workspace_worker_id, 'aerekos-icarus-workspace', found || {});
    } catch (e) {
      return { healed: false, error: e.message };
    }
  }

  async compact(projectId, agentId) {
    const { agent, settings, pins, rolls } = await this._ctx(projectId, agentId);
    const asks = await this.agents.listAsks(projectId, agent.id);
    const open = asks.filter((a) => a.status === 'open');
    const gw = gatewayFor(projectId, settings);
    let job = null;
    if (agent.intelligence) {
      try {
        job = await gw.enqueue('compact', async () => this.jobs.submit(projectId, {
          intelligence: agent.intelligence,
          messages: [
            {
              role: 'system',
              content: 'Compact conversation into temporal rolls. Never compact rules, pins, active DoD, or open ASK cards.',
            },
            {
              role: 'user',
              content: scrubSecrets(JSON.stringify({
                pins: pins.map((p) => p.key),
                rolls: Object.keys(rolls),
                open_asks: open.map((a) => a.id),
              })),
            },
          ],
          user_id: `compact:${agent.id}`,
          session_id: `agent:${agent.id}:compact`,
          lane: 'compact',
          agent_id: agent.id,
        }), { agentId: agent.id });
      } catch { /* */ }
    }
    await this.refreshRolls(projectId, agent.id);
    return { job_id: job?.id || null, preserved: { pins: pins.length, open_asks: open.length } };
  }

  async fsList(projectId, rel = '.') {
    const settings = await this.agents.getSettings(projectId);
    if (settings.workspace_worker_id) {
      const ran = await this._runTool('file_list', { path: rel }, settings, projectId);
      if (ran.computer_down) return { entries: [], root: settings.workspace_root, path: rel, computer_down: true };
      const names = String(ran.stdout || '').split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 80);
      return { root: settings.workspace_root, path: rel, entries: names.map((name) => ({ name, dir: false })), remote: true };
    }
    const root = settings.workspace_root || process.cwd();
    const p = resolveInWorkspace(root, rel);
    if (!fs.existsSync(p)) return { entries: [], root, path: rel };
    const stat = fs.statSync(p);
    if (stat.isFile()) return { file: true, path: rel, content: fs.readFileSync(p, 'utf8').slice(0, 200000) };
    return {
      root, path: rel,
      entries: fs.readdirSync(p, { withFileTypes: true }).slice(0, 80).map((e) => ({
        name: e.name, dir: e.isDirectory(),
      })),
    };
  }

  async fsWrite(projectId, agentId, { path: rel, content, actor }) {
    return this.executeApprovedTool(projectId, agentId, {
      name: 'file_write', args: { path: rel, content }, actor,
    });
  }

  async term(projectId, agentId, { cmd, actor }) {
    return this.executeApprovedTool(projectId, agentId, {
      name: 'shell', args: { cmd }, actor,
    });
  }

  async voice(projectId, agentId, body = {}) {
    const agent = await this.agents.resolve(projectId, agentId);
    let transcript = String(body.transcript || body.text || '').trim();
    if (!transcript && (body.audio_base64 || body.audio)) {
      try {
        const { VoiceProxyService } = require('./VoiceProxyService');
        const voice = new VoiceProxyService();
        const buf = Buffer.from(body.audio_base64 || body.audio, 'base64');
        const stt = await voice.transcribe(buf, { language: agent.language || 'en' });
        transcript = String(stt.text || stt.transcript || stt.result || '').trim();
      } catch (e) {
        const ask = await this._createAsk(projectId, agent.id, {
          text: 'Speech is down. Type instead?',
          options: ['Type instead', 'Retry', 'Leave it'],
          recommended: 'Type instead',
          kind: 'confirm',
          from_layer: 'user',
          speak_text: 'Speech is down. Type instead, retry, or leave it?',
          payload: { dep: 'stt' },
        }).catch((err) => err.ask || null);
        const wrapped = fail(e.status || 502, e.message || 'STT failed');
        wrapped.ask = ask;
        throw wrapped;
      }
    }
    if (!transcript) throw fail(400, 'transcript or audio_base64 required (or call STT ARN separately)');
    const asks = await this.agents.listAsks(projectId, agent.id);
    const open = (asks || []).find((a) => a.status === 'open');
    const intent = shop.voiceIntent(transcript, open);
    let turn;
    if (intent.action === 'interrupt') {
      turn = await this.interrupt(projectId, agent.id, { content: 'stop', stop: true });
    } else if (intent.action === 'approve' && open) {
      turn = await this.approve(projectId, agent.id, { ask_id: open.id, answer: intent.answer });
    } else {
      turn = await this.chat(projectId, agent.id, { ...body, content: transcript });
    }
    const spoken = turn.ask?.speak_text || turn.reply || '';
    let audio_base64 = null;
    if (agent.tts && spoken) {
      try {
        const { VoiceProxyService } = require('./VoiceProxyService');
        const voice = new VoiceProxyService();
        const out = await voice.synthesize({ text: spoken, voice: agent.voice || undefined });
        audio_base64 = Buffer.from(out.buffer || []).toString('base64');
      } catch { /* TTS optional */ }
    }
    return {
      ...turn,
      transcript,
      audio_base64,
      stt: agent.stt || null,
      tts: agent.tts || null,
      voice: agent.voice || null,
      compose: true,
      hint: 'Apps may call STT/TTS ARNs themselves; this is optional compose.',
    };
  }

  async refreshRolls(projectId, agentId) {
    const { agent, pins } = await this._ctx(projectId, agentId);
    const now = new Date().toLocaleString('en-US', { timeZone: agent.timezone || 'America/Los_Angeles' });
    const pinTxt = pins.map((p) => `${p.key}=${p.value}`).join('; ');
    for (const h of ['today', 'tomorrow', 'week', 'month', 'year']) {
      await this.agents.upsertRoll(projectId, agent.id, h, `As of ${now}. Pins: ${pinTxt || 'none'}.`);
    }
    return this.agents.getRolls(projectId, agent.id);
  }

  async resume(projectId) {
    await this._healComputer(projectId).catch(() => ({}));
    await this._healBrowser(projectId).catch(() => ({}));
    const agents = await this.agents.list(projectId);
    let n = 0;
    const cronUser = [];
    const cronIdle = [];
    for (const a of agents) {
      if (typeof this.plans.ensureLoaded === 'function') {
        await this.plans.ensureLoaded(projectId, a.id);
      }
      const crons = typeof this.agents.listCron === 'function' ? await this.agents.listCron(projectId, a.id) : [];
      for (const c of crons || []) {
        const { dueCron } = require('./cronMatch');
        const d = dueCron(c, new Date(), { catchup: true });
        if (!d.due) continue;
        const handoff = json(c.handoff, {});
        const item = { agent: a, cron: c, late: d.late, label: d.label, kind: handoff.kind };
        if (item.kind === 'idle_review') cronIdle.push(item);
        else cronUser.push(item);
      }
    }
    for (const item of cronUser) {
      await this.fireCron(projectId, item.agent.id, item.cron.id, { late: item.late, label: item.label });
      n += 1;
    }
    for (const a of agents) {
      n += await this._resumeLearnJobs(projectId, a.id);
    }
    for (const a of agents) {
      const workers = await this.agents.listWorkers(projectId, a.id);
      const work = await this.agents.listWork(projectId, a.id);
      const ordered = shop.nextByPriority(
        workers.filter((x) => ['running', 'queued'].includes(x.status)),
        work,
      );
      for (const w of ordered) {
        await this.runWorker(projectId, a.id, w.id, { dry: a.mode !== 'agent', approved: !!w.chunk_grant });
        n += 1;
      }
    }
    if (n === 0) {
      for (const item of cronIdle) {
        await this.fireCron(projectId, item.agent.id, item.cron.id, { late: item.late, label: item.label });
        n += 1;
      }
    }
    return { resumed: n };
  }

  async _resumeLearnJobs(projectId, agentId) {
    let n = 0;
    const jobs = typeof this.learn.listResumable === 'function'
      ? await this.learn.listResumable(projectId, agentId)
      : [...(this.learn.jobs?.values?.() || [])].filter((j) => j.agent_id === agentId && j.project_id === projectId);
    for (const job of jobs) {
      if (!['fetching', 'ingesting', 'waiting_net', 'waiting_computer', 'queued'].includes(job.status)) continue;
      const agent = await this.agents.resolve(projectId, agentId);
      if (job.status === 'ingesting') {
        await this.learn.ingestRemaining(job.id, {
          rag: { ingest: async (col, pid, body) => this._ragIngest(pid, agent, body) },
          collection: agent.rag_collection,
          projectId,
        });
      } else {
        await this.learn.fetchRemaining(job.id, { fetchImpl: (url) => this._fetchLearnPage(projectId, url) });
      }
      n += 1;
    }
    return n;
  }

  async fireCron(projectId, agentId, cronId, { late = false, label = '' } = {}) {
    const rows = await this.agents.listCron(projectId, agentId);
    const row = (rows || []).find((c) => c.id === cronId);
    if (!row) throw fail(404, 'cron not found');
    const handoff = json(row.handoff, {});
    const kind = handoff.kind || 'user_turn';
    const objective = handoff.objective || row.name;
    const prefix = late || label ? `${label || 'I was down.'} ` : '';
    if (typeof this.agents.updateCron === 'function') {
      await this.agents.updateCron(cronId, {
        last_fired_at: new Date().toISOString(),
        enabled: (row.kind === 'once' || row.run_at) ? 'false' : row.enabled,
        last_error: '',
      });
    } else if (row) {
      row.last_fired_at = new Date().toISOString();
      if (row.kind === 'once' || row.run_at) row.enabled = 'false';
    }
    const agent = await this.agents.resolve(projectId, agentId);
    const asks = await this.agents.listAsks(projectId, agent.id);
    const open = (asks || []).find((a) => a.status === 'open');
    if (kind === 'idle_review') {
      return this._runIdleReview(projectId, agent, { open });
    }
    if (kind === 'shop') {
      return this._startPlan(projectId, agent, await this.agents.getSettings(projectId), { text: objective }, shop.inferPreview(objective));
    }
    const Web = require('./WebSearchService');
    let body = `${prefix}${objective}`;
    try {
      const hit = await Web.webSearch(objective);
      if (hit?.ok && hit.results?.length) {
        body = `${prefix}${objective}: ${(hit.results || []).slice(0, 3).map((r) => r.title || r.url).join('; ')}`;
      } else if (!hit?.ok && /enotfound|network|offline/i.test(String(hit?.error || ''))) {
        body = `${prefix}Internet is out. I'll continue ${objective} when we're back.`;
      }
    } catch (e) {
      body = `${prefix}${objective} (${e.message})`;
    }
    await this.agents.addMessage(projectId, agent.id, { role: 'assistant', content: body, layer: 'user' });
    try {
      await this.agents.notifyDone(projectId, agent.id, { title: 'Icarus', body });
    } catch { /* queue-only */ }
    this._pulse(projectId, agent.id);
    return { ok: true, cron_id: cronId, kind, reply: body, queued_behind_ask: !!open };
  }

  async _runIdleReview(projectId, agent, { open } = {}) {
    const { cheapScan, findingsToPlan, shouldSkipIdle } = require('./IdleReviewService');
    const { SYSTEM_PROJECT_ID } = require('./layerContext');
    const settings = await this.agents.getSettings(projectId);
    const gw = gatewayFor(projectId, settings);
    const workers = await this.agents.listWorkers(projectId, agent.id);
    const skip = shouldSkipIdle({ gateway: gw, workers, projectId });
    if (skip) return { ok: true, skipped: skip };
    if (projectId !== SYSTEM_PROJECT_ID && !json(agent.options, {}).watch_repo) {
      return { ok: true, skipped: 'watch-ask' };
    }
    if (typeof this.plans.ensureLoaded === 'function') {
      await this.plans.ensureLoaded(projectId, agent.id);
    }
    if (typeof this.learn.hydrate === 'function') {
      await this.learn.hydrate(projectId, agent.id);
    }
    let files = [];
    try {
      const listed = await this.fsList(projectId, 'worker');
      files = listed?.entries || listed?.items || [];
    } catch { /* */ }
    const scan = cheapScan({ files: files.map((e) => e.name || e.path || e) });
    if (scan.deny) return { ok: true, skipped: scan.deny };
    const findings = [...(scan.findings || [])];
    const stale = typeof this.learn.staleSources === 'function' ? this.learn.staleSources() : [];
    if (stale.length && findings.length < 3) {
      findings.push({
        title: 'Skills sources past TTL',
        path: stale[0].url,
        kind: 'learn',
        step: `ASK to refresh ${stale[0].url} (never silent ingest)`,
      });
    }
    const draft = findingsToPlan(findings);
    if (!draft) return { ok: true, findings: [] };
    if (!this.plans.canProposeIdle(projectId, agent.id)) return { ok: true, capped: true };
    if (this.plans.dedupeIdle(projectId, agent.id, draft.origin)) return { ok: true, deduped: true };
    const plan = await this.plans.create(projectId, agent.id, draft);
    const speak = shop.speakPlan(plan);
    const ask = await this._createAsk(projectId, agent.id, {
      text: speak,
      options: ['Run it', 'Change it', 'Ask more', 'Not that'],
      recommended: 'Run it',
      kind: 'plan',
      from_layer: 'user',
      speak_text: speak,
      payload: { plan_id: plan.id, origin: 'idle' },
    });
    this._pulse(projectId, agent.id);
    return { ok: true, plan, ask, behind: ask.status === 'pending' || !!open };
  }

  async _startPlan(projectId, agent, settings, ctx, preview) {
    const user = await this._userTurn(projectId, agent, settings, { ...ctx, shop: true });
    const inferred = shop.inferPlanSteps(ctx.text);
    const plan = await this.plans.create(projectId, agent.id, {
      origin: ctx.text,
      origin_kind: 'user',
      status: inferred.question ? 'asking' : 'proposed',
      steps: inferred.steps,
      question: inferred.question || '',
    });
    if (inferred.question) {
      const ask = await this._createAsk(projectId, agent.id, {
        text: inferred.question,
        options: ['Latency', 'Tests', 'UI', 'Icarus', 'Other'],
        recommended: 'Tests',
        kind: 'plan_q',
        from_layer: 'user',
        speak_text: inferred.question,
        payload: { plan_id: plan.id },
      });
      this._pulse(projectId, agent.id);
      return { agent_id: agent.id, job_id: user.job_id, reply: ask.speak_text, ask, plan, handed_off: false };
    }
    const speak = shop.speakPlan(plan);
    const ask = await this._createAsk(projectId, agent.id, {
      text: speak,
      options: ['Run it', 'Change it', 'Ask more', 'Not that'],
      recommended: 'Run it',
      kind: 'plan',
      from_layer: 'user',
      speak_text: speak,
      payload: { plan_id: plan.id, preview },
    });
    this._pulse(projectId, agent.id);
    return { agent_id: agent.id, job_id: user.job_id, reply: speak, ask, plan, handed_off: true };
  }

  async _revisePlanFromChat(projectId, agent, settings, ctx, open) {
    if (open?.id) {
      try { await this.agents.approve(projectId, agent.id, open.id, ctx.text); } catch { /* already answered */ }
    }
    const user = await this._userTurn(projectId, agent, settings, { ...ctx, shop: true });
    const payload = json(open?.payload, {});
    let plan = this.plans.list(projectId, agent.id).find((p) => p.id === payload.plan_id)
      || this.plans.openProposed(projectId, agent.id)[0];
    if (plan) {
      plan = shop.applyRevision(plan, ctx.text);
      await this.plans.update(projectId, agent.id, plan.id, plan);
    }
    const speak = shop.speakPlan(plan || { steps: [], question: ctx.text });
    const ask = await this._createAsk(projectId, agent.id, {
      text: speak,
      options: ['Run it', 'Change it', 'Ask more', 'Not that'],
      recommended: 'Run it',
      kind: 'plan',
      from_layer: 'user',
      speak_text: speak,
      payload: { plan_id: plan?.id },
    });
    this._pulse(projectId, agent.id);
    return { agent_id: agent.id, job_id: user.job_id, reply: speak, ask, plan, revision: plan?.revision };
  }

  async _answerPlanQ(projectId, agent, ask, answer, payload) {
    const plan = this.plans.list(projectId, agent.id).find((p) => p.id === payload.plan_id);
    const inferred = shop.inferPlanSteps(`${plan?.origin || ''} ${answer}`);
    const steps = inferred.steps.length ? inferred.steps : [
      { id: 's1', title: `Improve: ${answer}`, kind: /test/i.test(answer) ? 'test' : 'code', status: 'queued' },
    ];
    if (plan) await this.plans.update(projectId, agent.id, plan.id, { status: 'proposed', steps, question: '' });
    const next = plan || { steps };
    const speak = shop.speakPlan(next);
    const card = await this._createAsk(projectId, agent.id, {
      text: speak,
      options: ['Run it', 'Change it', 'Ask more', 'Not that'],
      recommended: 'Run it',
      kind: 'plan',
      from_layer: 'user',
      speak_text: speak,
      payload: { plan_id: plan?.id },
    });
    this._pulse(projectId, agent.id);
    return { ask: card, plan: next, reply: speak };
  }

  async _answerPlan(projectId, agent, ask, answer, payload, yes) {
    const plan = this.plans.list(projectId, agent.id).find((p) => p.id === payload.plan_id);
    if (/change|not that|ask more/i.test(String(answer)) && !/^run it$/i.test(answer)) {
      return this._revisePlanFromChat(projectId, agent, await this.agents.getSettings(projectId), { text: answer }, ask);
    }
    if (!yes && !/^run it$/i.test(String(answer))) {
      this._pulse(projectId, agent.id);
      return { ask, reply: `Noted: ${answer}` };
    }
    if (plan) await this.plans.update(projectId, agent.id, plan.id, { status: 'accepted' });
    const step = (plan?.steps || []).find((s) => s.status === 'queued') || (plan?.steps || [])[0];
    let goal = null;
    let prevTask = null;
    if (plan && typeof this.agents.createWork === 'function') {
      goal = await this.agents.createWork(projectId, agent.id, {
        kind: 'goal', title: String(plan.origin || 'plan').slice(0, 180), status: 'running',
        payload: { plan_id: plan.id },
      });
      const byStep = {};
      for (const s of (plan.steps || [])) {
        const parentId = (s.parent_id && byStep[s.parent_id]?.id) || goal.id;
        const related = prevTask ? [prevTask.id] : [];
        const task = await this.agents.createWork(projectId, agent.id, {
          kind: 'task',
          parent_id: parentId,
          title: s.title,
          status: 'queued',
          payload: { plan_id: plan.id, step_id: s.id },
          relationships: { related, ...(s.related ? { related: related.concat(s.related) } : {}) },
        });
        byStep[s.id] = task;
        prevTask = task;
      }
    }
    if (step?.kind === 'learn' || shop.looksLearn(plan?.origin || '')) {
      return this._startLearnAsk(projectId, agent, { text: plan?.origin || '', plan_id: plan?.id }, { grant: ask.id, work_item_id: prevTask?.id || '' });
    }
    if (typeof this.agents.upsertBrief === 'function') {
      await this.agents.upsertBrief(projectId, agent.id, shop.briefFromText(plan?.origin || step?.title || '', { projectId, agent }));
    }
    const mgr = await this.runManager(projectId, agent.id, {
      text: step?.title || plan?.origin || '', plan_id: plan?.id, step_id: step?.id,
    });
    if (mgr.ask && mgr.ask.kind === 'preview') {
      // plan accept is the write grant for the current step claim — auto-approve tiny preview? Plan says tiny stays preview; program plans already accepted.
      // For code steps, spawn with chunk_grant = plan ASK id without a second Yes if it's not deploy/iac.
      const preview = json(mgr.ask.payload, {});
      if (!['deploy', 'iac', 'browse'].includes(preview.type)) {
        return this.approve(projectId, agent.id, { ask_id: mgr.ask.id, answer: 'Yes' });
      }
    }
    this._pulse(projectId, agent.id);
    return { ask, plan, reply: mgr.ask?.speak_text || 'On it.', handed_off: true };
  }

  async _startLearnAsk(projectId, agent, body, extra = {}) {
    const { inferLearnSources } = require('./AgentLearnService');
    let sources = body.sources;
    if (typeof sources === 'string') {
      try { sources = JSON.parse(sources); } catch { sources = inferLearnSources(sources); }
    }
    if (!Array.isArray(sources) || !sources.length) sources = inferLearnSources(body.text || '');
    const created = await this.learn.createJob({
      projectId, agentId: agent.id, sources, workItemId: extra.work_item_id || '',
    });
    const fetched = await this.learn.fetchRemaining(created.job.id, {
      fetchImpl: (url) => this._fetchLearnPage(projectId, url, { agent }),
    });
    if (fetched.waiting) {
      const speak = fetched.waiting === 'waiting_computer'
        ? 'Computer is down. I’ll continue this learn when we’re back.'
        : 'Internet is out. I’ll continue this learn when we’re back.';
      const ask = await this._createAsk(projectId, agent.id, {
        text: speak,
        options: ['OK'],
        recommended: 'OK',
        kind: 'confirm',
        from_layer: 'user',
        speak_text: speak,
        payload: { job_id: created.job.id, waiting: fetched.waiting },
      });
      this._pulse(projectId, agent.id);
      return { ask, job: created.job, reply: speak };
    }
    const pages = fetched.pages || created.pages;
    const listed = pages.map((p) => `${p.title || p.url} (${p.url})`).join(', ');
    const speak = `Sources: ${listed || 'the text you gave me'}. Ingest into skills?`;
    const ask = await this._createAsk(projectId, agent.id, {
      text: speak,
      options: ['Ingest', 'Skip', 'Other'],
      recommended: 'Ingest',
      kind: 'learn',
      from_layer: 'user',
      speak_text: speak,
      payload: {
        job_id: created.job.id,
        sources: pages.map((p) => ({ title: p.title, url: p.url, sha: p.sha })),
        grant: extra.grant,
      },
    });
    this._pulse(projectId, agent.id);
    return { ask, job: created.job, reply: speak };
  }

  async _ingestLearn(projectId, agent, ask, payload) {
    const p = payload && payload.job_id ? payload : json(ask.payload, payload || {});
    const jobId = p.job_id;
    if (!jobId) return { ask, reply: 'No learn job.' };
    const out = await this.learn.ingestRemaining(jobId, {
      projectId,
      collection: agent.rag_collection,
      rag: {
        ingest: async (col, pid, body) => this._ragIngest(pid, agent, body),
        hasDocument: async (pid, col, docId) => this._ragHas(pid, agent, docId),
      },
    });
    const n = (out.ingested || []).length;
    const reply = `Skills now include ${n} source${n === 1 ? '' : 's'}.`;
    await this.agents.addMessage(projectId, agent.id, { role: 'assistant', content: reply, layer: 'user' });
    try { await this.agents.notifyDone(projectId, agent.id, { title: 'Icarus', body: reply }); } catch { /* */ }
    this._pulse(projectId, agent.id);
    return { ask, result: out, reply };
  }

  async _ragIngest(projectId, agent, body) {
    const { RagCollectionService } = require('./RagCollectionService');
    const rag = new RagCollectionService();
    const col = await rag.getByName(projectId, agent.rag_collection);
    return rag.ingest(col.id, projectId, body);
  }

  async _ragHas(projectId, agent, docId) {
    const { RagCollectionService } = require('./RagCollectionService');
    const rag = new RagCollectionService();
    return rag.hasDocument(projectId, agent.rag_collection, docId);
  }

  async _fetchLearnPage(projectId, url, { agent, bucket } = {}) {
    if (String(url || '').startsWith('inline:')) {
      return { ok: true, text: String(url).slice(7) };
    }
    const Web = require('./WebSearchService');
    const got = await Web.webFetchDisk(url);
    if (!got.ok && /enotfound|network|offline|econnrefused/i.test(String(got.error || got.code || ''))) {
      return { ok: false, error: got.error, code: got.code || 'ENOTFOUND' };
    }
    if (got.ok) {
      try {
        const { corpusStore } = require('./CorpusStore');
        const corpus = await corpusStore.put({
          projectId,
          raw: String(got.text || got.body || ''),
          meta: {
            url,
            source: 'learn_fetch',
            content_type: 'text/html',
          },
          bucket: bucket || agent?.storage_bucket,
        });
        got.path = corpus.prefix;
        got.corpus = corpus;
        const { forProject } = require('./IcarusFacade');
        const { loraTrain } = forProject(projectId, {});
        loraTrain.recordCorpusRow(projectId, {
          hash: corpus.hash,
          prefix: corpus.prefix,
          url,
          normalized: corpusStore.readNormalized(projectId, corpus.hash),
          prompt: `Learn from ${url}`,
        });
      } catch { /* corpus optional */ }
    }
    return got;
  }

  async _browseLearnIngest(projectId, agent, slots, settings, { text, userId } = {}) {
    const topic = String(slots.topic || text || '').trim();
    const sourceHint = String(slots.source || '').trim();
    const Web = require('./WebSearchService');
    const { corpusStore } = require('./CorpusStore');
    const { forProject } = require('./IcarusFacade');
    const icarus = forProject(projectId, settings);

    let url = '';
    if (/^https?:\/\//i.test(sourceHint)) url = sourceHint;
    else if (/^https?:\/\//i.test(topic)) url = topic;
    else if (topic) {
      const sr = await Web.webSearch(topic, { url: settings.web_search_url });
      url = sr?.results?.[0]?.url || '';
    }
    if (!url) {
      const reply = 'Need a URL or searchable topic before I can ingest.';
      await this.agents.addMessage(projectId, agent.id, { role: 'assistant', content: reply, layer: 'user' });
      return { ok: false, reply };
    }

    const fetched = await this._fetchLearnPage(projectId, url, { agent });
    if (!fetched?.ok) {
      const reply = `Fetch failed: ${fetched?.error || 'unknown'}`;
      await this.agents.addMessage(projectId, agent.id, { role: 'assistant', content: reply, layer: 'user' });
      return { ok: false, reply };
    }

    const corpus = fetched.corpus || await corpusStore.put({
      projectId,
      raw: String(fetched.text || fetched.body || ''),
      meta: { url, query: topic, source: 'browse_learn_ingest' },
      bucket: agent.storage_bucket,
    });

    icarus.loraTrain.recordCorpusRow(projectId, {
      hash: corpus.hash,
      prefix: corpus.prefix,
      url,
      query: topic,
      normalized: corpusStore.readNormalized(projectId, corpus.hash),
      prompt: topic || url,
    });

    const norm = corpusStore.readNormalized(projectId, corpus.hash)
      || String(fetched.text || '').slice(0, 12000);
    const docId = require('./AgentLearnService').sourceDocId(url);
    try {
      await this._ragIngest(projectId, agent, {
        title: topic || url,
        text: norm,
        doc_id: docId,
        metadata: { source: url, corpus_prefix: corpus.prefix, corpus_hash: corpus.hash },
      });
    } catch (e) {
      const reply = `Saved corpus ${corpus.prefix} but RAG ingest failed: ${e.message}`;
      await this.agents.addMessage(projectId, agent.id, { role: 'assistant', content: reply, layer: 'user' });
      return { ok: false, corpus, reply };
    }

    const reply = `Learned “${topic || url}” — corpus ${corpus.prefix}, skills RAG updated.`;
    await this.agents.addMessage(projectId, agent.id, { role: 'assistant', content: reply, layer: 'user' });
    this._pulse(projectId, agent.id);
    await this._note(projectId, agent.id, {
      layer: 'manager', type: 'learn', summary: reply.slice(0, 160), meta: { corpus, url },
    });
    return { ok: true, corpus, url, reply };
  }

  async _proposeCron(projectId, agent, settings, ctx, intent) {
    const user = await this._userTurn(projectId, agent, settings, { ...ctx, shop: true });
    const ask = await this._createAsk(projectId, agent.id, {
      text: intent.speak,
      options: ['Yes', 'No', 'Other'],
      recommended: 'Yes',
      kind: 'cron',
      from_layer: 'user',
      speak_text: intent.speak,
      payload: intent,
    });
    this._pulse(projectId, agent.id);
    return { agent_id: agent.id, job_id: user.job_id, reply: intent.speak, ask, handed_off: false };
  }

  async _acceptCron(projectId, agent, ask, payload) {
    const row = await this.agents.createCron(projectId, agent.id, payload);
    this._pulse(projectId, agent.id);
    return { ask, cron: row, reply: 'Routine is set.' };
  }

  async _healBrowser(projectId) {
    const settings = await this.agents.getSettings(projectId);
    if (!settings.workspace_worker_id) return { healed: false };
    try {
      const { EngineService } = require('./EngineService');
      const engines = new EngineService();
      const found = await engines.inspectOnWorker(settings.workspace_worker_id, 'aerekos-icarus-browser');
      return engines.healNamed(settings.workspace_worker_id, 'aerekos-icarus-browser', found || {});
    } catch (e) {
      return { healed: false, error: e.message };
    }
  }

  async _browseAsk(projectId, agent, worker, result, extra = {}) {
    const url = result.url || extra.url || '';
    const speak = `I'm on ${result.title || url || 'the page'}. What next?`;
    const ask = await this._createAsk(projectId, agent.id, {
      text: speak,
      options: ['Click search', 'Type …', 'Scroll', 'Done', 'Other'],
      recommended: 'Done',
      kind: 'browse',
      from_layer: 'user',
      speak_text: speak,
      payload: {
        frame_id: result.frame_id,
        url,
        title: result.title || '',
        worker_id: worker.id,
        snapshot: result.snapshot,
        console: result.console || [],
      },
    });
    if (typeof this.agents.updateWorker === 'function') {
      await this.agents.updateWorker(worker.id, { status: 'waiting_ask' });
    }
    return { ask, result };
  }

  async _startBrowse(projectId, agent, worker, payload, settings) {
    const Browser = require('./BrowserSession');
    const host = payload.host || payload.name || 'example.com';
    const url = /^https?:/i.test(host) ? host : `https://${host}`;
    const nav = await Browser.act(projectId, agent.id, {
      name: 'navigate', args: { url }, settings, owner: worker.id,
    });
    await this._ingestConsole(projectId, agent.id, nav, worker.id);
    if (nav.browser_down) {
      const ask = await this._createAsk(projectId, agent.id, {
        text: 'Browser is down. Start it?',
        options: ['Start Browser', 'Type instead', 'Leave it'],
        recommended: 'Start Browser',
        kind: 'confirm',
        from_layer: 'user',
        speak_text: 'Browser is down. Start it?',
        payload: { dep: 'browser', worker_id: worker.id, url },
      });
      return { ask, result: nav };
    }
    if (nav.hitl) {
      const ask = await this._createAsk(projectId, agent.id, {
        text: nav.error || 'This page needs you — pay, login, or captcha.',
        options: ['Take over', 'Skip', 'Other'],
        recommended: 'Take over',
        kind: 'confirm',
        from_layer: 'user',
        speak_text: 'This page needs you to take over.',
        payload: { hitl: true, worker_id: worker.id },
      });
      return { ask, result: nav };
    }
    return this._browseAsk(projectId, agent, worker, nav, { url });
  }

  async _continueBrowse(projectId, agent, prevAsk, answer, payload) {
    const Browser = require('./BrowserSession');
    const settings = await this.agents.getSettings(projectId);
    const workers = await this.agents.listWorkers(projectId, agent.id);
    const worker = workers.find((w) => w.id === payload.worker_id) || workers.find((w) => w.claim_prefix === 'browser');
    const act = shop.parseBrowseAct(answer);
    if (act.done) {
      if (worker && typeof this.agents.updateWorker === 'function') {
        await this.agents.updateWorker(worker.id, { status: 'succeeded' });
      }
      try { await this.agents.notifyDone(projectId, agent.id, { title: 'Icarus', body: 'Browse chunk done.' }); } catch { /* */ }
      this._pulse(projectId, agent.id);
      return { ask: prevAsk, done: true, reply: 'Done with the site.' };
    }
    if (act.stop) {
      Browser.wipe(projectId, agent.id);
      if (worker && typeof this.agents.updateWorker === 'function') {
        await this.agents.updateWorker(worker.id, { status: 'paused' });
      }
      this._pulse(projectId, agent.id);
      return { ask: prevAsk, stopped: true, wiped: true, reply: 'Stopped the browser.' };
    }
    const ran = await Browser.act(projectId, agent.id, {
      name: act.name, args: act.args || {}, settings, owner: worker?.id,
    });
    await this._ingestConsole(projectId, agent.id, ran, worker?.id);
    if (ran.hitl || ran.browser_down) {
      const ask = await this._createAsk(projectId, agent.id, {
        text: ran.error || 'Browser needs you.',
        options: ran.browser_down ? ['Start Browser', 'Leave it'] : ['Take over', 'Skip'],
        recommended: ran.browser_down ? 'Start Browser' : 'Take over',
        kind: 'confirm',
        from_layer: 'user',
        speak_text: ran.error || 'Browser needs you.',
        payload: { dep: ran.browser_down ? 'browser' : 'hitl', worker_id: worker?.id, hitl: !!ran.hitl },
      });
      this._pulse(projectId, agent.id);
      return { ask, result: ran };
    }
    const next = await this._browseAsk(projectId, agent, worker || { id: payload.worker_id }, ran, {});
    this._pulse(projectId, agent.id);
    return { ask: next.ask, worker, reply: next.ask.speak_text, result: ran };
  }

  async _browserTool(projectId, agentId, name, args, { settings, workerId, mode }) {
    const Browser = require('./BrowserSession');
    if (mode === 'plan' && /click|type|select|press/.test(name)) {
      const ask = await this._createAsk(projectId, agentId, {
        text: 'Plan mode is read-only. Switch to Agent to click?',
        options: ['Switch to Agent', 'Skip'],
        recommended: 'Switch to Agent',
        kind: 'choice',
        from_layer: 'user',
        speak_text: 'Switch to Agent to click?',
        payload: { name, args },
      });
      return { ask, pending: true };
    }
    const ran = await Browser.act(projectId, agentId, { name, args, settings, owner: workerId });
    await this._ingestConsole(projectId, agentId, ran, workerId);
    if (ran.browser_down) {
      const ask = await this._createAsk(projectId, agentId, {
        text: 'Browser is down. Start it?',
        options: ['Start Browser', 'Type instead', 'Leave it'],
        recommended: 'Start Browser',
        kind: 'confirm',
        from_layer: 'user',
        speak_text: 'Browser is down. Start it?',
        payload: { dep: 'browser' },
      });
      return { ask, pending: true, result: ran };
    }
    if (ran.hitl) {
      const ask = await this._createAsk(projectId, agentId, {
        text: ran.error || 'This page needs you.',
        options: ['Take over', 'Skip', 'Other'],
        recommended: 'Take over',
        kind: 'confirm',
        from_layer: 'user',
        speak_text: 'This page needs you to take over.',
        payload: { hitl: true, name, args },
      });
      return { ask, pending: true, hitl: true, result: ran };
    }
    return { result: ran, pending: false };
  }

  async _approvePrTool(projectId, agentId, args) {
    const { agent, settings } = await this._ctx(projectId, agentId);
    const { forProject } = require('./IcarusFacade');
    const icarus = forProject(projectId, settings);
    icarus.prReviews.jobs = this.jobs;
    const prId = args.pr_id || args.prId || args.id;
    if (!prId) return { result: { ok: false, error: 'pr_id required' }, pending: false };
    const approved = await icarus.prReviews.approveWithHigherModel({
      projectId, agent, prId, settings,
    });
    const askPayload = icarus.prReviews.userAskPayload(approved);
    if (approved.status === 'approved') {
      const ask = await this._createAsk(projectId, agentId, {
        text: askPayload.text,
        options: askPayload.options,
        recommended: 'Merge',
        kind: 'pr',
        from_layer: 'user',
        speak_text: askPayload.text,
        payload: { icarus_pr_id: prId, higher_status: approved.status },
      });
      return { result: { ok: true, pr: approved }, ask, pending: true };
    }
    return { result: { ok: true, pr: approved }, pending: false };
  }

  async _loraProposeTool(projectId, agentId, args, { approved, chunkGrant }) {
    const { settings } = await this._ctx(projectId, agentId);
    const { forProject } = require('./IcarusFacade');
    const icarus = forProject(projectId, settings);
    const fromCorpus = args.from_corpus === true || args.dataset_source === 'corpus';
    const proposal = icarus.loraTrain.propose({
      projectId,
      agentKind: args.agent_kind || args.kind || 'coding',
      baseModel: args.base_model,
      adapterName: args.adapter_name,
      datasetPreview: args.dataset_preview || args.preview,
      epochs: args.epochs,
      fromCorpus,
      corpusLimit: args.corpus_limit,
    });
    if (!approved && !chunkGrant) {
      const ask = await this._createAsk(projectId, agentId, {
        text: proposal.message,
        options: ['Train on Orin', 'Skip', 'Other'],
        recommended: 'Train on Orin',
        kind: 'lora',
        from_layer: 'user',
        speak_text: proposal.message,
        payload: { name: 'lora_propose', args, proposal },
      });
      return { result: { ok: true, proposal }, ask, pending: true };
    }
    const job = fromCorpus
      ? icarus.loraTrain.enqueueFromCorpus({
        projectId,
        agentId,
        agentKind: proposal.agent_kind,
        adapterName: proposal.adapter_name,
        epochs: proposal.epochs,
        baseModel: proposal.base_model,
        limit: args.corpus_limit,
      })
      : icarus.loraTrain.enqueue({
        projectId,
        agentId,
        agentKind: proposal.agent_kind,
        adapterName: proposal.adapter_name,
        epochs: proposal.epochs,
        dataset: proposal.dataset_preview,
        baseModel: proposal.base_model,
      });
    if (job?.error) {
      return { result: { ok: false, error: job.error, proposal }, pending: false };
    }
    return { result: { ok: true, proposal, job }, pending: false };
  }

  async _icarusGraphTool(projectId, agentId, name, args, settings) {
    const { forProject } = require('./IcarusFacade');
    const icarus = forProject(projectId, settings || {});
    await icarus.boot().catch(() => ({ ok: false }));
    if (name === 'plan_ready') {
      const ready = await icarus.graph.readySet(args.plan_id || null);
      return { result: { ok: true, ready }, pending: false };
    }
    if (name === 'plan_subgraph') {
      if (!args.plan_id) return { result: { ok: false, error: 'plan_id required' }, pending: false };
      const sub = await icarus.graph.subgraph(args.plan_id);
      return { result: { ok: true, ...sub }, pending: false };
    }
    if (name === 'explain_why') {
      const taskId = args.task_id || args.taskId;
      if (!taskId) return { result: { ok: false, error: 'task_id required' }, pending: false };
      const why = await icarus.explain.whyTask(projectId, taskId);
      return { result: { ok: true, why }, pending: false };
    }
    if (name === 'plan_query') {
      try {
        const rows = await icarus.graph.queryUser({
          cypher: args.cypher || args.query || 'RETURN 1 AS ok',
          params: args.params || {},
        });
        return { result: { ok: true, rows }, pending: false };
      } catch (e) {
        return { result: { ok: false, error: e.message }, pending: false };
      }
    }
    return { result: { ok: false, error: `unknown graph tool ${name}` }, pending: false };
  }

  async _openPr(projectId, agentId, args, { claim, workerId }) {
    // Coding agents create PRs; higher model (manager/review) approves before user Merge.
    const { agent, settings } = await this._ctx(projectId, agentId);
    const files = args.files || [];
    const review = shop.reviewPr({ files, claim, staged: args.staged || [] });
    const item = await this.agents.createWork(projectId, agentId, {
      kind: 'pr',
      title: args.title || 'PR',
      status: review.trivial ? 'merged_skip' : 'awaiting_review',
      payload: { files, review, worker_id: workerId, summary: args.summary, diff: String(args.diff || '').slice(0, 20000) },
    });
    this._prDiffs = this._prDiffs || new Map();
    const diff = String(args.diff || '').slice(0, 20000);
    this._prDiffs.set(item.id, diff);
    if (review.verdict === 'request_changes') {
      return { result: { ok: false, review, pr_id: item.id, report_manager: true }, pending: false };
    }
    if (review.trivial) {
      return { result: { ok: true, trivial: true, skipped_user_ask: true, review, pr_id: item.id }, pending: false };
    }

    const { forProject } = require('./IcarusFacade');
    const icarus = forProject(projectId, settings);
    const pr = icarus.prReviews.openFromWorker({
      projectId,
      agent,
      workerId,
      title: args.title || 'PR',
      summary: args.summary,
      branch: args.branch || '',
      files,
      diff,
      taskId: args.task_id || item.id,
    });
    icarus.prReviews.jobs = this.jobs;
    const approved = await icarus.prReviews.approveWithHigherModel({
      projectId, agent, prId: pr.id, settings,
    });
    // Sync work-item status with higher-model verdict
    try {
      await this.agents.updateWork?.(projectId, agentId, item.id, {
        status: approved.status === 'approved' ? 'review' : approved.status,
        payload: { ...(item.payload || {}), higher_review: approved.review, icarus_pr_id: pr.id },
      });
    } catch { /* best-effort */ }

    if (approved.status === 'rejected' || approved.status === 'changes_requested') {
      const askPayload = icarus.prReviews.userAskPayload(approved);
      const ask = await this._createAsk(projectId, agentId, {
        text: askPayload.text,
        options: askPayload.options.length ? askPayload.options : ['OK'],
        recommended: askPayload.options[0] || 'OK',
        kind: 'pr',
        from_layer: 'user',
        speak_text: askPayload.text,
        payload: {
          pr_id: item.id, icarus_pr_id: pr.id, worker_id: workerId, claim, files,
          higher_status: approved.status,
        },
      });
      return {
        ask, pending: true, review: approved.review, pr_id: item.id, icarus_pr_id: pr.id,
      };
    }

    // Only after higher-model approval does the user see Merge
    const askPayload = icarus.prReviews.userAskPayload(approved);
    const ask = await this._createAsk(projectId, agentId, {
      text: askPayload.text,
      options: askPayload.options,
      recommended: 'Merge',
      kind: 'pr',
      from_layer: 'user',
      speak_text: askPayload.text,
      payload: {
        pr_id: item.id, icarus_pr_id: pr.id, worker_id: workerId, claim, files,
        higher_status: approved.status,
      },
    });
    return {
      ask, pending: true, review: approved.review, pr_id: item.id, icarus_pr_id: pr.id,
    };
  }

  async _finishPr(projectId, agent, ask, answer, payload) {
    const settings = await this.agents.getSettings(projectId);
    const a = String(answer || '');
    const { forProject } = require('./IcarusFacade');
    const icarus = forProject(projectId, settings);
    if (/merge/i.test(a)) {
      if (payload.icarus_pr_id) {
        try { icarus.prReviews.markMerged(payload.icarus_pr_id); } catch (e) {
          if (e.status === 409) {
            this._pulse(projectId, agent.id);
            return { ask, rejected: true, reply: 'Higher model has not approved this PR yet.' };
          }
        }
      }
      const branch = payload.branch || `icarus/${String(payload.pr_id || 'task').slice(0, 24)}`;
      const ran = await this._runTool('shell', {
        cmd: `git merge --no-ff ${JSON.stringify(branch)} -m ${JSON.stringify(payload.title || 'merge icarus')}`,
      }, settings, projectId);
      try { await this.agents.notifyDone(projectId, agent.id, { title: 'Icarus', body: 'PR merged locally. Push still asks.' }); } catch { /* */ }
      this._pulse(projectId, agent.id);
      return { ask, result: ran, merged: true, reply: 'Merged locally. Push still asks.' };
    }
    if (/reject/i.test(a)) {
      this._pulse(projectId, agent.id);
      return { ask, rejected: true, reply: 'Left the branch. Path unlocked.' };
    }
    if (payload.worker_id) {
      await this.runManager(projectId, agent.id, { report: { worker_id: payload.worker_id, tried: 'request changes' } });
    }
    this._pulse(projectId, agent.id);
    return { ask, reply: 'Requested changes on the same branch.' };
  }

  prDiff(prId) {
    return (this._prDiffs && this._prDiffs.get(prId)) || '';
  }

  async _iacTool(projectId, agentId, name, args, { approved, chunkGrant }) {
    const Iac = require('./IacShop');
    const wrap = async (fn) => {
      try {
        return { result: await fn(), pending: false };
      } catch (e) {
        return { result: { ok: false, error: e.message || String(e), tool: name }, pending: false };
      }
    };
    if (name === 'iac_schema') return { result: Iac.schema(), pending: false };
    if (name === 'iac_diff') return wrap(() => Iac.diff(args.project_id || projectId));
    if (name === 'iac_put') {
      if (!approved && !chunkGrant) {
        const ask = await this._createAsk(projectId, agentId, {
          text: 'Write this project-stack JSON?',
          options: ['Yes', 'No'],
          recommended: 'Yes',
          kind: 'iac',
          from_layer: 'user',
          speak_text: 'Write the stack JSON?',
          payload: { name: 'iac_put', args },
        });
        return { ask, pending: true };
      }
      return wrap(() => Iac.put(args.project_id || projectId, args.stack || args));
    }
    if (name === 'iac_apply' || name === 'iac_rollback') {
      if (!approved) {
        const ask = await this._createAsk(projectId, agentId, {
          text: name === 'iac_apply' ? 'Apply this stack (never prod)?' : 'Roll back the last stack apply?',
          options: ['Yes', 'No'],
          recommended: 'Yes',
          kind: 'iac',
          from_layer: 'user',
          speak_text: name === 'iac_apply' ? 'Apply the stack?' : 'Roll back the stack?',
          payload: { name, args, project_id: args.project_id || projectId },
        });
        return { ask, pending: true };
      }
      return wrap(() => (name === 'iac_apply'
        ? Iac.apply(args.project_id || projectId)
        : Iac.rollback(args.project_id || projectId)));
    }
    return { result: { ok: false, error: name }, pending: false };
  }

  async ingestConsoleEvents(projectId, agentId, events = []) {
    const Browser = require('./BrowserSession');
    const rows = Array.isArray(events) ? events : [];
    Browser.putConsole(projectId, agentId, rows);
    const last = rows.slice(-8);
    if (last.length) {
      await this._note(projectId, agentId, {
        layer: 'worker',
        type: 'console',
        summary: last.map((e) => `${e.type}: ${String(e.text || '').slice(0, 80)}`).join(' | ').slice(0, 400),
      });
    }
    this._pulse(projectId, agentId);
    return { ok: true, console: Browser.listConsole(projectId, agentId) };
  }

  async _ingestConsole(projectId, agentId, ran, workerId) {
    const events = ran?.console || [];
    if (!events.length) return;
    const Browser = require('./BrowserSession');
    Browser.putConsole(projectId, agentId, events);
    await this._note(projectId, agentId, {
      layer: 'worker',
      type: 'console',
      ref_id: workerId || '',
      summary: events.slice(-6).map((e) => `${e.type}: ${String(e.text || '').slice(0, 80)}`).join(' | ').slice(0, 400),
    });
    if (workerId && typeof this.agents.updateWorker === 'function' && typeof this.agents.listWorkers === 'function') {
      const workers = await this.agents.listWorkers(projectId, agentId);
      const w = workers.find((x) => x.id === workerId);
      if (w) {
        const t = json(w.transcript, []);
        t.push({ type: 'console', at: new Date().toISOString(), events: events.slice(-8) });
        await this.agents.updateWorker(workerId, { transcript: JSON.stringify(t) });
      }
    }
  }

  _pulse(projectId, agentId) {
    Promise.resolve()
      .then(async () => {
        const pulse = await this.agents.pulse(projectId, agentId);
        emitAgentPulse(pulse, projectId);
      })
      .catch(() => {});
  }

  /**
   * Guided Flow hand-holding. Returns a chat response when Flow owns the turn.
   */
  async _maybeFlowIntake(projectId, agent, text, icarus, gated) {
    // Learn / shop ingest has its own ASK path — do not steal into FlowIntake.
    if (/\blearn\b/i.test(String(text || ''))) return null;
    const { FlowIntakeService } = require('./FlowIntakeService');
    // Prefer the runtime's agents seam (unit tests inject memAgents; prod uses AgentService).
    const flowIntake = new FlowIntakeService(this.agents);
    const existing = await flowIntake.getState(agent);
    const wantsFlow = existing
      && (existing.status === 'intake' || existing.status === 'confirm');
    const pickHint = gated?.laya?.answers?.flow_pick?.choice
      || (await icarus.laya.predict({ text }, { flow_pick: {} })).answers?.flow_pick?.choice;
    if (!wantsFlow && (!pickHint || pickHint === 'none')) return null;
    if (!wantsFlow && pickHint && pickHint !== 'none' && gated.route !== 'MANAGER' && gated.lane_choice !== 'manager') {
      // Soft: only auto-start flow when language clearly matches (Laya already said so)
    }

    const advanced = await flowIntake.advance(projectId, agent, text, {
      flowId: wantsFlow ? existing.flow_id : (pickHint !== 'none' ? pickHint : undefined),
    });
    if (!advanced.ask && !advanced.confirm) return null;

    if (advanced.confirm) {
      const ask = await this._createAsk(projectId, agent.id, {
        text: advanced.confirm.text,
        options: advanced.confirm.options,
        recommended: advanced.confirm.recommended,
        kind: 'flow_confirm',
        from_layer: 'user',
        speak_text: advanced.confirm.text,
        payload: {
          flow_id: advanced.confirm.flow_id,
          slots: advanced.confirm.slots,
        },
      });
      this._pulse(projectId, agent.id);
      return {
        agent_id: agent.id,
        job_id: null,
        reply: ask.speak_text || ask.text,
        handed_off: false,
        ask,
        flow: advanced.intake,
      };
    }

    const ask = await this._createAsk(projectId, agent.id, advanced.ask);
    this._pulse(projectId, agent.id);
    return {
      agent_id: agent.id,
      job_id: null,
      reply: ask.speak_text || ask.text,
      handed_off: false,
      ask,
      flow: advanced.intake,
    };
  }

  async _runFlowConfirm(projectId, agent, ask, payload, yes) {
    const { FlowIntakeService } = require('./FlowIntakeService');
    const flowIntake = new FlowIntakeService(this.agents);
    if (!yes) {
      await flowIntake.cancel(projectId, agent);
      const reply = 'Cancelled that setup. What instead?';
      await this.agents.addMessage(projectId, agent.id, { role: 'assistant', content: reply, layer: 'user' });
      this._pulse(projectId, agent.id);
      return { ask, reply, cancelled: true };
    }
    const flowId = payload.flow_id;
    const slots = payload.slots || {};
    let result = { ok: true, flow_id: flowId };
    try {
      if (flowId === 'new_project_app' || flowId === 'iac_spool') {
        result = await this._flowNewProjectApp(projectId, agent, slots);
      } else if (flowId === 'new_worker_fleet') {
        result = await this._flowNewWorkerFleet(projectId, agent, slots);
      } else if (flowId === 'safe_self_update') {
        result = await this._flowSafeSelfUpdate(projectId, agent, slots);
      } else if (flowId === 'safe_deps_upgrade') {
        result = await this._flowSafeDepsUpgrade(projectId, agent, slots);
      } else if (flowId === 'browse_learn_ingest') {
        result = {
          ok: true,
          reply: `Queued learn for “${slots.topic || 'topic'}”. I’ll fetch then ASK before ingest.`,
          pending: false,
          wake: { learn: true, topic: slots.topic, source: slots.source },
        };
        setImmediate(() => {
          this.runManager(projectId, agent.id, {
            text: `learn and ingest: ${slots.topic || ''} ${slots.source || ''}`,
            report: { flow: 'browse_learn_ingest', slots },
          }).catch(() => {});
        });
      } else if (flowId === 'heal_computer_browser') {
        result = {
          ok: true,
          reply: `Healing ${slots.target || 'computer'} — I’ll ASK before restart, then resume workers.`,
          wake: { heal: true, target: slots.target, symptom: slots.symptom },
        };
        setImmediate(() => {
          this.runManager(projectId, agent.id, {
            text: `heal ${slots.target || 'computer'}: ${slots.symptom || ''}`,
            report: { flow: 'heal_computer_browser', slots },
          }).catch(() => {});
        });
      } else {
        result = { ok: true, note: `flow ${flowId} recorded`, slots };
      }
    } catch (e) {
      result = { ok: false, error: e.message || String(e) };
    }
    await flowIntake.markDone(projectId, agent);
    const reply = result.ok
      ? (result.reply || `Flow ${flowId} applied.`)
      : `Flow failed: ${result.error}`;
    if (!result.pending) {
      await this.agents.addMessage(projectId, agent.id, { role: 'assistant', content: reply, layer: 'user' });
    }
    this._pulse(projectId, agent.id);
    return { ask: result.ask || ask, result, reply };
  }

  async _flowNewProjectApp(projectId, agent, slots) {
    const Iac = require('./IacShop');
    const models = slots.models || 'User';
    const stack = {
      kind: 'project-stack',
      wanted: [
        'api_manager', 'db_manager', 'app_manager', 'tunnel_manager', 'function_manager',
        'auth_manager', 'logs_manager', 'metrics_manager',
      ],
      defaults: {
        auth_scope: 'project',
        request_logging: true,
        error_hooks: true,
        metrics: true,
      },
      data_apis: [{
        name: String(slots.intent || 'app').replace(/\W+/g, '_').slice(0, 40) || 'app',
        engine: /postgres/i.test(slots.db || '') ? 'postgresql'
          : /mongo/i.test(slots.db || '') ? 'mongodb' : 'sqlite3',
        document: {
          models: typeof models === 'string'
            ? { Item: { fields: { name: 'string', notes: 'string' }, note: models } }
            : models,
        },
        auth: { scope: 'project' },
        logging: { to: 'logs_manager', requests: true, errors: true },
      }],
      tunnels: slots.domain ? [{ name: 'app', hostname: slots.domain }] : [],
      apps: [{
        name: 'fe',
        scaffold: slots.fe || 'admin_crud',
        open_ide: true,
      }],
    };
    await Iac.put(projectId, stack);
    // ASK already done via flow_confirm — apply
    const applied = await Iac.apply(projectId);
    try {
      const { IdeLive } = require('./IdeLiveService');
      IdeLive.emitStack(projectId, { action: 'apply', stack_kind: 'project-stack', ok: !!applied.ok });
    } catch { /* */ }
    return {
      ok: !!applied.ok,
      reply: applied.ok
        ? `Project stack applied (Data API + auth/logging defaults + tunnel ${slots.domain || 'pending'}). Open Icarus IDE for FE.`
        : `Apply returned ${applied.status}`,
      applied,
      stack,
    };
  }

  async _flowNewWorkerFleet(projectId, agent, slots) {
    const Iac = require('./IacShop');
    const stack = {
      kind: 'project-stack',
      wanted: ['queue_manager', 'worker_manager', 'compute_manager', 'logs_manager'],
      defaults: { request_logging: true, error_hooks: true },
      queues: [{
        name: String(slots.job || 'jobs').replace(/\W+/g, '_').slice(0, 40) || 'jobs',
        engine: slots.engine || 'standard',
        concurrency: Number(slots.concurrency) || 1,
        payload: slots.payload || null,
      }],
    };
    await Iac.put(projectId, stack);
    const applied = await Iac.apply(projectId);
    try {
      const { IdeLive } = require('./IdeLiveService');
      IdeLive.emitStack(projectId, { action: 'apply', stack_kind: 'queues', ok: !!applied.ok });
    } catch { /* */ }
    return {
      ok: !!applied.ok,
      reply: applied.ok
        ? `Queue fleet configured (${stack.queues[0].name}). Workers can consume now.`
        : `Apply returned ${applied.status}`,
      applied,
      stack,
    };
  }

  async _flowSafeSelfUpdate(projectId, agent, slots) {
    const claim = String(slots.claim || 'aerekos-cloud');
    const goal = String(slots.goal || 'safe self-update');
    const worker = await this.spawnWorker(projectId, agent.id, {
      persona: 'dev',
      objective: `SAFE SELF-UPDATE: ${goal}. Branch icarus/self-*, open_pr, wait manager approve_pr. Deploy only after Merge; on health fail rollback.`,
      claim_prefix: claim,
    });
    if (typeof this.agents.updateWorker === 'function') {
      await this.agents.updateWorker(worker.id, { chunk_grant: `flow-self:${worker.id}` });
    }
    setImmediate(() => {
      this.runWorker(projectId, agent.id, worker.id, { dry: false, approved: true }).catch(() => {});
    });
    return {
      ok: true,
      reply: `Safe self-update worker running on claim ${claim}. Branch → open_pr → manager review → you Merge; rollback on health fail.`,
      worker,
      health_check: slots.health_check || 'compose',
    };
  }

  async _flowSafeDepsUpgrade(projectId, agent, slots) {
    const { SafeDepsUpgradeService: safeDeps } = require('./SafeDepsUpgradeService');
    const { settings } = await this._ctx(projectId, agent.id);
    const tree = String(slots.tree || 'aerekos/aerekos-cloud');
    const ecosystem = String(slots.ecosystem || 'npm');
    const keeper = safeDeps.isKeeperTarget({ projectId, tree });
    if (keeper.denied) {
      return { ok: false, reply: `Blocked keeper/prod tree (${keeper.reason}).`, denied: true };
    }
    const preview = safeDeps.planUpgrade({
      tree,
      ecosystem,
      workspaceRoot: settings.workspace_root || process.cwd(),
      projectId,
    });
    const outdatedN = (preview.outdated || []).length;
    const worker = await this.spawnWorker(projectId, agent.id, {
      persona: 'dev',
      objective: `SAFE DEPS UPGRADE (${ecosystem}): ${tree}. Branch icarus/deps-*, bump outdated (${outdatedN}), run_checks, open_pr — never auto-merge. Rolling apply via IaC/cicd if present; rollback on fail.`,
      claim_prefix: tree,
    });
    setImmediate(() => {
      this.runManager(projectId, agent.id, {
        text: `safe deps upgrade ${tree}`,
        report: { flow: 'safe_deps_upgrade', slots: { ...slots, preview } },
      }).catch(() => {});
    });
    return {
      ok: true,
      pending: false,
      reply: preview.ok
        ? `Deps scan on ${tree}: ${outdatedN} outdated. Worker on branch icarus/deps-* → PR → you merge (never auto-merge).`
        : `Deps flow queued on ${tree} (${preview.error || preview.reason || 'scan blocked'}).`,
      preview,
      worker,
      auto_merge: false,
    };
  }

  async _safeDepsUpgradeManager(projectId, agent, slots, settings) {
    const PlatformToolkit = require('./PlatformToolkit');
    const tree = String(slots.tree || '.');
    const dryRun = slots.apply !== true;
    const { result } = await PlatformToolkit.execute(projectId, agent.id, 'safe_deps_upgrade', {
      tree,
      ecosystem: slots.ecosystem || 'npm',
      dry_run: dryRun,
      apply: slots.apply === true,
    }, {
      approved: slots.apply === true,
      runtime: this,
      settings,
      agent,
    });
    const n = (result?.outdated || result?.plan?.outdated || []).length;
    const reply = result?.denied
      ? `Deps upgrade blocked: ${result.reason}`
      : dryRun
        ? `Dry-run: ${n} outdated packages in ${tree}. Branch would be ${result?.branch || 'icarus/deps-*'}.`
        : (result?.ok
          ? `Deps upgrade on ${result.branch || 'branch'} — PR opened; no auto-merge.`
          : `Deps upgrade failed: ${result?.error || 'checks or rollback'}`);
    await this.agents.addMessage(projectId, agent.id, { role: 'assistant', content: reply, layer: 'user' });
    this._pulse(projectId, agent.id);
    return { reply, result, report: { flow: 'safe_deps_upgrade', slots } };
  }

  async _emitIdeFile(projectId, agentId, payload) {
    try {
      const { IdeLive } = require('./IdeLiveService');
      IdeLive.emitFile(projectId, agentId, payload);
    } catch { /* */ }
  }

  /** Drain tool calls from a finished/pending manager job (best-effort). */
  async _managerToolLoop(projectId, agentId, job, settings) {
    if (!job) return;
    const { extractToolCalls } = require('./workspaceTools');
    let result = job.result || job.response || job;
    // If job is async id, try to load once
    if (job.id && this.jobs?.get) {
      try {
        const fresh = await this.jobs.get(job.id, projectId);
        if (fresh) result = fresh.result || fresh.response || fresh;
      } catch { /* */ }
    }
    const calls = extractToolCalls(result);
    // Manager-safe auto tools (read/status/plan/update board). Mutating still HITL via approve path.
    const AUTO = new Set([
      'aerekos_status', 'aerekos_search_docs', 'project_services', 'update_work',
      'plan_query', 'plan_ready', 'plan_subgraph', 'explain_why', 'file_read', 'file_list',
      'grep', 'semantic_search', 'web_search', 'web_fetch', 'iac_schema', 'iac_diff',
      'spawn_worker', 'report_user', 'preview',
    ]);
    for (const c of calls.slice(0, 8)) {
      if (c.name === 'approve_pr' && c.args?.self) continue;
      const auto = AUTO.has(c.name);
      await this.executeApprovedTool(projectId, agentId, {
        name: c.name,
        args: c.args || {},
        actor: `manager:${agentId}`,
        approved: auto,
        persona: 'manager',
        mode: 'agent',
      });
    }
  }
}

module.exports = { AgentRuntime, friendSystem, formatAsk, WORK_RE, CONNECTOR_RE, shop };
