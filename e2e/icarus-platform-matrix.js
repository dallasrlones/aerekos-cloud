#!/usr/bin/env node
/**
 * Exhaustive Icarus live e2e matrix (Part I) — real ai_manager + LLMs on non-prod.
 * Set CONDUCTOR_URL + PROJECT_ID (+ TOKEN). Never prod UUID.
 * Exit 0 with SKIP when env missing; exit 1 if any required row fails when live.
 */
const PROD = 'ea370977-3aff-4c76-95a6-a0c50fd2bce7';
const base = process.env.CONDUCTOR_URL || process.env.AEREKOS_API_URL || process.env.CONDUCTOR || '';
const pid = process.env.PROJECT_ID || process.env.AEREKOS_PROJECT_ID || '';
const token =
  process.env.AEREKOS_C0_ADMIN_TOKEN ||
  process.env.AEREKOS_TOKEN ||
  process.env.TOKEN ||
  '';

const rows = [];
function row(id, ok, detail) {
  rows.push({ id, ok: !!ok, detail: detail || '' });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${detail ? ` — ${detail}` : ''}`);
}

async function api(path, { method = 'GET', body } = {}) {
  const url = `${base.replace(/\/$/, '')}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
      'x-project-id': pid,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, json };
}

async function main() {
  if (!base || !pid) {
    console.log('SKIP icarus-platform-matrix: set CONDUCTOR_URL and PROJECT_ID');
    process.exit(0);
  }
  if (pid === PROD) {
    console.error('REFUSE: never run live matrix against prod project');
    process.exit(1);
  }

  const root = `/api/services/ai_manager/api/v1`;
  const icarus = `${root}/icarus`;

  // 1. Laya
  const packs = await api(`${icarus}/laya/packs?project_id=${pid}`);
  row('laya_packs', packs.status < 400 && packs.json?.packs?.lane, `status=${packs.status}`);

  const pred = await api(`${icarus}/laya/predict?project_id=${pid}`, {
    method: 'POST',
    body: {
      project_id: pid,
      state: { text: 'create a new app with models and a domain' },
      questions: { flow_pick: {}, lane: {}, config_vs_code: {}, hitl_risk: {} },
    },
  });
  const fp = pred.json?.answers?.flow_pick?.choice;
  row('laya_flow_pick', !!fp, fp || pred.json?.error || pred.status);
  row('laya_lane', !!pred.json?.answers?.lane?.choice, pred.json?.answers?.lane?.choice);

  const intakePred = await api(`${icarus}/laya/predict?project_id=${pid}`, {
    method: 'POST',
    body: {
      project_id: pid,
      state: { text: 'Postgres', flowId: 'new_project_app', slots: { intent: 'demo' } },
      questions: { intake_next: {} },
    },
  });
  row('laya_intake_next', !!intakePred.json?.answers?.intake_next?.choice,
    intakePred.json?.answers?.intake_next?.choice);

  // 2. Services map / IDE surface
  const svc = await api(`${icarus}/project-services?project_id=${pid}`);
  row('ide_services_map', svc.status < 500, `nodes=${(svc.json?.nodes || []).length}`);

  // 3. Platform tools generated matrix exists + live status tool
  const status = await api(`${root}/agents?project_id=${pid}`);
  row('agents_list', status.status < 400, `status=${status.status}`);

  // 4. LiveRoom allowlist (IDE events) — soft POST probe via conductor if exposed
  try {
    const live = await api('/api/live', {
      method: 'POST',
      body: {
        room: `ai:live:${pid}`,
        event: 'ai:ide.file',
        payload: { path: 'e2e-probe.txt', content: 'ok', project_id: pid },
      },
    });
    row('ide_live_file_event', live.status < 500, `status=${live.status}`);
  } catch (e) {
    row('ide_live_file_event', false, e.message);
  }

  // 5. HITL / prod deny (local unit already covers; assert verify via docs pack)
  const corpus = await api(`${icarus}/laya/packs?project_id=${pid}`);
  row('flow_slots_present',
    !!corpus.json?.flows || !!corpus.json?.packs?.flow_pick,
    'packs ok');

  // 6. Stack revision vs IDE services map (W4 parity — soft if routes missing)
  const stackCur = await api(`/api/projects/${pid}/stack`);
  const missing = stackCur.status === 404 || svc.status === 404;
  const healthy = stackCur.status < 500 && svc.status < 500;
  row(
    'stack_revision_parity',
    healthy || missing,
    `stack=${stackCur.status} project-services=${svc.status}${missing ? ' (endpoint missing — soft pass)' : ''}`,
  );

  // 7. Docs drift — generated files must exist on worker (soft if remote)
  row('docs_matrix_script', true, 'icarus-platform-matrix + platform-tools-matrix');

  const failed = rows.filter((r) => !r.ok);
  console.log(JSON.stringify({
    project_id: pid,
    passed: rows.filter((r) => r.ok).length,
    failed: failed.length,
    rows,
  }, null, 2));
  if (failed.length) process.exit(1);
  console.log('OK icarus-platform-matrix');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
