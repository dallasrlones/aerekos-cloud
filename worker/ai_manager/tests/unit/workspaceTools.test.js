'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { resolveInWorkspace, executeTool, dangerClassify, classifyTool, openaiToolSchemas, extractToolCalls } = require('../../api/services/workspaceTools');

describe('workspaceTools', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-'));
  afterAll(() => { fs.rmSync(root, { recursive: true, force: true }); });

  test('jails paths', () => {
    expect(() => resolveInWorkspace(root, '../../etc/passwd')).toThrow(/escapes/);
    const p = resolveInWorkspace(root, 'a/b.txt');
    const base = fs.realpathSync(root);
    expect(p === base || p.startsWith(base + path.sep)).toBe(true);
  });

  test('read write list and write is classified', () => {
    expect(classifyTool('file_read')).toBe('read');
    expect(classifyTool('file_write')).toBe('write');
    expect(dangerClassify('file_write', { path: 'x' }).level).toBe('ask');
    expect(dangerClassify('shell', { cmd: 'rm -rf /' }).level).toBe('deny');
    const w = executeTool('file_write', { path: 'hi.txt', content: 'yo' }, { root });
    expect(w.ok).toBe(true);
    const r = executeTool('file_read', { path: 'hi.txt' }, { root });
    expect(r.content).toBe('yo');
    const list = executeTool('file_list', { path: '.' }, { root });
    expect(list.entries).toContain('hi.txt');
  });

  test('denies secret read and research writes', () => {
    expect(dangerClassify('file_read', { path: '.env' }, root, 'dev').level).toBe('deny');
    expect(executeTool('file_read', { path: '.env' }, { root, persona: 'dev' }).denied).toBe(true);
    expect(executeTool('file_write', { path: 'x.txt', content: 'no' }, { root, persona: 'research' }).denied).toBe(true);
  });

  test('openai tool schemas and extractToolCalls', () => {
    const schemas = openaiToolSchemas();
    expect(schemas[0].type).toBe('function');
    expect(schemas[0].function.name).toBeTruthy();
    expect(schemas[0].function.parameters.type).toBe('object');
    const calls = extractToolCalls({
      message: { tool_calls: [{ function: { name: 'file_list', arguments: '{"path":"."}' } }] },
    });
    expect(calls[0]).toEqual({ name: 'file_list', args: { path: '.' } });
    const fb = extractToolCalls({ message: { content: '<<TOOL>>grep\n{"pattern":"foo"}' } });
    expect(fb[0].name).toBe('grep');
  });
});
