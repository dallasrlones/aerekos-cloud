/**
 * Service catalog — the single source of truth for the AWS/GCP-style console.
 *
 * Every manager seeded in the backend (conductor/scripts/seedServices.js) is
 * listed here with a friendly product name, category, blurb and icon so the
 * ServicesConsole can render a consistent catalog grid and so each manager gets
 * its own console page.
 *
 * `route` points enhanced managers (the ones with bespoke screens) at their
 * dedicated UI. Managers without a `route` fall back to the generic
 * ManagerConsole shell (overview / enable-disable / health / metrics), which
 * works for any registered service via the conductor's generic
 * /api/services/:name/* endpoints.
 */

// AWS-style top-level groupings. Order here = display order in the console.
export const CATEGORIES = [
  { id: 'compute', label: 'Compute' },
  { id: 'storage', label: 'Storage & Content' },
  { id: 'database', label: 'Database' },
  { id: 'security', label: 'Security, Identity & Compliance' },
  { id: 'networking', label: 'Networking & Delivery' },
  { id: 'devtools', label: 'Developer Tools' },
  { id: 'integration', label: 'Application Integration' },
  { id: 'management', label: 'Management & Observability' },
  { id: 'ai', label: 'Machine Learning & AI' },
];

/**
 * One entry per manager. `name` MUST match the backend service name (snake_case)
 * used by /api/services/:name/*. `icon` is an Ionicons name.
 */
export const SERVICE_CATALOG = [
  // --- Compute ---
  { name: 'compute_manager', label: 'Container Hosting', category: 'compute', icon: 'hardware-chip-outline', description: 'Run containers and workloads across your worker fleet.', route: 'computeManager' },
  { name: 'app_manager', label: 'Applications', category: 'compute', icon: 'apps-outline', description: 'Deploy and manage long-running applications.' },
  { name: 'worker_manager', label: 'Workers', category: 'compute', icon: 'git-network-outline', description: 'Register and orchestrate worker nodes.' },
  { name: 'host_manager', label: 'Hosts', category: 'compute', icon: 'desktop-outline', description: 'Manage physical and virtual host machines.' },
  { name: 'system_manager', label: 'Systems Manager', category: 'compute', icon: 'cog-outline', description: 'Operational tasks, patches and host configuration.' },

  // --- Storage & Content ---
  { name: 'storage_manager', label: 'Object Storage', category: 'storage', icon: 'cloud-upload-outline', description: 'Buckets and objects with signed URLs and encryption.', route: 'storageManager' },
  { name: 'registry_manager', label: 'Container Registry', category: 'storage', icon: 'cube-outline', description: 'Private registry for your container images.' },
  { name: 'cdn_manager', label: 'Content Delivery', category: 'storage', icon: 'globe-outline', description: 'Cache and distribute content at the edge.' },

  // --- Database ---
  { name: 'db_manager', label: 'Databases', category: 'database', icon: 'server-outline', description: 'Provision and operate managed databases.', route: 'databaseManager' },

  // --- Security, Identity & Compliance ---
  { name: 'key_manager', label: 'Key Management', category: 'security', icon: 'key-outline', description: 'Create and rotate encryption keys (KMS).', route: 'keyManager' },
  { name: 'secrets_manager', label: 'Secrets Manager', category: 'security', icon: 'lock-closed-outline', description: 'Store API tokens and credentials, encrypted at rest.', route: 'serviceSecretsList' },
  { name: 'iam_manager', label: 'Identity & Access', category: 'security', icon: 'people-circle-outline', description: 'Users, roles and permissions.' },
  { name: 'auth_manager', label: 'Authentication', category: 'security', icon: 'finger-print-outline', description: 'Sign-in, sessions and identity providers.', route: 'authManager' },
  { name: 'security_manager', label: 'Security Hub', category: 'security', icon: 'shield-checkmark-outline', description: 'Posture, findings and compliance checks.' },

  // --- Networking & Delivery ---
  { name: 'network_manager', label: 'Networking', category: 'networking', icon: 'git-network-outline', description: 'Virtual networks, routing and firewalls.' },
  { name: 'tunnel_manager', label: 'Tunnels', category: 'networking', icon: 'swap-horizontal-outline', description: 'Securely expose services through tunnels.' },
  { name: 'domain_manager', label: 'Domains & DNS', category: 'networking', icon: 'at-outline', description: 'Manage domains and DNS records.' },
  { name: 'balancer_manager', label: 'Load Balancing', category: 'networking', icon: 'git-merge-outline', description: 'Distribute traffic across instances.' },
  { name: 'api_manager', label: 'API Gateway', category: 'networking', icon: 'code-slash-outline', description: 'Publish, secure and route HTTP APIs.' },

  // --- Developer Tools ---
  { name: 'cicd_manager', label: 'CI / CD Pipelines', category: 'devtools', icon: 'sync-outline', description: 'Build, test and deploy automatically.' },
  { name: 'code_as_infra', label: 'Infrastructure as Code', category: 'devtools', icon: 'construct-outline', description: 'Declarative, versioned infrastructure.' },
  { name: 'git_manager', label: 'Source Repositories', category: 'devtools', icon: 'git-branch-outline', description: 'Host and manage Git repositories.' },
  { name: 'mcp_manager', label: 'MCP Servers', category: 'devtools', icon: 'extension-puzzle-outline', description: 'Model Context Protocol server fleet.' },

  // --- Application Integration ---
  { name: 'queue_manager', label: 'Message Queues', category: 'integration', icon: 'list-outline', description: 'Decouple services with durable queues.' },
  { name: 'schedule_manager', label: 'Scheduler', category: 'integration', icon: 'time-outline', description: 'Cron jobs and scheduled tasks.' },
  { name: 'webhook_manager', label: 'Webhooks', category: 'integration', icon: 'link-outline', description: 'Deliver and receive event webhooks.' },
  { name: 'email_manager', label: 'Email', category: 'integration', icon: 'mail-outline', description: 'Transactional and bulk email delivery.' },
  { name: 'sms_manager', label: 'SMS', category: 'integration', icon: 'chatbubble-ellipses-outline', description: 'Send text messages and alerts.' },
  { name: 'slack_manager', label: 'Slack', category: 'integration', icon: 'logo-slack', description: 'Post notifications and bots to Slack.' },

  // --- Management & Observability ---
  { name: 'logs_manager', label: 'Logs', category: 'management', icon: 'receipt-outline', description: 'Centralized log collection and search.' },
  { name: 'metrics_manager', label: 'Metrics', category: 'management', icon: 'stats-chart-outline', description: 'Time-series metrics and alarms.' },
  { name: 'analytics_manager', label: 'Analytics', category: 'management', icon: 'analytics-outline', description: 'Dashboards and usage analytics.' },

  // --- Machine Learning & AI ---
  { name: 'ai_manager', label: 'AI Services', category: 'ai', icon: 'sparkles-outline', description: 'LLM, embeddings, speech, memory/RAG on GPU workers.', route: 'aiManager' },
  { name: 'crawler_manager', label: 'Web Crawler', category: 'ai', icon: 'scan-outline', description: 'Crawl and index web content for data pipelines.' },
];

const BY_NAME = SERVICE_CATALOG.reduce((acc, s) => {
  acc[s.name] = s;
  return acc;
}, {});

/** Look up a single catalog entry by backend service name. */
export const getServiceMeta = (name) => BY_NAME[name] || null;

/** Human label for a service name, falling back to a Title Cased version. */
export const getServiceLabel = (name) => {
  const meta = BY_NAME[name];
  if (meta) return meta.label;
  return String(name || '')
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

/** Catalog grouped by category, preserving CATEGORIES order. Empty groups dropped. */
export const getCatalogByCategory = () =>
  CATEGORIES
    .map((cat) => ({
      ...cat,
      services: SERVICE_CATALOG.filter((s) => s.category === cat.id),
    }))
    .filter((group) => group.services.length > 0);

export default SERVICE_CATALOG;
