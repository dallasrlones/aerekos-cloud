'use strict';

/**
 * Thin Playwright HTTP driver. Run inside aerekos-icarus-browser.
 * POST /act { action, url, selector, value, key, project_id, agent_id }
 */

const http = require('http');
const PORT = Number(process.env.PORT || 9222);

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  chromium = null;
}

const contexts = new Map();
const CONSOLE_CAP = 40;

function recordConsole(buf, ev) {
  const row = {
    type: String(ev?.type || 'log'),
    text: String(ev?.text || '').slice(0, 500),
    url: String(ev?.url || ''),
    at: ev?.at || Date.now(),
  };
  const next = Array.isArray(buf) ? buf.slice() : [];
  next.push(row);
  while (next.length > CONSOLE_CAP) next.shift();
  return next;
}

function attachConsole(row) {
  if (!row?.page || row._listening) return;
  row._listening = true;
  row.console = row.console || [];
  const page = row.page;
  const push = (ev) => { row.console = recordConsole(row.console, ev); };
  page.on('console', (msg) => push({ type: msg.type(), text: msg.text(), url: page.url() }));
  page.on('pageerror', (err) => push({ type: 'pageerror', text: String(err?.message || err), url: page.url() }));
  page.on('requestfailed', (req) => push({
    type: 'requestfailed',
    text: `${req.failure()?.errorText || 'failed'} ${req.url()}`,
    url: req.url(),
  }));
}

function sid(body) {
  return `${body.project_id || 'p'}:${body.agent_id || 'a'}`;
}

async function ctxFor(body) {
  if (!chromium) throw new Error('playwright not installed');
  const id = sid(body);
  if (contexts.has(id)) return contexts.get(id);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const row = { browser, context, page, console: [] };
  attachConsole(row);
  contexts.set(id, row);
  return row;
}

async function a11y(page) {
  try {
    return await page.accessibility.snapshot({ interestingOnly: true });
  } catch {
    return { role: 'document', name: await page.title().catch(() => '') };
  }
}

async function handle(body) {
  const row = await ctxFor(body);
  const { page } = row;
  attachConsole(row);
  const act = String(body.action || '');
  if (act === 'navigate') await page.goto(String(body.url || 'about:blank'), { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (act === 'click' && body.selector) {
    const loc = page.getByText(String(body.selector), { exact: false }).first();
    await loc.click({ timeout: 8000 }).catch(() => page.click(String(body.selector), { timeout: 8000 }));
  }
  if (act === 'type' && body.selector) {
    await page.fill(String(body.selector), String(body.value || '')).catch(async () => {
      await page.getByRole('textbox').first().fill(String(body.value || ''));
    });
  }
  if (act === 'press' && body.key) await page.keyboard.press(String(body.key));
  if (act === 'select' && body.selector) await page.selectOption(String(body.selector), String(body.value || ''));
  const shot = await page.screenshot({ type: 'jpeg', quality: 55, fullPage: false });
  return {
    url: page.url(),
    title: await page.title(),
    snapshot: await a11y(page),
    screenshot_base64: shot.toString('base64'),
    console: (row.console || []).slice(-20),
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, playwright: !!chromium }));
  }
  if (req.method !== 'POST' || !/^\/act\/?$/.test(req.url || '')) {
    res.writeHead(404);
    return res.end('not found');
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  let body = {};
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { /* */ }
  try {
    const out = await handle(body);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(out));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message || 'browser failed' }));
  }
});

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => console.log(`[icarus-browser] :${PORT}`));
}

module.exports = { handle, server, recordConsole, CONSOLE_CAP };
