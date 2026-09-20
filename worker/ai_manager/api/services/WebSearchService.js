'use strict';

const { scrubSecrets } = require('./agentArn');

function looksBlocked(html) {
  const t = String(html || '').slice(0, 2000).toLowerCase();
  return /captcha|enable javascript|unusual traffic|access denied/.test(t) && !/<a[^>]+href=/i.test(html);
}

function parseDdg(html) {
  const out = [];
  const re = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) && out.length < 8) {
    const href = String(m[1] || '').replace(/&amp;/g, '&');
    const title = String(m[2] || '').replace(/<[^>]+>/g, '').trim();
    if (href && title) out.push({ title, url: href });
  }
  const lite = /<a rel="nofollow" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  while ((m = lite.exec(html)) && out.length < 8) {
    const href = String(m[1] || '');
    const title = String(m[2] || '').replace(/<[^>]+>/g, '').trim();
    if (href.startsWith('http') && title) out.push({ title, url: href });
  }
  return out;
}

async function webSearch(q, { url, fetchImpl } = {}) {
  const query = String(q || '').trim();
  if (!query) return { ok: false, stub: false, error: 'query required' };
  const endpoint = url || process.env.WEB_SEARCH_URL || '';
  const fetchFn = fetchImpl || fetch;
  try {
    if (endpoint) {
      const res = await fetchFn(endpoint.includes('{q}')
        ? endpoint.replace('{q}', encodeURIComponent(query))
        : `${endpoint}${endpoint.includes('?') ? '&' : '?'}q=${encodeURIComponent(query)}`, { method: 'GET' });
      const body = await res.text();
      if (!res.ok) return { ok: false, stub: false, error: `search HTTP ${res.status}` };
      try {
        const json = JSON.parse(body);
        const hits = json.results || json.items || json.hits || [];
        if (!Array.isArray(hits) || !hits.length) return { ok: false, stub: false, error: 'empty search results' };
        return { ok: true, stub: false, results: hits.slice(0, 8) };
      } catch {
        const parsed = parseDdg(body);
        if (!parsed.length || looksBlocked(body)) return { ok: false, stub: false, error: 'search page unusable' };
        return { ok: true, stub: false, results: parsed };
      }
    }
    const ddg = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetchFn(ddg, {
      method: 'GET',
      headers: { 'User-Agent': 'aerekos-icarus/1.0' },
    });
    const html = await res.text();
    if (!res.ok || looksBlocked(html)) {
      return { ok: false, stub: false, error: `duckduckgo ${res.status || 'blocked'}` };
    }
    const results = parseDdg(html);
    if (!results.length) return { ok: false, stub: false, error: 'no parseable web hits' };
    return { ok: true, stub: false, results };
  } catch (e) {
    return { ok: false, stub: false, error: e.message || 'web_search failed' };
  }
}

async function webFetch(url, { fetchImpl } = {}) {
  const href = String(url || '');
  if (!/^https?:\/\//i.test(href)) return { ok: false, error: 'url required' };
  try {
    const fetchFn = fetchImpl || fetch;
    const res = await fetchFn(href, { method: 'GET' });
    const body = scrubSecrets(await res.text());
    return { ok: res.ok, status: res.status, body: body.slice(0, 8000), stub: false };
  } catch (e) {
    return { ok: false, stub: false, error: e.message, code: e.code };
  }
}

const DISK_CAP = 2 * 1024 * 1024;

async function webFetchDisk(url, { fetchImpl, maxBytes = DISK_CAP } = {}) {
  const href = String(url || '');
  if (!/^https?:\/\//i.test(href)) return { ok: false, error: 'url required' };
  try {
    const fetchFn = fetchImpl || fetch;
    const res = await fetchFn(href, { method: 'GET' });
    const raw = await res.text();
    const body = scrubSecrets(raw).slice(0, maxBytes);
    const looksPdf = /%PDF-|application\/pdf/i.test(String(res.headers?.get?.('content-type') || '') + body.slice(0, 16));
    if (looksPdf && !/\/Text|BT[\s\S]{0,40}Tj/.test(body)) {
      return { ok: false, error: 'PDF has no extractable text layer', ask: true };
    }
    return { ok: res.ok, status: res.status, text: body, body, stub: false };
  } catch (e) {
    return { ok: false, stub: false, error: e.message, code: e.code };
  }
}

module.exports = { webSearch, webFetch, webFetchDisk, parseDdg, looksBlocked };
