export function parseMeta(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function resourceEnvironment(row) {
  if (!row) return '';
  if (row.environment != null && String(row.environment).trim() !== '') {
    return String(row.environment);
  }
  return String(parseMeta(row.metadata).environment || '');
}

/** Empty/missing env still shows on every environment until rebound. */
export function matchesEnvironment(row, env) {
  const e = resourceEnvironment(row);
  return !e || e === env;
}

export function parseProjectConfig(project) {
  const raw = project?.config;
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
