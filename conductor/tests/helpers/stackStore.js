/**
 * Deterministic in-memory stand-in for the conductor's stack revision
 * store (ProjectStack rows behind StackService). Lets tests drive
 * StackService.current / put / provision without touching the DB or the
 * workers, while still asserting on revisions, baked-in placements and
 * status transitions.
 *
 *   stack = makeStackStore();
 *   mockStackService(stack);         // in beforeEach
 *
 *   stack.put(projectId, content, { commit: true });
 *   stack.current(projectId);        // { stack, revision, status }
 *   stack.revisions(projectId);      // all revisions, oldest first
 *
 *   restoreStackService();           // in afterEach (or jest.restoreAllMocks())
 */
const StackService = require('../../api/services/StackService');
const { requireShared } = require('../../api/utils/loadWorkerShared');
const { emptyStack } = requireShared('clickOpsCatalog');

function makeStackStore() {
  const byProject = new Map();
  return {
    /** Drop every stored revision (call in beforeEach). */
    reset: () => byProject.clear(),
    /** Record a new revision; returns { stack, revision, status }. */
    put(projectId, content, { commit = false } = {}) {
      const rows = byProject.get(projectId) || [];
      const revision = (rows.length ? Math.max(...rows.map((r) => r.revision)) : 0) + 1;
      const status = commit ? 'applied' : 'draft';
      rows.push({ revision, stack: JSON.parse(JSON.stringify(content)), status });
      byProject.set(projectId, rows);
      return { stack: content, revision, status };
    },
    /** Latest revision, or an empty stack at revision 0. */
    current(projectId) {
      const rows = byProject.get(projectId) || [];
      if (!rows.length) return { stack: emptyStack(projectId), revision: 0, status: 'none' };
      const latest = rows.slice().sort((a, b) => b.revision - a.revision)[0];
      return { stack: JSON.parse(JSON.stringify(latest.stack)), revision: latest.revision, status: latest.status };
    },
    /** All revisions for a project, oldest first. */
    revisions(projectId) {
      return (byProject.get(projectId) || []).slice().sort((a, b) => a.revision - b.revision);
    },
  };
}

let activeSpies = [];

/** Point StackService.current/put/provision at the store. */
function mockStackService(store) {
  restoreStackService();
  activeSpies = [
    jest.spyOn(StackService, 'current').mockImplementation((projectId) =>
      Promise.resolve(store.current(projectId))),
    jest.spyOn(StackService, 'put').mockImplementation((projectId, content, opts = {}) =>
      Promise.resolve(store.put(projectId, content, opts))),
    jest.spyOn(StackService, 'provision').mockImplementation(async (projectId, content) =>
      ({ provisioned: 0, content })),
  ];
  return StackService;
}

function restoreStackService() {
  for (const spy of activeSpies) spy.mockRestore();
  activeSpies = [];
}

module.exports = { makeStackStore, mockStackService, restoreStackService };
