'use strict';

/**
 * Catalog input_schema for platform tools. Keep in sync with docs/catalog.js
 * and docs/agents.md. Agents register these via mcp_manager tools CRUD.
 */
const PLATFORM_TOOLS = [
  {
    name: 'backup.run',
    description: 'Run a backup job into the aerekos-backups bucket.',
    input_schema: {
      type: 'object',
      required: ['project_id', 'source', 'resource'],
      properties: {
        project_id: { type: 'string' },
        source: { type: 'string', description: 'Manager name, e.g. db_manager' },
        resource: { type: 'string' },
        vault: { type: 'string', default: 'default' }
      },
      endpoint: '/api/services/backup_manager/api/v1/jobs',
      method: 'POST'
    }
  },
  {
    name: 'backup.restore',
    description: 'Restore a backup job snapshot.',
    input_schema: {
      type: 'object',
      required: ['project_id', 'job_id'],
      properties: {
        project_id: { type: 'string' },
        job_id: { type: 'string' },
        dest: { type: 'string' }
      },
      endpoint: '/api/services/backup_manager/api/v1/jobs/:job_id/restore',
      method: 'POST'
    }
  },
  {
    name: 'iac.status',
    description: 'IaC hookup status for a project.',
    input_schema: {
      type: 'object',
      required: ['project_id'],
      properties: { project_id: { type: 'string' } },
      endpoint: '/api/projects/:project_id/iac/status',
      method: 'GET'
    }
  },
  {
    name: 'iac.hookup',
    description: 'Hook up IaC (git or conductor).',
    input_schema: {
      type: 'object',
      required: ['project_id', 'mode'],
      properties: {
        project_id: { type: 'string' },
        mode: { type: 'string', enum: ['git', 'conductor'] },
        repo: { type: 'string', default: 'infra' }
      },
      endpoint: '/api/projects/:project_id/iac/hookup',
      method: 'POST'
    }
  },
  {
    name: 'edge.status',
    description: 'Tunnel/DNS hookup status. Uses existing Cloudflare secrets only.',
    input_schema: {
      type: 'object',
      required: ['project_id'],
      properties: { project_id: { type: 'string' } },
      endpoint: '/api/projects/:project_id/edge/status',
      method: 'GET'
    }
  },
  {
    name: 'edge.hookup',
    description: 'Enable tunnel + domain using existing cloudflare_api_token + cloudflare_account_id.',
    input_schema: {
      type: 'object',
      required: ['project_id'],
      properties: { project_id: { type: 'string' } },
      endpoint: '/api/projects/:project_id/edge/hookup',
      method: 'POST'
    }
  },
  {
    name: 'systems.check',
    description: 'Read-only host OS/Docker freshness. Never auto-updates.',
    input_schema: {
      type: 'object',
      required: ['worker_id'],
      properties: { worker_id: { type: 'string' } },
      endpoint: '/api/workers/:worker_id/host/check',
      method: 'GET'
    }
  },
  {
    name: 'systems.update',
    description: 'Update host OS or Docker on one worker. Disruptive. One device at a time.',
    input_schema: {
      type: 'object',
      required: ['worker_id', 'target'],
      properties: {
        worker_id: { type: 'string' },
        target: { type: 'string', enum: ['os', 'docker'] }
      },
      endpoint: '/api/workers/:worker_id/host/update',
      method: 'POST'
    }
  },
  {
    name: 'graphql.execute',
    description: 'Execute a GraphQL query against Data API models.',
    input_schema: {
      type: 'object',
      required: ['project_id', 'query'],
      properties: {
        project_id: { type: 'string' },
        name: { type: 'string' },
        query: { type: 'string' },
        variables: { type: 'object' }
      },
      endpoint: '/api/services/graphql_manager/api/v1/execute',
      method: 'POST'
    }
  },
  {
    name: 'search.query',
    description: 'FTS query. Empty hits only when the index is empty.',
    input_schema: {
      type: 'object',
      required: ['project_id', 'q'],
      properties: {
        project_id: { type: 'string' },
        q: { type: 'string' }
      },
      endpoint: '/api/services/search_manager/api/v1/query',
      method: 'POST'
    }
  }
];

module.exports = { PLATFORM_TOOLS };
