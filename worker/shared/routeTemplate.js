'use strict';

/**
 * Path template matching — `/v1/projects/{project_id}/ai/llm/{endpoint_name}/chat`
 */

function normalizePath(p) {
  if (!p || typeof p !== 'string') return '/';
  let out = p.trim();
  if (!out.startsWith('/')) out = `/${out}`;
  if (out.length > 1 && out.endsWith('/')) out = out.slice(0, -1);
  return out;
}

function compilePattern(pattern) {
  const norm = normalizePath(pattern);
  const keys = [];
  const parts = norm.split('/').filter(Boolean);
  const reParts = parts.map((seg) => {
    if (seg.startsWith('{') && seg.endsWith('}')) {
      const key = seg.slice(1, -1);
      keys.push(key);
      return '([^/]+)';
    }
    return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });
  const re = new RegExp(`^/${reParts.join('/')}$`);
  return { re, keys, pattern: norm };
}

/**
 * @returns {{ params: Record<string,string> } | null}
 */
function matchPath(pattern, path) {
  const compiled = compilePattern(pattern);
  const normPath = normalizePath(path);
  const m = normPath.match(compiled.re);
  if (!m) return null;
  const params = {};
  compiled.keys.forEach((key, i) => {
    params[key] = decodeURIComponent(m[i + 1]);
  });
  return { params, pattern: compiled.pattern };
}

function fillTemplate(template, params) {
  if (!template) return '';
  return String(template).replace(/\{([^}]+)\}/g, (_, key) => {
    const val = params && params[key];
    return val != null ? String(val) : '';
  });
}

function buildPublicUrl(baseUrl, publicPath, params) {
  const base = String(baseUrl || '').replace(/\/$/, '');
  if (!base) return null;
  const path = fillTemplate(publicPath, params);
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

module.exports = {
  normalizePath,
  compilePattern,
  matchPath,
  fillTemplate,
  buildPublicUrl,
};
