#!/usr/bin/env node
'use strict';

/**
 * aerekos — CLI for the aerekos-cloud control plane, built on aerekos-sdk.
 *
 * Auth/config is stored at ~/.aerekos/config.json (override with AEREKOS_CONFIG).
 * Every command accepts global flags: --url, --token, --json.
 *
 * Examples:
 *   aerekos login --url http://localhost:3000 -u admin -p admin
 *   aerekos services
 *   aerekos managers
 *   aerekos git_manager repos create --project demo --data '{"name":"hello"}'
 *   aerekos metrics_manager series list --project demo
 *   aerekos call key_manager POST /api/keys --project demo --data '{"name":"k","type":"symmetric"}'
 *   aerekos info git_manager --project demo
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const { AerekosClient, AerekosError, MANAGERS } = require('../index.js');

const CONFIG_PATH =
  process.env.AEREKOS_CONFIG || path.join(os.homedir(), '.aerekos', 'config.json');

// --- tiny arg parser --------------------------------------------------------
function parseArgs(argv) {
  const positionals = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('-')) flags[key] = true;
      else { flags[key] = next; i++; }
    } else if (a.startsWith('-') && a.length > 1) {
      const key = a.slice(1);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('-')) flags[key] = true;
      else { flags[key] = next; i++; }
    } else {
      positionals.push(a);
    }
  }
  return { positionals, flags };
}

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}
function saveConfig(cfg) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
  try { fs.chmodSync(CONFIG_PATH, 0o600); } catch { /* best effort */ }
}

const C = { reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', dim: '\x1b[2m', bold: '\x1b[1m' };
function out(data, asJson) {
  if (asJson || typeof data !== 'object') return console.log(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  console.log(JSON.stringify(data, null, 2));
}
function die(msg, code = 1) { console.error(`${C.red}error:${C.reset} ${msg}`); process.exit(code); }

function makeClient(flags) {
  const cfg = loadConfig();
  const baseUrl = flags.url || process.env.AEREKOS_URL || cfg.baseUrl;
  const token = flags.token || process.env.AEREKOS_TOKEN || cfg.token || null;
  if (!baseUrl) die('no conductor URL. Run: aerekos login --url <url> -u <user> -p <pass> (or pass --url)');
  return new AerekosClient({ baseUrl, token });
}

function projectOf(flags) {
  return flags.project || flags.P || process.env.AEREKOS_PROJECT;
}
function dataOf(flags) {
  const d = flags.data !== undefined ? flags.data : flags.d;
  if (d === undefined) return undefined;
  if (typeof d !== 'string') die('--data expects a JSON string');
  try { return JSON.parse(d); } catch (e) { die(`--data is not valid JSON: ${e.message}`); }
}

const HELP = `${C.bold}aerekos${C.reset} — CLI for your private AWS (aerekos-cloud)

${C.bold}Usage${C.reset}
  aerekos <command> [args] [flags]

${C.bold}Auth${C.reset}
  login --url <url> -u <user> -p <pass>   Log in and save a token
  logout                                  Forget the saved token
  whoami                                  Show the current identity
  config                                  Show saved config (token masked)

${C.bold}Discover${C.reset}
  services                                List registered manager services
  workers                                 List workers in the fleet
  managers                                List the service catalog (name/AWS/port/status)
  info <service>                          A service's /info
  metrics <service>                       A service's Prometheus metrics

${C.bold}Operate${C.reset}
  backup run|jobs|get|restore [--project P] [--data JSON]
  iac status|hookup|export|apply|down [--project P] [--data JSON] [--hard] [--any-device] [--no-commit]
  iac system | iac import --name N --data '<infra file JSON>' [--any-device]
  edge status|hookup [--project P]
  setup <service>|graph|status [--project P]
  vpc status|move --worker <id> --vpc <id>
  systems check|update --worker <id> [--target os|docker]
  graphql execute [--project P] --data '{"query":"{ users { id } }"}'
  search query [--project P] --data '{"q":"hello"}'
  intelligence submit|job|wait|cancel [--project P]
  agents setup|list|chat|interrupt|approve|asks|timeline|fleet|prompts [--project P] [--id NAME]
  connectors kinds|list|invoke [--project P]
  <service> <segment> <list|get|create|update|delete> [id] [--project P] [--data JSON]
  call <service> <METHOD> <path> [--project P] [--data JSON]   Generic proxy

${C.bold}Global flags${C.reset}
  --url <url>     Conductor URL (overrides config)
  --token <jwt>   Auth token (overrides config)
  --project, -P   Project id   --data, -d   JSON body   --json   raw JSON output

${C.bold}Examples${C.reset}
  aerekos login --url http://localhost:3000 -u admin -p admin
  aerekos managers
  aerekos git_manager repos create -P demo -d '{"name":"hello"}'
  aerekos metrics_manager series list -P demo
  aerekos call key_manager POST /api/keys -P demo -d '{"name":"k","type":"symmetric"}'
`;

function printTable(rows, cols) {
  const widths = cols.map((c) => Math.max(c.label.length, ...rows.map((r) => String(r[c.key] ?? '').length)));
  const fmt = (vals) => vals.map((v, i) => String(v).padEnd(widths[i])).join('  ');
  console.log(C.bold + fmt(cols.map((c) => c.label)) + C.reset);
  for (const r of rows) console.log(fmt(cols.map((c) => r[c.key] ?? '')));
}

async function main() {
  const { positionals, flags } = parseArgs(process.argv.slice(2));
  const asJson = !!flags.json;
  const cmd = positionals[0];

  if (!cmd || flags.help || flags.h || cmd === 'help') { console.log(HELP); return; }

  // --- auth/config ----------------------------------------------------------
  if (cmd === 'login') {
    const url = flags.url || process.env.AEREKOS_URL;
    const user = flags.user || flags.u;
    const pass = flags.pass || flags.p;
    if (!url) die('login needs --url');
    if (!user || !pass) die('login needs -u <user> and -p <pass>');
    const client = new AerekosClient({ baseUrl: url });
    const res = await client.auth.login(String(user), String(pass));
    if (!res || !res.token) die('login failed: no token returned');
    const cfg = loadConfig();
    saveConfig({ ...cfg, baseUrl: url, token: res.token });
    console.log(`${C.green}logged in${C.reset} to ${url} (token saved to ${CONFIG_PATH})`);
    return;
  }
  if (cmd === 'logout') {
    const cfg = loadConfig(); delete cfg.token; saveConfig(cfg);
    console.log('token cleared'); return;
  }
  if (cmd === 'config') {
    const cfg = loadConfig();
    out({ ...cfg, token: cfg.token ? `${String(cfg.token).slice(0, 8)}…` : null, configPath: CONFIG_PATH }, asJson);
    return;
  }
  if (cmd === 'managers') {
    const rows = MANAGERS.map((m) => ({ name: m.name, aws: m.aws, port: m.port, status: m.status }));
    if (asJson) return out(rows, true);
    printTable(rows, [{ key: 'name', label: 'SERVICE' }, { key: 'aws', label: 'AWS ANALOG' }, { key: 'port', label: 'PORT' }, { key: 'status', label: 'STATUS' }]);
    return;
  }

  const client = makeClient(flags);

  if (cmd === 'whoami') return out(await client.auth.me(), asJson);
  if (cmd === 'services') {
    const r = await client.services.list();
    const list = r.services || r || [];
    if (asJson) return out(list, true);
    printTable(list.map((s) => ({ name: s.name, enabled: s.enabled ? 'yes' : 'no', image: s.docker_image || '' })),
      [{ key: 'name', label: 'SERVICE' }, { key: 'enabled', label: 'ENABLED' }, { key: 'image', label: 'IMAGE' }]);
    return;
  }
  if (cmd === 'workers') {
    const r = await client.workers.list();
    const list = r.workers || r || [];
    if (asJson) return out(list, true);
    printTable(list.map((w) => ({ id: w.id || w.worker_id, host: w.hostname || '', status: w.status || '' })),
      [{ key: 'id', label: 'ID' }, { key: 'host', label: 'HOST' }, { key: 'status', label: 'STATUS' }]);
    return;
  }
  if (cmd === 'info') {
    const svc = positionals[1]; if (!svc) die('info needs a <service>');
    return out(await client.manager(svc).info(projectOf(flags)), asJson);
  }
  if (cmd === 'metrics') {
    const svc = positionals[1]; if (!svc) die('metrics needs a <service>');
    return out(await client.manager(svc).metrics(projectOf(flags)), true);
  }
  if (cmd === 'call') {
    const [, svc, method, p] = positionals;
    if (!svc || !method || !p) die('usage: aerekos call <service> <METHOD> <path> [-P project] [-d JSON]');
    const res = await client.proxy(svc, { method: method.toUpperCase(), path: p, projectId: projectOf(flags), body: dataOf(flags) });
    return out(res, asJson);
  }

  if (cmd === 'backup') {
    const project = projectOf(flags); if (!project) die('needs --project');
    const act = positionals[1];
    if (act === 'run') return out(await client.backup.run(project, dataOf(flags) || {}), asJson);
    if (act === 'jobs') return out(await client.backup.jobs(project), asJson);
    if (act === 'get') return out(await client.backup.get(project, positionals[2]), asJson);
    if (act === 'restore') return out(await client.backup.restore(project, positionals[2], flags.dest), asJson);
    die('usage: aerekos backup run|jobs|get|restore');
  }
  if (cmd === 'iac') {
    const act = positionals[1];
    if (act === 'system') return out(await client.iac.system(), asJson);
    if (act === 'import') {
      const name = flags.name;
      if (!name) die('import needs --name <project name> and --data <infra file JSON>');
      return out(await client.iac.import({
        name,
        description: flags.description || '',
        file: dataOf(flags) || {},
        any_device: !!flags['any-device'],
      }), asJson);
    }
    const project = projectOf(flags); if (!project) die('needs --project');
    if (act === 'status') return out(await client.iac.status(project), asJson);
    if (act === 'hookup') return out(await client.iac.hookup(project, dataOf(flags) || { mode: 'conductor' }), asJson);
    if (act === 'export') return out(await client.iac.export(project, { commit: !flags['no-commit'] }), asJson);
    if (act === 'apply') return out(await client.iac.applyFile(project, { file: dataOf(flags) || undefined, any_device: !!flags['any-device'] }), asJson);
    if (act === 'down') return out(await client.iac.down(project, { hard: !!flags.hard }), asJson);
    if (act === 'current') return out(await client.iac.current(project), asJson);
    if (act === 'save') return out(await client.iac.saveFile(project, dataOf(flags) || {}), asJson);
    if (act === 'revisions') return out(await client.iac.revisions(project), asJson);
    if (act === 'rollback') return out(await client.iac.rollback(project, { revision: flags.revision }), asJson);
    if (act === 'put') return out(await client.iac.put(project, dataOf(flags) || {}), asJson);
    die('usage: aerekos iac status|hookup|export|apply|down|current|save|revisions|rollback|system|import [--project P] [--data JSON] [--hard] [--any-device] [--no-commit] [--revision N] [--name N]');
  }
  if (cmd === 'setup') {
    const act = positionals[1];
    if (act === 'graph') return out(await client.setup.graph(), asJson);
    if (act === 'status') {
      const project = projectOf(flags); if (!project) die('needs --project');
      return out(await client.setup.status(project), asJson);
    }
    if (!act) die('usage: aerekos setup <service>|graph|status --project P');
    const project = projectOf(flags); if (!project) die('needs --project');
    return out(await client.setup.enable(project, act), asJson);
  }
  if (cmd === 'vpc') {
    const act = positionals[1] || 'status';
    if (act === 'status' || act === 'list') return out(await client.vpc.status(), asJson);
    if (act === 'move') {
      const worker = flags.worker || positionals[2];
      const vpc = flags.vpc || flags['vpc-id'] || positionals[3];
      if (!worker || !vpc) die('usage: aerekos vpc move --worker <id> --vpc <id>');
      return out(await client.vpc.move(worker, vpc), asJson);
    }
    die('usage: aerekos vpc status|move');
  }
  if (cmd === 'edge') {
    const project = projectOf(flags); if (!project) die('needs --project');
    const act = positionals[1];
    if (act === 'status') return out(await client.edge.status(project), asJson);
    if (act === 'hookup') return out(await client.edge.hookup(project), asJson);
    die('usage: aerekos edge status|hookup');
  }
  if (cmd === 'systems') {
    const worker = flags.worker || positionals[2];
    if (!worker) die('needs --worker <id>');
    const act = positionals[1];
    if (act === 'check') return out(await client.systems.check(worker), asJson);
    if (act === 'update') return out(await client.systems.update(worker, { target: flags.target || 'os' }), asJson);
    die('usage: aerekos systems check|update --worker <id> [--target os|docker]');
  }
  if (cmd === 'graphql') {
    const project = projectOf(flags); if (!project) die('needs --project');
    return out(await client.graphql.execute(project, dataOf(flags) || {}), asJson);
  }
  if (cmd === 'intelligence') {
    const project = projectOf(flags); if (!project) die('needs --project');
    const act = positionals[1];
    if (act === 'submit') return out(await client.intelligence.submit(project, dataOf(flags) || {}), asJson);
    if (act === 'job') return out(await client.intelligence.job(project, positionals[2]), asJson);
    if (act === 'wait') return out(await client.intelligence.wait(project, positionals[2], { intervalMs: Number(flags.interval) || 2000 }), asJson);
    if (act === 'cancel') return out(await client.intelligence.cancel(project, positionals[2]), asJson);
    die('usage: aerekos intelligence submit|job|wait|cancel --project P [--data JSON]');
  }
  if (cmd === 'agents') {
    const project = projectOf(flags); if (!project) die('needs --project');
    const act = positionals[1];
    const id = flags.id || positionals[2];
    if (act === 'setup') return out(await client.agents.setup(project, dataOf(flags) || {}), asJson);
    if (act === 'status') return out(await client.agents.setupStatus(project), asJson);
    if (act === 'list') return out(await client.agents.list(project), asJson);
    if (act === 'fleet') return out(await client.agents.fleet(project), asJson);
    if (act === 'settings') return out(await client.agents.settings(project), asJson);
    if (act === 'get') {
      if (!id) die('agents get needs --id');
      return out(await client.agents.get(project, id), asJson);
    }
    if (act === 'chat') {
      if (!id) die('agents chat needs --id');
      return out(await client.agents.chat(project, id, dataOf(flags) || {}), asJson);
    }
    if (act === 'interrupt') {
      if (!id) die('agents interrupt needs --id');
      return out(await client.agents.interrupt(project, id, dataOf(flags) || { content: 'stop' }), asJson);
    }
    if (act === 'approve') {
      if (!id) die('agents approve needs --id');
      return out(await client.agents.approve(project, id, dataOf(flags) || {}), asJson);
    }
    if (act === 'asks') {
      if (!id) die('agents asks needs --id');
      return out(await client.agents.asks(project, id), asJson);
    }
    if (act === 'timeline') {
      if (!id) die('agents timeline needs --id');
      return out(await client.agents.timeline(project, id, flags.since), asJson);
    }
    if (act === 'prompts') {
      if (!id) die('agents prompts needs --id');
      if (flags.reset) return out(await client.agents.resetPrompts(project, id), asJson);
      const data = dataOf(flags);
      if (data) return out(await client.agents.patchPrompts(project, id, data), asJson);
      return out(await client.agents.prompts(project, id), asJson);
    }
    if (act === 'work') {
      const sub = positionals[2];
      const agentId = flags.id || positionals[3];
      if (sub === 'reorder') {
        if (!agentId) die('agents work reorder needs --id');
        const data = dataOf(flags) || {};
        return out(await client.agents.reorderWork(project, agentId, data.ids || []), asJson);
      }
      die('usage: aerekos agents work reorder --id AGENT --data \'{"ids":[]}\'');
    }
    if (act === 'plans') {
      if (!id) die('agents plans needs --id');
      return out(await client.agents.plans(project, id), asJson);
    }
    if (act === 'compact') {
      if (!id) die('agents compact needs --id');
      return out(await client.agents.compact(project, id), asJson);
    }
    die('usage: aerekos agents setup|status|list|fleet|get|chat|interrupt|approve|asks|timeline|prompts|work|plans|compact --project P [--id NAME] [--data JSON]');
  }
  if (cmd === 'connectors') {
    const project = projectOf(flags);
    const act = positionals[1];
    if (act === 'kinds') return out(await client.connectors.kinds(), asJson);
    if (!project) die('needs --project');
    if (act === 'list') return out(await client.connectors.list(project), asJson);
    if (act === 'invoke') return out(await client.connectors.invoke(project, dataOf(flags) || {}), asJson);
    if (act === 'create') return out(await client.connectors.create(project, dataOf(flags) || {}), asJson);
    die('usage: aerekos connectors kinds|list|create|invoke --project P [--data JSON]');
  }
  if (cmd === 'search' && positionals[1] === 'query') {
    const project = projectOf(flags); if (!project) die('needs --project');
    return out(await client.search.query(project, dataOf(flags) || {}), asJson);
  }

  // --- generic manager CRUD: <service> <segment> <action> [id] -------------
  const known = MANAGERS.find((m) => m.name === cmd);
  if (known) {
    const segment = positionals[1];
    const action = positionals[2];
    const id = positionals[3];
    const project = projectOf(flags);
    if (!segment || !action) die(`usage: aerekos ${cmd} <segment> <list|get|create|update|delete> [id] [-P project] [-d JSON]`);
    if (!project) die('this command needs --project / -P');
    const r = client.resource(cmd, segment);
    let res;
    switch (action) {
      case 'list': res = await r.list(project); break;
      case 'get': if (!id) die('get needs an <id>'); res = await r.get(project, id); break;
      case 'create': res = await r.create(project, dataOf(flags) || {}); break;
      case 'update': if (!id) die('update needs an <id>'); res = await r.update(project, id, dataOf(flags) || {}); break;
      case 'delete': if (!id) die('delete needs an <id>'); res = await r.remove(project, id); break;
      default: die(`unknown action "${action}" (use list|get|create|update|delete)`);
    }
    return out(res, asJson);
  }

  die(`unknown command "${cmd}". Run: aerekos help`);
}

main().catch((e) => {
  if (e instanceof AerekosError) die(`${e.message}${e.status ? ` (HTTP ${e.status})` : ''}`);
  die(e.stack || e.message);
});
