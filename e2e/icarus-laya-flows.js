#!/usr/bin/env node
/**
 * Live e2e: Laya predict + guided flow intake (non-prod).
 * Requires CONDUCTOR_URL + auth like other icarus e2e.
 */
const base = process.env.CONDUCTOR_URL || process.env.CONDUCTOR || '';
const pid = process.env.PROJECT_ID || '';
const token =
  process.env.AEREKOS_C0_ADMIN_TOKEN ||
  process.env.AEREKOS_TOKEN ||
  process.env.TOKEN ||
  '';

async function main() {
  if (!base || !pid) {
    console.log('SKIP icarus-laya-flows: set CONDUCTOR_URL and PROJECT_ID');
    process.exit(0);
  }
  const headers = {
    'Content-Type': 'application/json',
    Authorization: token ? `Bearer ${token}` : '',
    'x-project-id': pid,
  };
  const root = `${base.replace(/\/$/, '')}/api/services/ai_manager/api/v1/icarus`;

  const packs = await fetch(`${root}/laya/packs?project_id=${pid}`, { headers }).then((r) => r.json());
  if (!packs.packs?.lane) throw new Error('laya packs missing');

  const pred = await fetch(`${root}/laya/predict?project_id=${pid}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      project_id: pid,
      state: { text: 'create a new app with models' },
      questions: { flow_pick: {}, lane: {} },
    }),
  }).then((r) => r.json());
  if (!pred.answers?.flow_pick?.choice) throw new Error('flow_pick empty');

  const svc = await fetch(`${root}/project-services?project_id=${pid}`, { headers }).then((r) => r.json());
  if (!svc.project_id && svc.ok === false && !svc.nodes) {
    console.warn('project-services soft-fail', svc.error || svc);
  }

  console.log('OK icarus-laya-flows', {
    flow: pred.answers.flow_pick.choice,
    source: pred.source,
    nodes: (svc.nodes || []).length,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
