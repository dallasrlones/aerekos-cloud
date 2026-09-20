import api from '../utils/api';
import { computeManagerService } from './computeManagerService';
import { dbManagerService } from './dbManagerService';
import { storageManagerService } from './storageManagerService';
import { secretsManagerService } from './secretsManagerService';
import { edgeService } from './edgeService';
import { aiManagerService } from './aiManagerService';
import { projectService } from './projectService';
import { CATEGORIES, SERVICE_CATALOG, getServiceMeta } from './serviceCatalog';
import { isPlatformDeviceService } from '../config/platformDeviceServices';
import { matchesEnvironment } from '../utils/environmentMatch';

/** Same id as ProjectContext — system-owned LLMs are listed as available, not created here. */
export const SYSTEM_PROJECT_ID = '9d8bde11-6933-4732-b746-602dcf72eaa5';

/** Fleet / device control plane — System Home only. */
const NEVER_ON_PROJECT_HOME = new Set([
  'host_manager',
  'worker_manager',
  'system_manager',
  'logs_manager',
  'metrics_manager',
  'analytics_manager',
  'audit_manager',
  'trace_manager',
  'tunnel_manager',
  'code_as_infra',
]);

const SKIP_ITEM_LIST = new Set(NEVER_ON_PROJECT_HOME);

const ITEM_CAP = 8;

function interpolate(path, projectId) {
  return String(path || '').replace(/\{projectId\}/g, projectId || '');
}

function collectionUrl(serviceName, ops, projectId) {
  const raw = ops.applyPath || ops.createPath || ops.listPath || `${ops.proxyBase}/${ops.segment}`;
  const path = interpolate(raw, projectId).replace(/\/apply$/, '');
  return `/api/services/${serviceName}${path.startsWith('/') ? path : `/${path}`}`;
}

function extractItems(data, listKey) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  if (listKey && Array.isArray(data[listKey])) return data[listKey];
  for (const k of Object.keys(data)) {
    if (Array.isArray(data[k]) && k !== 'errors') return data[k];
  }
  return [];
}

function itemName(row) {
  return String(row?.name || row?.hostname || row?.title || row?.id || '').trim();
}

function asItem(row, extra = {}) {
  if (!row) return null;
  const name = itemName(row);
  if (!name) return null;
  return {
    id: row.id || row.name || name,
    name,
    status: row.status || '',
    subtitle: extra.subtitle || [row.type, row.image, row.capability, row.provider].filter(Boolean).join(' · '),
    kind: extra.kind || 'resource',
    raw: row,
  };
}

async function listClickOps(serviceName, ops, projectId) {
  if (!ops || !projectId) return [];
  try {
    const url = collectionUrl(serviceName, ops, projectId);
    const res = await api.get(url, { params: { project_id: projectId } });
    return extractItems(res.data, ops.listKey);
  } catch {
    return [];
  }
}

export function serviceScreen(serviceName) {
  const meta = getServiceMeta(serviceName);
  if (meta?.route) return { screen: meta.route, params: {} };
  return { screen: 'managerConsole', params: { serviceName } };
}

export function itemScreen(serviceName, item) {
  if (!item) return serviceScreen(serviceName);
  const row = item.raw || item;
  switch (serviceName) {
    case 'compute_manager':
      return { screen: 'containerDetails', params: { containerId: row.id, taskId: row.id } };
    case 'git_manager':
      return { screen: 'gitManager', params: { repoId: row.id } };
    case 'db_manager':
      return { screen: 'databaseDetails', params: { databaseName: row.name } };
    case 'storage_manager':
      return { screen: 'bucketDetails', params: { bucketName: row.name, projectId: row.project_id } };
    case 'secrets_manager':
      return { screen: 'serviceSecretDetails', params: { secretId: row.id } };
    case 'auth_manager':
      return { screen: 'providerForm', params: { providerId: row.id } };
    case 'ai_manager':
      if (item.kind === 'intelligence') {
        return { screen: 'aiIntelligenceForm', params: { intelligenceId: row.id } };
      }
      if (item.kind === 'rag') {
        return { screen: 'aiRagForm', params: { collectionId: row.id } };
      }
      if (item.kind === 'provider' && !item.shared) {
        return { screen: 'aiProviderForm', params: { providerId: row.id } };
      }
      return { screen: 'aiManager', params: {} };
    case 'key_manager':
      return { screen: 'keyDetails', params: { keyName: row.name } };
    default:
      return serviceScreen(serviceName);
  }
}

function summarize(items, emptyLabel = 'none · open to manage') {
  if (!items.length) return emptyLabel;
  const names = items.slice(0, 3).map((i) => i.name).join(', ');
  const extra = items.length > 3 ? ` +${items.length - 3}` : '';
  return `${items.length} · ${names}${extra}`;
}

function isEnabled(row) {
  return row?.enabled === true || row?.enabled === 1;
}

export async function loadProjectInventory(projectId, env) {
  if (!projectId) return [];

  const project = await projectService.getProject(projectId).then((r) => (r.success ? r.project : null)).catch(() => null);
  const enabled = new Set(
    (project?.services || []).filter(isEnabled).map((s) => s.name).filter(Boolean)
  );
  const catalog = SERVICE_CATALOG.filter((s) => (
    enabled.has(s.name) && !NEVER_ON_PROJECT_HOME.has(s.name)
  ));
  const groups = CATEGORIES.map((cat) => ({
    ...cat,
    services: catalog.filter((s) => s.category === cat.id).map((meta) => ({
      ...meta,
      items: [],
      shared: [],
      subtitle: 'none · open to manage',
    })),
  })).filter((g) => g.services.length);

  if (!catalog.length) return [];

  let opsByName = new Map();
  try {
    const res = await api.get('/api/setup/click-ops');
    for (const op of res.data?.ops || []) {
      if (!opsByName.has(op.name)) opsByName.set(op.name, op);
    }
  } catch {
    opsByName = new Map();
  }

  const [tasks, databases, buckets, hostnames, secretPayload, intelligence, rags, projectLlms, systemLlms, repos] = await Promise.all([
    computeManagerService.listTasks(projectId, env).catch(() => []),
    dbManagerService.getDatabases({ project_id: projectId }).then((r) => r.databases || []).catch(() => []),
    storageManagerService.getBuckets(projectId).then((r) => r.buckets || []).catch(() => []),
    edgeService.listHostnames(projectId).catch(() => []),
    secretsManagerService.listSecrets(projectId, env).catch(() => ({})),
    aiManagerService.listIntelligence(projectId).catch(() => []),
    aiManagerService.listRag(projectId).catch(() => []),
    aiManagerService.listIntegrations(projectId, 'llm').catch(() => []),
    projectId === SYSTEM_PROJECT_ID
      ? Promise.resolve([])
      : aiManagerService.listIntegrations(SYSTEM_PROJECT_ID, 'llm').catch(() => []),
    computeManagerService.listRepos(projectId).catch(() => []),
  ]);

  const secrets = extractItems(secretPayload, 'secrets');
  const special = {
    compute_manager: (tasks || []).map((t) => asItem(t, {
      subtitle: [t.image || 'container', t.worker_hostname].filter(Boolean).join(' · '),
    })),
    git_manager: (repos || []).map((r) => asItem(r, { subtitle: r.clone_url || 'repository' })),
    db_manager: (databases || []).filter((d) => matchesEnvironment(d, env)).map((d) => asItem(d, { subtitle: d.type || 'database' })),
    storage_manager: (buckets || []).filter((b) => matchesEnvironment(b, env)).map((b) => asItem(b, { subtitle: 'bucket' })),
    domain_manager: (hostnames || []).filter((h) => matchesEnvironment(h, env)).map((h) => asItem({
      ...h,
      name: h.hostname,
    }, { subtitle: h.port ? `:${h.port}` : 'hostname' })),
    secrets_manager: (secrets || []).map((s) => asItem(s, { subtitle: s.environment || env })),
    ai_manager: [
      ...(intelligence || []).map((i) => asItem(i, { kind: 'intelligence', subtitle: i.llm_integration ? `intelligence · ${i.llm_integration}` : 'intelligence' })),
      ...(rags || []).map((r) => asItem(r, { kind: 'rag', subtitle: 'RAG collection' })),
      ...(projectLlms || []).map((p) => asItem(p, { kind: 'provider', subtitle: `${p.provider || 'llm'} · this project` })),
    ].filter(Boolean),
  };

  const sharedLlms = (systemLlms || []).map((p) => ({
    ...asItem(p, { kind: 'shared_llm', subtitle: `${p.provider || 'llm'} · system · available to this env` }),
    shared: true,
  })).filter(Boolean);

  const remaining = catalog
    .map((s) => s.name)
    .filter((name) => !special[name] && !SKIP_ITEM_LIST.has(name));

  const extras = await Promise.all(remaining.map(async (name) => {
    const rows = await listClickOps(name, opsByName.get(name), projectId);
    const items = (rows || [])
      .filter((row) => matchesEnvironment(row, env))
      .map((row) => asItem(row))
      .filter(Boolean);
    return [name, items];
  }));

  const byName = { ...special };
  for (const [name, items] of extras) byName[name] = items;

  for (const group of groups) {
    for (const svc of group.services) {
      svc.items = (byName[svc.name] || []).filter(Boolean);
      svc.shared = svc.name === 'ai_manager' ? sharedLlms : [];
      const attached = svc.items.length;
      const shared = svc.shared.length;
      if (svc.name === 'ai_manager') {
        svc.subtitle = attached || shared
          ? `${attached} in this env${shared ? ` · ${shared} system LLM${shared === 1 ? '' : 's'} available` : ''}`
          : 'none · open to attach a system LLM';
      } else {
        svc.subtitle = summarize(svc.items);
      }
      svc.visibleItems = svc.items.slice(0, ITEM_CAP);
      svc.more = Math.max(0, svc.items.length - ITEM_CAP);
    }
    group.services = group.services.filter((svc) => {
      const attached = svc.items.length || svc.shared.length;
      if (attached) return true;
      return enabled.has(svc.name) && !isPlatformDeviceService(svc.name);
    });
  }

  return groups.filter((g) => g.services.length);
}
