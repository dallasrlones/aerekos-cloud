'use strict';

/**
 * SDK-backed platform tools for Icarus (status, docs, call, data API, services map).
 */

const fs = require('fs');
const path = require('path');
const { fail } = require('./agentArn');
const { layaDecision } = require('./LayaDecisionService');
const { PROD_PROJECT_ID, knowledgeCollectionName } = require('./layerContext');
const { SafeDepsUpgradeService: safeDeps } = require('./SafeDepsUpgradeService');

async function proxy(method, path, opts = {}) {
  const { proxy: px } = require('../../../shared/conductorProxy');
  return px(method, path, opts);
}

async function execute(projectId, agentId, name, args, ctx = {}) {
  const { approved, runtime, agent, settings = {} } = ctx;
  if (projectId === PROD_PROJECT_ID && /apply|delete|destroy|put|post/i.test(String(args.method || name))) {
    return { result: { ok: false, denied: true, error: 'prod project hard-deny' }, pending: false };
  }

  const risk = await layaDecision.predict(
    { text: `${name} ${JSON.stringify(args || {}).slice(0, 200)}`, toolName: name },
    { hitl_risk: {} },
  );
  const riskChoice = risk.answers.hitl_risk?.choice || 'auto';

  if (name === 'project_services') {
    const { ProjectServicesMap } = require('./ProjectServicesMap');
    const map = await ProjectServicesMap.snapshot(projectId);
    return { result: { ok: true, ...map }, pending: false };
  }

  if (name === 'aerekos_search_docs') {
    const q = String(args.query || args.q || '');
    try {
      const RagCollectionService = require('./RagCollectionService');
      const rag = new RagCollectionService();
      const coll = args.collection || 'platform-docs';
      const hits = await rag.search(projectId, coll, { query: q, top_k: 8 });
      return { result: { ok: true, hits }, pending: false };
    } catch (e) {
      return { result: { ok: false, error: e.message, query: q }, pending: false };
    }
  }

  if (name === 'aerekos_status') {
    const manager = String(args.manager || 'ai_manager');
    const path = String(args.path || '/health');
    try {
      const res = await proxy('GET', `/api/services/${encodeURIComponent(manager)}${path.startsWith('/') ? path : `/${path}`}`, {
        timeout: 10000,
        headers: { 'x-project-id': projectId },
      });
      return {
        result: { ok: (res.status || 200) < 400, status: res.status, data: res.data, manager },
        pending: false,
      };
    } catch (e) {
      return { result: { ok: false, error: e.message, manager }, pending: false };
    }
  }

  if (name === 'aerekos_call') {
    const method = String(args.method || 'GET').toUpperCase();
    const manager = String(args.manager || '');
    const path = String(args.path || '/');
    if (!manager) throw fail(400, 'manager required');
    if (method !== 'GET' && riskChoice === 'deny') {
      return { result: { ok: false, denied: true, error: 'Laya deny' }, pending: false };
    }
    if (method !== 'GET' && !approved && riskChoice === 'ask_human') {
      const ask = await runtime._createAsk(projectId, agentId, {
        text: `Call ${method} ${manager}${path}?`,
        options: ['Go ahead', 'Skip', 'Other'],
        recommended: 'Go ahead',
        kind: 'tool',
        from_layer: 'user',
        speak_text: `Call ${manager}?`,
        payload: { name: 'aerekos_call', args },
      });
      return { ask, pending: true };
    }
    try {
      const res = await proxy(method, `/api/services/${encodeURIComponent(manager)}${path.startsWith('/') ? path : `/${path}`}`, {
        timeout: 60000,
        data: args.body,
        headers: { 'x-project-id': projectId },
      });
      return {
        result: { ok: (res.status || 200) < 400, status: res.status, data: res.data },
        pending: false,
      };
    } catch (e) {
      // Proxy/conductor down is still a handled tool outcome (not unknown tool).
      return {
        result: { ok: false, error: e.message || String(e), manager, path },
        pending: false,
      };
    }
  }

  if (name === 'data_api_apply') {
    if (!approved && riskChoice !== 'auto') {
      const ask = await runtime._createAsk(projectId, agentId, {
        text: `Apply Data API "${args.name || 'app'}"?`,
        options: ['Yes', 'No'],
        recommended: 'Yes',
        kind: 'tool',
        from_layer: 'user',
        speak_text: 'Apply Data API schema?',
        payload: { name: 'data_api_apply', args },
      });
      return { ask, pending: true };
    }
    const body = {
      name: args.name || 'app',
      engine: args.engine || 'sqlite3',
      document: args.schema || args.document || args,
    };
    const res = await proxy('POST', `/api/services/api_manager/api/v1/data-apis/apply?project_id=${encodeURIComponent(projectId)}`, {
      timeout: 60000,
      data: { project_id: projectId, ...body },
    });
    return {
      result: { ok: (res.status || 200) < 400, status: res.status, data: res.data },
      pending: false,
    };
  }

  if (name === 'safe_deps_detect') {
    const tree = String(args.tree || args.claim || args.path || '.');
    const workspaceRoot = settings?.workspace_root || process.cwd();
    const detected = safeDeps.detectOutdated({
      tree,
      ecosystem: args.ecosystem || 'npm',
      workspaceRoot,
      projectId,
    });
    return { result: detected, pending: false };
  }

  if (name === 'safe_deps_upgrade') {
    const tree = String(args.tree || args.claim || args.path || '.');
    const workspaceRoot = settings?.workspace_root || process.cwd();
    const dryRun = args.dry_run !== false && args.dryRun !== false && !args.apply;
    if (!dryRun && !approved && riskChoice !== 'auto') {
      const ask = await runtime._createAsk(projectId, agentId, {
        text: `Run safe deps upgrade on ${tree}? (branch icarus/deps-*, PR — never auto-merge)`,
        options: ['Yes', 'Dry run only', 'Cancel'],
        recommended: 'Dry run only',
        kind: 'tool',
        from_layer: 'user',
        speak_text: `Upgrade dependencies in ${tree}?`,
        payload: { name: 'safe_deps_upgrade', args: { ...args, apply: true } },
      });
      return { ask, pending: true };
    }
    const out = await safeDeps.runUpgrade({
      tree,
      ecosystem: args.ecosystem || 'npm',
      dryRun,
      branch: args.branch,
      workspaceRoot,
    }, {
      projectId,
      workspaceRoot,
      approved: approved || dryRun,
      runTool: (toolName, toolArgs) => runtime._runTool(
        toolName,
        { ...toolArgs, claim: tree },
        settings,
        projectId,
        'dev',
      ),
      openPr: (prArgs) => runtime.executeApprovedTool(projectId, agentId, {
        name: 'open_pr',
        args: prArgs,
        approved: true,
        persona: 'dev',
        claim: tree,
      }).then((r) => r.result || r),
      hooks: {
        iacApply: fs.existsSync(path.join(workspaceRoot, 'worker/ai_manager/api/services/IacShop.js'))
          ? async (ia) => {
            try {
              const Iac = require('./IacShop');
              return Iac.apply(projectId, { rolling: true, claim: ia.tree });
            } catch (e) {
              return { ok: false, error: e.message };
            }
          }
          : null,
        cicdTrigger: process.env.CICD_MANAGER_URL
          ? async () => ({ ok: true, stub: true, note: 'cicd hook present' })
          : null,
      },
    });
    return { result: out, pending: false };
  }

  if (name === 'safe_deps_rollback') {
    if (!approved && riskChoice !== 'auto') {
      const ask = await runtime._createAsk(projectId, agentId, {
        text: 'Roll back last dependency bump checkpoint?',
        options: ['Roll back', 'Skip'],
        recommended: 'Roll back',
        kind: 'tool',
        from_layer: 'user',
        speak_text: 'Roll back dependency changes?',
        payload: { name: 'safe_deps_rollback', args },
      });
      return { ask, pending: true };
    }
    const rolled = safeDeps.rollbackFromCheckpoint(args.checkpoint || {});
    return { result: rolled, pending: false };
  }

  if (name === 'rag_ingest') {
    if (!approved) {
      const ask = await runtime._createAsk(projectId, agentId, {
        text: `Ingest into knowledge RAG${args.title ? `: ${args.title}` : ''}?`,
        options: ['Ingest', 'Skip'],
        recommended: 'Ingest',
        kind: 'learn',
        from_layer: 'user',
        speak_text: 'Ingest into knowledge?',
        payload: { name: 'rag_ingest', args },
      });
      return { ask, pending: true };
    }
    const RagCollectionService = require('./RagCollectionService');
    const { corpusStore } = require('./CorpusStore');
    const rag = new RagCollectionService();
    const coll = args.collection || knowledgeCollectionName(agent?.name || 'icarus');
    let content = String(args.content || '');
    let corpus = null;
    if (!content && args.url) {
      try {
        const WebSearch = require('./WebSearchService');
        const fetched = await WebSearch.webFetchDisk(args.url);
        const raw = String(fetched?.text || fetched?.body || '');
        content = raw || `URL: ${args.url}`;
        if (fetched?.ok && raw) {
          corpus = await corpusStore.put({
            projectId,
            raw,
            meta: {
              url: args.url,
              title: args.title || args.url,
              source: 'rag_ingest',
            },
            bucket: agent?.storage_bucket,
          });
          content = corpusStore.readNormalized(projectId, corpus.hash) || content;
        }
      } catch { /* */ }
    } else if (content) {
      corpus = await corpusStore.put({
        projectId,
        raw: content,
        meta: {
          url: args.url || '',
          title: args.title || 'ingest',
          source: 'rag_ingest',
        },
        bucket: agent?.storage_bucket,
      });
      content = corpusStore.readNormalized(projectId, corpus.hash) || content;
    }
    const doc = await rag.ingest?.(projectId, coll, {
      title: args.title || args.url || 'ingest',
      content,
      metadata: corpus ? { corpus_prefix: corpus.prefix, corpus_hash: corpus.hash } : {},
    }) || { ok: true, collection: coll, title: args.title, corpus };
    return { result: { ok: true, doc }, pending: false };
  }

  return { result: { ok: false, error: `unknown platform tool ${name}` }, pending: false };
}

module.exports = { execute };
