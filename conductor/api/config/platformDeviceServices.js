'use strict';

/**
 * Always-on per conductor-role device (one process per host).
 * Rows stay project-scoped via project_id. Do not deploy a second copy per project.
 *
 * On this host: identity, data-plane control, observe, ship, edge control, device ops.
 * Not in this pack (opt-in / other device):
 *   ai / notebook / vector / crawler — GPU (orin)
 *   email / sms / slack / push — send only when project secrets exist
 *   app / function / cluster / balancer / cdn / waf / vpn / iot — product-shaped
 *   billing_manager — quota fanout wedges conductor SQLite
 */
const PLATFORM_DEVICE_SERVICES = [
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

function isPlatformDeviceService(name) {
  return PLATFORM_DEVICE_SERVICES.includes(String(name || ''));
}

module.exports = { PLATFORM_DEVICE_SERVICES, isPlatformDeviceService };
