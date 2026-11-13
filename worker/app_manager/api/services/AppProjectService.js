const { AppProject } = require('../models');
class AppProjectService {
  constructor() { this.M = AppProject; }
  assertP(p) { if (!p||!String(p).trim()){const e=new Error('project_id required');e.status=400;throw e;} }
  async create(body) {
    this.assertP(body.project_id);
    const name = String(body.name||'').trim();
    if (!name) { const e = new Error('name required'); e.status=400; throw e; }
    const d = await this.M.findAll({ where: { project_id: body.project_id, name } });
    if (d.length) { const e = new Error('name taken'); e.status=409; throw e; }
    return this.M.create(body);
  }
  async list(projectId) { this.assertP(projectId); return this.M.findAll({ where: { project_id: projectId } }); }
  async get(id, projectId) { this.assertP(projectId); const r = await this.M.findAll({ where: { id, project_id: projectId } }); if (!r.length){const e=new Error('Not found');e.status=404;throw e;} return r[0]; }
  async update(id, projectId, body) {
    await this.get(id, projectId);
    const patch = { ...(body || {}) };
    delete patch.id; delete patch.project_id; delete patch.created_at; delete patch.updated_at;
    if (patch.name !== undefined) {
      const name = String(patch.name || '').trim();
      if (!name) { const e = new Error('name required'); e.status = 400; throw e; }
      const dup = await this.M.findAll({ where: { project_id: projectId, name } });
      if (dup.some((d) => String(d.id) !== String(id))) { const e = new Error('name taken'); e.status = 409; throw e; }
      patch.name = name;
    }
    if (Object.keys(patch).length) await this.M.update(id, patch);
    return this.get(id, projectId);
  }
  async del(id, projectId) { await this.get(id, projectId); await this.M.delete(id); return { deleted:true, id }; }

  /**
   * FE scaffold metadata — returns files to write via git_manager / Icarus IDE.
   * Full deploy remains compute/cicd; this is the OOTB starter.
   */
  async scaffold(projectId, body = {}) {
    this.assertP(projectId);
    const name = String(body.name || 'app').replace(/\W+/g, '-').slice(0, 40) || 'app';
    const pages = body.pages || ['admin'];
    const files = {
      'README.md': `# ${name}\n\nScaffolded by Icarus / app_manager. Open in Icarus IDE.\n`,
      'package.json': JSON.stringify({
        name, private: true, scripts: { start: 'node server.js', build: 'echo ok' },
      }, null, 2),
      'server.js': `const http=require('http');\nhttp.createServer((q,s)=>{s.end('${name} ok');}).listen(process.env.PORT||3080);\n`,
      'src/Admin.jsx': `export default function Admin(){return <main><h1>${name} admin CRUD</h1><p>Wire to Data API.</p></main>;}\n`,
    };
    if (pages.includes('custom') || body.fe === 'Custom pages') {
      files['src/App.jsx'] = `export default function App(){return <main><h1>${name}</h1></main>;}\n`;
    }
    const app = await this.create({
      project_id: projectId,
      name,
      repo_url: body.repo_url || '',
      build_command: body.build_command || 'npm run build',
      meta: { scaffold: true, pages, files: Object.keys(files) },
    });
    return { item: app, files, open_in_ide: true };
  }
}
module.exports = { AppProjectService };
