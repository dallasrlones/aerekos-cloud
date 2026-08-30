import api from '../utils/api';

export const containerService = {
  list(deviceId) {
    return api.get(`/api/workers/${deviceId}/containers`).then((r) => r.data.containers || []);
  },
  start(deviceId, containerId) {
    return api.post(`/api/workers/${deviceId}/containers/${containerId}/start`).then((r) => r.data);
  },
  stop(deviceId, containerId) {
    return api.post(`/api/workers/${deviceId}/containers/${containerId}/stop`).then((r) => r.data);
  },
  logs(deviceId, containerId, tail = 200) {
    return api.get(`/api/workers/${deviceId}/containers/${containerId}/logs`, { params: { tail } }).then((r) => r.data.logs || '');
  },
  exec(deviceId, containerId, cmd) {
    return api.post(`/api/workers/${deviceId}/containers/${containerId}/exec`, { cmd }).then((r) => r.data);
  },
};
