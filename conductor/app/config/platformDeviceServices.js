/**
 * Always-on per-device managers. Must match conductor/api/config/platformDeviceServices.js.
 * These stay on System Home and never appear on a project/env Home.
 *
 * Do not put ai_manager in this list — conductor would try to place it on
 * every platform host. GPU AI lives on Orin and is listed separately.
 */
export const PLATFORM_DEVICE_SERVICES = [
  'key_manager',
  'secrets_manager',
  'auth_manager',
  'iam_manager',
  'cert_manager',
  'config_manager',
  'storage_manager',
  'db_manager',
  'compute_manager',
  'backup_manager',
  'network_manager',
  'queue_manager',
  'schedule_manager',
  'logs_manager',
  'metrics_manager',
  'audit_manager',
  'trace_manager',
  'event_manager',
  'status_manager',
  'security_manager',
  'git_manager',
  'registry_manager',
  'cicd_manager',
  'code_as_infra',
  'api_manager',
  'mcp_manager',
  'search_manager',
  'graphql_manager',
  'tunnel_manager',
  'domain_manager',
  'host_manager',
  'system_manager',
  'worker_manager',
  'webhook_manager',
];

export function isPlatformDeviceService(name) {
  return PLATFORM_DEVICE_SERVICES.includes(String(name || ''));
}

/** Orin/GPU consoles. Shown on System Home; not always-on on every device. */
export const GPU_FLEET_SERVICES = ['ai_manager'];
