/**
 * Client-side dependency catalog for AWS-style service guides.
 * Mirrors setupCatalog.required edges; used by ServiceGuide + DependencyChecklist.
 */

import { getServiceLabel } from './serviceCatalog';

/** @type {Record<string, { id: string, required?: boolean, why: string }[]>} */
export const SERVICE_REQUIRES = {
  key_manager: [],
  secrets_manager: [
    { id: 'key_manager', required: true, why: 'Envelope encryption (KMS)' },
  ],
  auth_manager: [
    { id: 'key_manager', required: true, why: 'JWT signing keys' },
    { id: 'secrets_manager', required: true, why: 'Bootstrap client secret' },
  ],
  iam_manager: [
    { id: 'auth_manager', required: true, why: 'Users, roles, and policies' },
  ],
  storage_manager: [
    { id: 'key_manager', required: true, why: 'Per-object encryption (KMS)' },
    { id: 'auth_manager', required: true, why: 'App credentials & invoke (IAM analog)' },
  ],
  compute_manager: [
    { id: 'auth_manager', required: true, why: 'Task and container invoke auth' },
  ],
  db_manager: [
    { id: 'key_manager', required: true, why: 'Credential encryption' },
    { id: 'auth_manager', required: true, why: 'db:Connect app access' },
  ],
  queue_manager: [
    { id: 'auth_manager', required: true, why: 'queue:Send / queue:Receive' },
  ],
  function_manager: [
    { id: 'auth_manager', required: true, why: 'function:Invoke (IAM)' },
    { id: 'compute_manager', required: true, why: 'Run zip / container workloads' },
    { id: 'storage_manager', required: true, why: 'Deployment artifacts' },
    { id: 'queue_manager', required: true, why: 'Inbox queue + DLQ for async' },
  ],
  api_manager: [
    { id: 'auth_manager', required: true, why: 'JWT at the gateway edge' },
  ],
  ai_manager: [
    { id: 'auth_manager', required: true, why: 'API authentication' },
    { id: 'key_manager', required: true, why: 'KMS' },
    { id: 'secrets_manager', required: true, why: 'Provider API keys' },
  ],
  event_manager: [
    { id: 'auth_manager', required: true, why: 'event:Put' },
    { id: 'queue_manager', required: false, why: 'Optional fan-out targets' },
  ],
  webhook_manager: [
    { id: 'auth_manager', required: true, why: 'Signed delivery' },
    { id: 'queue_manager', required: true, why: 'Durable dispatch' },
  ],
  git_manager: [
    { id: 'storage_manager', required: true, why: 'Bare repos and LFS objects' },
    { id: 'auth_manager', required: true, why: 'git:Push / git:Clone' },
  ],
  cicd_manager: [
    { id: 'git_manager', required: true, why: 'Source repositories' },
    { id: 'compute_manager', required: true, why: 'Build runners' },
    { id: 'auth_manager', required: true, why: 'Pipeline credentials' },
  ],
};

/**
 * @param {string} serviceName
 * @returns {{ id: string, name: string, required: boolean, why: string }[]}
 */
export function getDepsForService(serviceName) {
  const rows = SERVICE_REQUIRES[serviceName] || [];
  return rows.map((d) => ({
    id: d.id,
    name: getServiceLabel(d.id),
    required: d.required !== false,
    why: d.why || '',
  }));
}

/**
 * Annotate dependency rows with satisfied | missing.
 * @param {{ id: string, [key: string]: unknown }[]} deps
 * @param {Iterable<string> | Set<string>} enabledSet — service names already enabled for the project
 */
export function resolveMissing(deps, enabledSet) {
  const on = enabledSet instanceof Set ? enabledSet : new Set(enabledSet);
  return deps.map((dep) => ({
    ...dep,
    status: on.has(dep.id) ? 'satisfied' : 'missing',
  }));
}

/**
 * Flat required dependency chain (depth-first) for a service.
 * @param {string} serviceName
 * @returns {string[]}
 */
export function requiredChain(serviceName) {
  const out = [];
  const seen = new Set();
  function walk(name) {
    for (const d of SERVICE_REQUIRES[name] || []) {
      if (!d.required) continue;
      if (!seen.has(d.id)) {
        walk(d.id);
        seen.add(d.id);
        out.push(d.id);
      }
    }
  }
  walk(serviceName);
  return out;
}

export default {
  SERVICE_REQUIRES,
  getDepsForService,
  resolveMissing,
  requiredChain,
};
