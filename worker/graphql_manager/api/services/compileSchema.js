'use strict';

function singular(name) {
  const n = String(name || '').trim();
  if (!n) return n;
  if (/ies$/i.test(n)) return n.slice(0, -3) + 'y';
  if (/ses$/i.test(n)) return n.slice(0, -2);
  if (/s$/i.test(n) && !/ss$/i.test(n)) return n.slice(0, -1);
  return n;
}

function cap(n) {
  const s = singular(String(n || ''));
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function collectionName(modelName) {
  const n = String(modelName || '').trim();
  if (!n) return n;
  const base = n.charAt(0).toLowerCase() + n.slice(1);
  if (/s$/i.test(base)) return base;
  if (/y$/i.test(base) && !/[aeiou]y$/i.test(base)) return `${base.slice(0, -1)}ies`;
  return `${base}s`;
}

function gqlScalar(t) {
  const v = String(t || 'string').toLowerCase();
  if (v === 'number' || v === 'integer' || v === 'float') return 'Float';
  if (v === 'boolean' || v === 'bool') return 'Boolean';
  if (v === 'id') return 'ID';
  return 'String';
}

function asList(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function compileSchema(models) {
  const names = Object.keys(models || {});
  const types = names.map((name) => {
    const def = models[name] || {};
    const fieldLines = Object.keys(def.fields || {})
      .filter((f) => f !== 'id')
      .map((f) => `  ${f}: ${gqlScalar(def.fields[f])}`);
    const rels = [];
    for (const child of asList(def.settings?.hasMany)) {
      const childName = cap(child);
      rels.push(`  ${collectionName(childName)}: [${childName}!]!`);
    }
    for (const parent of asList(def.settings?.belongsTo)) {
      const parentName = cap(parent);
      const field = parentName.charAt(0).toLowerCase() + parentName.slice(1);
      rels.push(`  ${field}: ${parentName}`);
    }
    return `type ${name} {\n  id: ID!\n${[...fieldLines, ...rels].join('\n')}\n}`;
  });
  const queries = names.map((n) => {
    const col = collectionName(n);
    const one = n.charAt(0).toLowerCase() + n.slice(1);
    return `  ${col}: [${n}!]!\n  ${one}(id: ID!): ${n}`;
  }).join('\n');
  const mutations = names.map((n) => {
    const def = models[n] || {};
    const fields = Object.keys(def.fields || {}).filter((f) => f !== 'id');
    const args = fields.map((f) => `${f}: ${gqlScalar(def.fields[f])}`).join(', ');
    const createArgs = args || 'id: ID';
    const updateArgs = args ? `id: ID!, ${args}` : 'id: ID!';
    return `  create${n}(${createArgs}): ${n}!\n  update${n}(${updateArgs}): ${n}`;
  }).join('\n');
  return `${types.join('\n\n')}\n\ntype Query {\n${queries}\n}\n\ntype Mutation {\n${mutations}\n}\n`;
}

module.exports = { compileSchema, collectionName, cap };
