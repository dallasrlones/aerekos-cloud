'use strict';

const { layaDecision } = require('./LayaDecisionService');
const { corpusStore } = require('./CorpusStore');

const FETCH_INFO = new Set(['web_fetch', 'browser']);
const FETCH_LEARN = new Set(['fetch_only', 'learn_job', 'rag_ingest']);
const RAG_LOW = Number(process.env.INFO_VERIFY_RAG_THRESHOLD || 0.35);

const FACTUAL_RE = /\b(when|who|what|where|which|how many|how much|latest|current|today|yesterday|\d{4})\b/i;
const INVENT_RISK_RE = /\b(was born|founded|released|price|population|ceo|president|score|ranking|version)\b/i;

function looksFactual(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (t.endsWith('?')) return true;
  return FACTUAL_RE.test(t) || INVENT_RISK_RE.test(t);
}

async function maxRagScore(searchFn, projectId, collection, query) {
  if (!searchFn || !collection) return null;
  try {
    const hit = await searchFn(projectId, collection, { query, top_k: 6 });
    const items = hit?.items || hit?.results || [];
    if (!Array.isArray(items) || !items.length) return 0;
    return Math.max(...items.map((i) => Number(i.score || i.similarity || 0)));
  } catch {
    return null;
  }
}

/**
 * Decide whether info lane must verify via web before answering.
 */
async function planInfoVerify({
  text,
  projectId,
  agent,
  gate,
  laya = layaDecision,
  ragSearch,
} = {}) {
  const infoLane = gate?.lane_choice === 'info' || gate?.policy?.info_lane;
  const factual = looksFactual(text);

  const layaHit = await laya.predict(
    { text, canSelfFetch: true, hasEnoughContext: false },
    { info_path: {}, learn_disposition: {} },
  );
  const infoPath = layaHit.answers?.info_path?.choice || 'rag';
  const learnDisp = layaHit.answers?.learn_disposition?.choice || 'skip';
  const layaFetch = FETCH_INFO.has(infoPath) || FETCH_LEARN.has(learnDisp);

  if (!infoLane && !factual && !layaFetch) {
    return { required: false, reason: 'not_factual', factual, infoLane, laya: layaHit };
  }

  const ragScore = await maxRagScore(ragSearch, projectId, agent?.rag_collection, text);
  const lowRag = ragScore != null && ragScore < RAG_LOW;
  const infoConfLow = (layaHit.answers?.info_path?.confidence || 0.55) < 0.45;

  const required = layaFetch || lowRag || (factual && infoConfLow) || (infoLane && factual && (ragScore == null || ragScore < 0.5));

  return {
    required,
    factual,
    infoLane,
    infoPath,
    learnDisp,
    ragScore,
    laya: layaHit,
    reason: required
      ? (layaFetch ? 'laya_fetch' : lowRag ? 'low_rag' : 'factual_verify')
      : 'sufficient',
  };
}

/**
 * Run web_search + web_fetch, persist via CorpusStore, return appendix for the model.
 */
async function executeInfoVerify({
  text,
  projectId,
  agent,
  webSearch,
  webFetch,
  store = corpusStore,
  bucket,
} = {}) {
  const q = String(text || '').trim().slice(0, 240);
  const search = webSearch || (async (query) => {
    const Web = require('./WebSearchService');
    return Web.webSearch(query);
  });
  const fetch = webFetch || (async (url) => {
    const Web = require('./WebSearchService');
    return Web.webFetchDisk(url);
  });

  const hits = await search(q);
  const results = hits?.results || [];
  if (!hits?.ok || !results.length) {
    return {
      ok: false,
      error: hits?.error || 'no search hits',
      appendix: 'Could not verify facts on the web. Do not invent — say verification failed.',
      sources: [],
      corpus: null,
    };
  }

  const top = results[0];
  const url = top.url || top.link;
  const fetched = await fetch(url);
  if (!fetched?.ok) {
    return {
      ok: false,
      error: fetched?.error || 'fetch failed',
      appendix: 'Could not fetch a source to verify. Do not invent — say verification failed.',
      sources: [{ title: top.title, url }],
      corpus: null,
    };
  }

  const raw = String(fetched.text || fetched.body || '');
  const corpus = await store.put({
    projectId,
    raw,
    meta: {
      url,
      query: q,
      title: top.title || '',
      source: 'info_verify',
      content_type: 'text/html',
      license_notes: 'verify-gate fetch',
    },
    bucket: bucket || agent?.storage_bucket,
  });

  const norm = store.readNormalized(projectId, corpus.hash) || raw.slice(0, 12000);
  const appendix = [
    '## Verified sources (factual claims must cite these; never invent beyond this block)',
    `- ${top.title || url}: ${url}`,
    '',
    norm.slice(0, 6000),
  ].join('\n');

  return {
    ok: true,
    appendix,
    sources: [{ title: top.title, url }],
    corpus,
    search_hits: results.slice(0, 5),
  };
}

module.exports = {
  looksFactual,
  planInfoVerify,
  executeInfoVerify,
  maxRagScore,
  RAG_LOW,
};
