#!/usr/bin/env node
/**
 * Generate docs/openapi/ga-managers.generated.yaml from docs/catalog.js (CommonJS).
 *
 * Run: node scripts/oss/gen-openapi-from-catalog.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '../..');
const require = createRequire(import.meta.url);

const { conductor, managers } = require(path.join(repoRoot, 'docs/catalog.js'));

const CORE_GA = new Set([
  'key_manager',
  'storage_manager',
  'secrets_manager',
  'compute_manager',
  'queue_manager',
]);

function openApiPath(p) {
  return String(p).replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

function yamlQuote(s) {
  const t = String(s || '');
  if (/[:#{}[\],&*?]|^[\s-]/.test(t) || t.includes("'")) {
    return JSON.stringify(t);
  }
  return t;
}

function methodKey(m) {
  const map = { GET: 'get', POST: 'post', PUT: 'put', PATCH: 'patch', DELETE: 'delete' };
  return map[m] || null;
}

/**
 * @returns {Map<string, Map<string, { summary: string }>>}
 */
function collectPaths(name, endpoints, proxyBase) {
  const paths = new Map();
  const add = (method, rawPath, summary) => {
    const mk = methodKey(method);
    if (!mk) return;
    const abs = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    const proxyPath = name === 'conductor'
      ? abs
      : `/api/services/${name}${abs}`;
    const oa = openApiPath(proxyPath);
    if (!paths.has(oa)) paths.set(oa, new Map());
    paths.get(oa).set(mk, { summary: summary || `${method} ${abs}` });
  };

  for (const ep of endpoints || []) add(ep.method, ep.path, ep.summary);

  if (name !== 'conductor') {
    const infoPath = `${proxyBase || '/api/v1'}/info`.replace(/\/+/g, '/');
    add('GET', infoPath, 'Service metadata (info)');
    add('GET', '/health', 'Liveness (direct manager health; proxy may use /api/services/{name}/health)');
  } else {
    add('GET', '/health', 'Liveness');
  }

  return paths;
}

function renderPaths(pathMap) {
  const lines = [];
  for (const [oaPath, methods] of [...pathMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`  ${oaPath}:`);
    for (const [mk, { summary }] of methods) {
      lines.push(`    ${mk}:`);
      lines.push(`      summary: ${yamlQuote(summary)}`);
      lines.push('      responses:');
      lines.push("        '200':");
      lines.push('          description: Success (shape varies by manager)');
    }
  }
  return lines;
}

function buildYaml() {
  const allPaths = new Map();

  const merge = (chunk) => {
    for (const [k, v] of chunk) {
      if (!allPaths.has(k)) allPaths.set(k, new Map());
      for (const [mk, meta] of v) allPaths.get(k).set(mk, meta);
    }
  };

  merge(collectPaths('conductor', conductor.endpoints, conductor.proxyBase));
  for (const m of managers.filter((x) => CORE_GA.has(x.name))) {
    merge(collectPaths(m.name, m.endpoints, m.proxyBase));
  }

  const out = [];
  out.push('openapi: 3.0.3');
  out.push('info:');
  out.push('  title: aerekos-cloud GA managers (catalog-generated)');
  out.push('  version: 0.1.0');
  out.push('  description: |');
  out.push('    Generated from docs/catalog.js — conductor proxy paths for core GA managers.');
  out.push('    Regenerate: node scripts/oss/gen-openapi-from-catalog.mjs');
  out.push('servers:');
  out.push('  - url: http://{conductor}/');
  out.push('    variables:');
  out.push('      conductor:');
  out.push('        default: localhost:3000');
  out.push('paths:');
  out.push(...renderPaths(allPaths));
  return `${out.join('\n')}\n`;
}

const outDir = path.join(repoRoot, 'docs/openapi');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'ga-managers.generated.yaml');
fs.writeFileSync(outFile, buildYaml(), 'utf8');
console.log(`Wrote ${path.relative(repoRoot, outFile)} (${CORE_GA.size} managers + conductor)`);
