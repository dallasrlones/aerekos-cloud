require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Service } = require('../api/models');
const { initializeDatabase } = require('../api/utils/dbInit');

/**
 * Seed initial services into the database
 * Run this script to create base service records
 */
async function seedServices() {
  try {
    // Initialize database first
    await initializeDatabase();

    const servicesToSeed = [
      {
        name: 'compute_manager',
        docker_image: 'aerekos-compute_manager:latest',
        enabled: 0,
        config: JSON.stringify({
          ports: { '3100': '3100' }
        })
      },
      {
        name: 'key_manager',
        docker_image: 'aerekos-key_manager:latest',
        enabled: 0,
        config: JSON.stringify({
          ports: { '3102': '3102' }
        })
      },
      {
        name: 'storage_manager',
        docker_image: 'aerekos-storage_manager:latest',
        enabled: 0,
        config: JSON.stringify({
          ports: { '3003': '3003' }
        })
      },
      {
        name: 'db_manager',
        docker_image: 'aerekos-db_manager:latest',
        enabled: 0,
        config: JSON.stringify({
          ports: { '3004': '3004' }
        })
      },
      {
        name: 'queue_manager',
        docker_image: 'aerekos-queue_manager:latest',
        enabled: 0,
        config: JSON.stringify({
          ports: { '3101': '3101' }
        })
      },
      {
        name: 'schedule_manager',
        docker_image: 'aerekos-schedule_manager:latest',
        enabled: 0,
        config: JSON.stringify({
          ports: { '3102': '3102' }
        })
      },
      {
        name: 'network_manager',
        docker_image: 'aerekos-network_manager:latest',
        enabled: 0,
        config: JSON.stringify({
          ports: { '3103': '3103' }
        })
      },
      {
        name: 'tunnel_manager',
        docker_image: 'aerekos-tunnel_manager:latest',
        enabled: 0,
        config: JSON.stringify({
          ports: { '3110': '3110' }
        })
      },
      {
        name: 'domain_manager',
        docker_image: 'aerekos-domain_manager:latest',
        enabled: 0,
        config: JSON.stringify({
          ports: { '3111': '3111' }
        })
      },
      {
        name: 'iam_manager',
        docker_image: 'aerekos-iam_manager:latest',
        enabled: 0,
        config: JSON.stringify({
          ports: { '3106': '3106' }
        })
      },
      {
        name: 'logs_manager',
        docker_image: 'aerekos-logs_manager:latest',
        enabled: 0,
        config: JSON.stringify({
          ports: { '3104': '3104' }
        })
      },
      {
        name: 'secrets_manager',
        docker_image: 'aerekos-secrets_manager:latest',
        enabled: 0,
        config: JSON.stringify({
          ports: { '3107': '3107' }
        })
      },
      {
        name: 'registry_manager',
        docker_image: 'aerekos-registry_manager:latest',
        enabled: 0,
        config: JSON.stringify({
          ports: { '3129': '3129' }
        })
      },
      { name: 'metrics_manager', docker_image: 'aerekos-metrics_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3105': '3105' } }) },
      { name: 'security_manager', docker_image: 'aerekos-security_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3108': '3108' } }) },
      { name: 'balancer_manager', docker_image: 'aerekos-balancer_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3109': '3109' } }) },
      { name: 'webhook_manager', docker_image: 'aerekos-webhook_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3112': '3112' } }) },
      { name: 'email_manager', docker_image: 'aerekos-email_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3113': '3113' } }) },
      { name: 'sms_manager', docker_image: 'aerekos-sms_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3114': '3114' } }) },
      { name: 'slack_manager', docker_image: 'aerekos-slack_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3115': '3115' } }) },
      { name: 'auth_manager', docker_image: 'aerekos-auth_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3116': '3116' } }) },
      { name: 'analytics_manager', docker_image: 'aerekos-analytics_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3117': '3117' } }) },
      { name: 'cdn_manager', docker_image: 'aerekos-cdn_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3118': '3118' } }) },
      { name: 'cicd_manager', docker_image: 'aerekos-cicd_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3119': '3119' } }) },
      { name: 'code_as_infra', docker_image: 'aerekos-code_as_infra:latest', enabled: 0, config: JSON.stringify({ ports: { '3120': '3120' } }) },
      { name: 'crawler_manager', docker_image: 'aerekos-crawler_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3121': '3121' } }) },
      { name: 'host_manager', docker_image: 'aerekos-host_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3122': '3122' } }) },
      { name: 'mcp_manager', docker_image: 'aerekos-mcp_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3123': '3123' } }) },
      { name: 'api_manager', docker_image: 'aerekos-api_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3124': '3124' } }) },
      { name: 'app_manager', docker_image: 'aerekos-app_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3125': '3125' } }) },
      { name: 'ai_manager', docker_image: 'aerekos-ai_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3126': '3126' } }) },
      { name: 'system_manager', docker_image: 'aerekos-system_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3127': '3127' } }) },
      { name: 'worker_manager', docker_image: 'aerekos-worker_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3128': '3128' } }) },
      { name: 'git_manager', docker_image: 'aerekos-git_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3130': '3130' } }) },
      { name: 'websocket_manager', docker_image: 'aerekos-websocket_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3131': '3131' } }) },
      { name: 'event_manager', docker_image: 'aerekos-event_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3132': '3132' } }) },
      { name: 'download_manager', docker_image: 'aerekos-download_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3133': '3133' } }) },
      { name: 'backup_manager', docker_image: 'aerekos-backup_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3134': '3134' } }) },
      { name: 'workflow_manager', docker_image: 'aerekos-workflow_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3135': '3135' } }) },
      { name: 'config_manager', docker_image: 'aerekos-config_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3136': '3136' } }) },
      { name: 'cert_manager', docker_image: 'aerekos-cert_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3137': '3137' } }) },
      { name: 'billing_manager', docker_image: 'aerekos-billing_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3138': '3138' } }) },
      { name: 'function_manager', docker_image: 'aerekos-function_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3139': '3139' } }) },
      { name: 'iot_manager', docker_image: 'aerekos-iot_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3140': '3140' } }) },
      { name: 'graphql_manager', docker_image: 'aerekos-graphql_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3141': '3141' } }) },
      { name: 'notebook_manager', docker_image: 'aerekos-notebook_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3142': '3142' } }) },
      { name: 'trace_manager', docker_image: 'aerekos-trace_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3143': '3143' } }) },
      { name: 'search_manager', docker_image: 'aerekos-search_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3144': '3144' } }) },
      { name: 'query_manager', docker_image: 'aerekos-query_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3145': '3145' } }) },
      { name: 'waf_manager', docker_image: 'aerekos-waf_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3146': '3146' } }) },
      { name: 'vpn_manager', docker_image: 'aerekos-vpn_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3147': '3147' } }) },
      { name: 'transfer_manager', docker_image: 'aerekos-transfer_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3148': '3148' } }) },
      { name: 'audit_manager', docker_image: 'aerekos-audit_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3149': '3149' } }) },
      { name: 'status_manager', docker_image: 'aerekos-status_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3150': '3150' } }) },
      { name: 'cluster_manager', docker_image: 'aerekos-cluster_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3151': '3151' } }) },
      { name: 'vector_manager', docker_image: 'aerekos-vector_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3152': '3152' } }) },
      { name: 'push_manager', docker_image: 'aerekos-push_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3153': '3153' } }) },
      { name: 'notify_manager', docker_image: 'aerekos-notify_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3154': '3154' } }) }
    ];

    console.log('Seeding services...');

    for (const serviceData of servicesToSeed) {
      try {
        // Check if service already exists
        const existing = await Service.findAll({ where: { name: serviceData.name } });
        if (existing.length > 0) {
          console.log(`- Service ${serviceData.name} already exists, skipping...`);
          continue;
        }

        const service = await Service.create(serviceData);
        console.log(`✓ Created service: ${service.name} (${service.docker_image})`);
      } catch (error) {
        if (error.message.includes('already exists') || error.message.includes('UNIQUE constraint')) {
          console.log(`- Service ${serviceData.name} already exists, skipping...`);
        } else {
          throw error;
        }
      }
    }

    console.log('Service seeding completed!');
    
    // Only exit if called directly (not when imported)
    if (require.main === module) {
      process.exit(0);
    }
  } catch (error) {
    console.error('Error seeding services:', error);
    // Only exit if called directly (not when imported)
    if (require.main === module) {
      process.exit(1);
    } else {
      throw error; // Re-throw if called from another module
    }
  }
}

// Run if called directly
if (require.main === module) {
  seedServices();
}

/**
 * Add any new default service rows that older DBs may be missing (idempotent).
 */
async function ensureMissingDefaultServices() {
  await initializeDatabase();
  const servicesToSeed = [
    {
      name: 'compute_manager',
      docker_image: 'aerekos-compute_manager:latest',
      enabled: 0,
      config: JSON.stringify({ ports: { '3100': '3100' } })
    },
    {
      name: 'key_manager',
      docker_image: 'aerekos-key_manager:latest',
      enabled: 0,
      config: JSON.stringify({ ports: { '3102': '3102' } })
    },
    {
      name: 'storage_manager',
      docker_image: 'aerekos-storage_manager:latest',
      enabled: 0,
      config: JSON.stringify({ ports: { '3003': '3003' } })
    },
    {
      name: 'db_manager',
      docker_image: 'aerekos-db_manager:latest',
      enabled: 0,
      config: JSON.stringify({ ports: { '3004': '3004' } })
    },
    {
      name: 'queue_manager',
      docker_image: 'aerekos-queue_manager:latest',
      enabled: 0,
      config: JSON.stringify({ ports: { '3101': '3101' } })
    },
    {
      name: 'schedule_manager',
      docker_image: 'aerekos-schedule_manager:latest',
      enabled: 0,
      config: JSON.stringify({ ports: { '3102': '3102' } })
    },
    {
      name: 'network_manager',
      docker_image: 'aerekos-network_manager:latest',
      enabled: 0,
      config: JSON.stringify({ ports: { '3103': '3103' } })
    },
    {
      name: 'tunnel_manager',
      docker_image: 'aerekos-tunnel_manager:latest',
      enabled: 0,
      config: JSON.stringify({ ports: { '3110': '3110' } })
    },
    {
      name: 'domain_manager',
      docker_image: 'aerekos-domain_manager:latest',
      enabled: 0,
      config: JSON.stringify({ ports: { '3111': '3111' } })
    },
    {
      name: 'iam_manager',
      docker_image: 'aerekos-iam_manager:latest',
      enabled: 0,
      config: JSON.stringify({ ports: { '3106': '3106' } })
    },
    {
      name: 'logs_manager',
      docker_image: 'aerekos-logs_manager:latest',
      enabled: 0,
      config: JSON.stringify({ ports: { '3104': '3104' } })
    },
    {
      name: 'secrets_manager',
      docker_image: 'aerekos-secrets_manager:latest',
      enabled: 0,
      config: JSON.stringify({ ports: { '3107': '3107' } })
    },
    {
      name: 'registry_manager',
      docker_image: 'aerekos-registry_manager:latest',
      enabled: 0,
      config: JSON.stringify({ ports: { '3129': '3129' } })
    },
    { name: 'metrics_manager', docker_image: 'aerekos-metrics_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3105': '3105' } }) },
    { name: 'security_manager', docker_image: 'aerekos-security_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3108': '3108' } }) },
    { name: 'balancer_manager', docker_image: 'aerekos-balancer_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3109': '3109' } }) },
    { name: 'webhook_manager', docker_image: 'aerekos-webhook_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3112': '3112' } }) },
    { name: 'email_manager', docker_image: 'aerekos-email_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3113': '3113' } }) },
    { name: 'sms_manager', docker_image: 'aerekos-sms_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3114': '3114' } }) },
    { name: 'slack_manager', docker_image: 'aerekos-slack_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3115': '3115' } }) },
    { name: 'auth_manager', docker_image: 'aerekos-auth_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3116': '3116' } }) },
    { name: 'analytics_manager', docker_image: 'aerekos-analytics_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3117': '3117' } }) },
    { name: 'cdn_manager', docker_image: 'aerekos-cdn_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3118': '3118' } }) },
    { name: 'cicd_manager', docker_image: 'aerekos-cicd_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3119': '3119' } }) },
    { name: 'code_as_infra', docker_image: 'aerekos-code_as_infra:latest', enabled: 0, config: JSON.stringify({ ports: { '3120': '3120' } }) },
    { name: 'crawler_manager', docker_image: 'aerekos-crawler_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3121': '3121' } }) },
    { name: 'host_manager', docker_image: 'aerekos-host_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3122': '3122' } }) },
    { name: 'mcp_manager', docker_image: 'aerekos-mcp_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3123': '3123' } }) },
    { name: 'api_manager', docker_image: 'aerekos-api_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3124': '3124' } }) },
    { name: 'app_manager', docker_image: 'aerekos-app_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3125': '3125' } }) },
    { name: 'ai_manager', docker_image: 'aerekos-ai_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3126': '3126' } }) },
    { name: 'system_manager', docker_image: 'aerekos-system_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3127': '3127' } }) },
    { name: 'worker_manager', docker_image: 'aerekos-worker_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3128': '3128' } }) },
    { name: 'git_manager', docker_image: 'aerekos-git_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3130': '3130' } }) },
    { name: 'websocket_manager', docker_image: 'aerekos-websocket_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3131': '3131' } }) },
    { name: 'event_manager', docker_image: 'aerekos-event_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3132': '3132' } }) },
    { name: 'download_manager', docker_image: 'aerekos-download_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3133': '3133' } }) },
    { name: 'backup_manager', docker_image: 'aerekos-backup_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3134': '3134' } }) },
    { name: 'workflow_manager', docker_image: 'aerekos-workflow_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3135': '3135' } }) },
    { name: 'config_manager', docker_image: 'aerekos-config_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3136': '3136' } }) },
    { name: 'cert_manager', docker_image: 'aerekos-cert_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3137': '3137' } }) },
    { name: 'billing_manager', docker_image: 'aerekos-billing_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3138': '3138' } }) },
    { name: 'function_manager', docker_image: 'aerekos-function_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3139': '3139' } }) },
    { name: 'iot_manager', docker_image: 'aerekos-iot_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3140': '3140' } }) },
    { name: 'graphql_manager', docker_image: 'aerekos-graphql_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3141': '3141' } }) },
    { name: 'notebook_manager', docker_image: 'aerekos-notebook_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3142': '3142' } }) },
    { name: 'trace_manager', docker_image: 'aerekos-trace_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3143': '3143' } }) },
    { name: 'search_manager', docker_image: 'aerekos-search_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3144': '3144' } }) },
    { name: 'query_manager', docker_image: 'aerekos-query_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3145': '3145' } }) },
    { name: 'waf_manager', docker_image: 'aerekos-waf_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3146': '3146' } }) },
    { name: 'vpn_manager', docker_image: 'aerekos-vpn_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3147': '3147' } }) },
    { name: 'transfer_manager', docker_image: 'aerekos-transfer_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3148': '3148' } }) },
    { name: 'audit_manager', docker_image: 'aerekos-audit_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3149': '3149' } }) },
    { name: 'status_manager', docker_image: 'aerekos-status_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3150': '3150' } }) },
    { name: 'cluster_manager', docker_image: 'aerekos-cluster_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3151': '3151' } }) },
    { name: 'vector_manager', docker_image: 'aerekos-vector_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3152': '3152' } }) },
    { name: 'push_manager', docker_image: 'aerekos-push_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3153': '3153' } }) },
    { name: 'notify_manager', docker_image: 'aerekos-notify_manager:latest', enabled: 0, config: JSON.stringify({ ports: { '3154': '3154' } }) }
  ];
  for (const serviceData of servicesToSeed) {
    const existing = await Service.findAll({ where: { name: serviceData.name } });
    if (existing.length > 0) {
      continue;
    }
    await Service.create(serviceData);
    console.log(`✓ Ensured service record: ${serviceData.name} (${serviceData.docker_image})`);
  }
}

module.exports = { seedServices, ensureMissingDefaultServices };
