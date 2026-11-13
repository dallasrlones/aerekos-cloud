'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  CorpusStore, normalizeToMarkdown, contentHash,
} = require('../../api/services/CorpusStore');

describe('CorpusStore', () => {
  let tmp;
  let store;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'corpus-'));
    process.env.AI_MANAGER_DATA = tmp;
    process.env.CORPUS_LOCAL_ONLY = '1';
    store = new CorpusStore({ root: path.join(tmp, 'corpus') });
  });

  afterEach(() => {
    delete process.env.CORPUS_LOCAL_ONLY;
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* */ }
  });

  test('normalizeToMarkdown strips basic HTML', () => {
    const md = normalizeToMarkdown('<html><body><h1>Hi</h1><p>There</p></body></html>');
    expect(md).toMatch(/Hi/);
    expect(md).toMatch(/There/);
    expect(md).not.toMatch(/<html/);
  });

  test('put writes raw, normalized.md, meta.json under icarus/corpus/{date}/{hash}', async () => {
    const pid = '11111111-2222-4333-8444-555555555555';
    const raw = '<html><body>alpha</body></html>';
    const hash = contentHash(['http://example.com', 'alpha']);
    const out = await store.put({
      projectId: pid,
      raw,
      meta: { url: 'http://example.com', query: 'alpha test' },
      hash,
    });
    expect(out.ok).toBe(true);
    expect(out.prefix).toMatch(/^icarus\/corpus\/\d{4}-\d{2}-\d{2}\//);
    expect(out.storage).toBe('local');
    const normPath = out.paths.normalized;
    expect(fs.existsSync(normPath)).toBe(true);
    expect(fs.readFileSync(normPath, 'utf8')).toMatch(/alpha/);
    const meta = JSON.parse(fs.readFileSync(out.paths.meta, 'utf8'));
    expect(meta.url).toBe('http://example.com');
    expect(meta.hash).toBe(hash);
  });

  test('listRecent returns project rows from index', async () => {
    const pid = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    await store.put({ projectId: pid, raw: 'one', meta: { query: 'a' } });
    await store.put({ projectId: pid, raw: 'two', meta: { query: 'b' } });
    const rows = store.listRecent(pid, { limit: 10 });
    expect(rows.length).toBe(2);
    expect(rows[0].query).toBe('b');
  });
});
