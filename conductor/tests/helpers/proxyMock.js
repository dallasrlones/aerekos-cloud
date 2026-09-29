/**
 * ServiceManager proxy mock for integration tests — the "no real workers"
 * boundary.
 *
 * Installs a jest mock over ServiceManager.getInstance so every service
 * proxy call (proxyServiceRequest / disableService / ...) hits your
 * handlers instead of real workers. All calls are recorded in
 * `proxy.calls` so tests can assert what the conductor asked of the
 * fleet.
 *
 *   proxy = mockServiceProxy([
 *     { service: 'git_manager', method: 'GET', path: '/api/v1/repos',
 *       response: { status: 200, data: { repositories: [] } } },
 *     { service: 'storage_manager', method: 'DELETE',
 *       fn: ({ path }) => ({ status: 200, data: {} }),
 *   ]);
 *   // ... run the test, assert on proxy.calls / proxy.callsTo(...) ...
 *   restoreProxyMock();            // in afterEach (or jest.restoreAllMocks())
 *
 * Route matching — FIRST match wins (order your routes specific→generic):
 *   service / method / path — each optional (wildcard when omitted).
 *   path may be an exact string, a PREFIX string, a RegExp, or (path)=>bool.
 *   `fn` gets the full call ({ service, method, path, body, query,
 *   projectId, headers }) and returns the response; `response` is static.
 *   Unmatched calls default to { status: 200, data: {} }.
 */
const ServiceManager = require('../../api/services/ServiceManager');
const { Service, ProjectService, ServiceDeployment, Worker } = require('../../api/models');
const { isPlatformDeviceService } = require('../../api/config/platformDeviceServices');

let activeSpy = null;

function matches(route, { service, method, path }) {
  if (route.service && route.service !== service) return false;
  if (route.method && String(route.method).toUpperCase() !== String(method).toUpperCase()) return false;
  if (route.path == null) return true;
  if (typeof route.path === 'function') return !!route.path(path);
  if (route.path instanceof RegExp) return route.path.test(path);
  return path === route.path || path.startsWith(route.path);
}

function mockServiceProxy(routes = []) {
  const calls = [];
  const proxy = {
    calls,
    /** Recorded calls filtered by (service, method, pathPrefix) — all optional. */
    callsTo: (service, method, pathPrefix) => calls.filter((c) =>
      c.service === service &&
      (!method || String(c.method).toUpperCase() === String(method).toUpperCase()) &&
      (!pathPrefix || c.path === pathPrefix || c.path.startsWith(pathPrefix))
    ),
    proxyServiceRequest: jest.fn(async (service, method, path, body, query = {}, projectId = null, headers = {}) => {
      calls.push({ service, method, path, body, query, projectId, headers });
      const hit = routes.find((r) => matches(r, { service, method, path }));
      if (hit && typeof hit.fn === 'function') return hit.fn({ service, method, path, body, query, projectId, headers });
      if (hit && hit.response) return hit.response;
      return { status: 200, data: {} };
    }),
    disableService: jest.fn(async (name, projectId) => ({ disabled: true, name, projectId })),
    /**
     * Mirrors the real ServiceManager.enableService DB side effects (the
     * network/worker part is what this mock stands in for):
     *   - ensures the service exists and is enabled
     *   - attaches it to the project (ProjectService row)
     *   - platform services attach to an existing live shared deployment
     *     (no new deployment row)
     *   - anything else gets a ServiceDeployment row on the pinned worker
     *     (or the first online worker)
     */
    enableService: jest.fn(async (serviceName, workerId = null, projectId = null) =>
      proxy.mockEnableService(serviceName, workerId, projectId)),
    mockEnableService: async (serviceName, workerId, projectId) => {
      let [service] = await Service.findAll({ where: { name: serviceName } });
      if (!service) {
        service = await Service.create({
          name: serviceName,
          enabled: 1,
          docker_image: `aerekos-${serviceName}:latest`,
          config: '{}',
        });
      } else {
        await Service.update(service.id, { enabled: 1 });
      }
      if (projectId) {
        const existing = await ProjectService.findAll({
          where: { project_id: projectId, service_id: service.id },
        });
        if (existing.length === 0) {
          await ProjectService.create({
            project_id: projectId,
            service_id: service.id,
            enabled: 1,
            config: '{}',
            scaling_policy: '{}',
          });
        } else if (existing[0].enabled !== 1) {
          await ProjectService.update(existing[0].id, { enabled: 1 });
        }
      }
      const existingDeploys = await ServiceDeployment.findAll({ where: { service_id: service.id } });
      const liveShared = existingDeploys.find((d) => d.status === 'deployed' || d.status === 'running');
      const platform = isPlatformDeviceService(serviceName);
      if (platform || liveShared) {
        return {
          success: true,
          attached: true,
          skipped_deploy: true,
          platform,
          service_id: service.id,
          service_name: serviceName,
          project_id: projectId,
          worker_id: (liveShared && liveShared.worker_id) || workerId || null,
        };
      }
      const allWorkers = await Worker.findAll();
      const worker = allWorkers.find((w) => w.id === workerId) || allWorkers.find((w) => w.status === 'online') || null;
      if (worker) {
        await ServiceDeployment.create({
          service_id: service.id,
          worker_id: worker.id,
          project_id: projectId || null,
          status: 'deployed',
          deployed_at: new Date().toISOString(),
          orphaned: 0,
        });
      }
      return {
        success: true,
        attached: true,
        deployed: !!worker,
        service_id: service.id,
        service_name: serviceName,
        project_id: projectId,
        worker_id: worker ? worker.id : null,
      };
    },
  };
  activeSpy = jest.spyOn(ServiceManager, 'getInstance').mockReturnValue(proxy);
  return proxy;
}

function restoreProxyMock() {
  if (activeSpy) {
    activeSpy.mockRestore();
    activeSpy = null;
  }
}

module.exports = { mockServiceProxy, restoreProxyMock };
