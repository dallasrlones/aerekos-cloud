const Docker = require('dockerode');

class DockerNetworkClient {
  constructor(opts = {}) {
    this.docker =
      opts.docker ||
      new Docker({
        socketPath: opts.socketPath || process.env.DOCKER_SOCKET || '/var/run/docker.sock'
      });
  }

  async createBridgeNetwork({ name, labels = {} }) {
    const net = await this.docker.createNetwork({
      Name: name,
      Driver: 'bridge',
      CheckDuplicate: true,
      Labels: {
        'aerekos.managed': 'true',
        ...labels
      }
    });
    const info = await net.inspect();
    return { id: info.Id, name: info.Name };
  }

  async removeNetworkByName(name) {
    try {
      const net = this.docker.getNetwork(name);
      await net.remove();
    } catch (e) {
      if (e.statusCode === 404) {
        return false;
      }
      throw e;
    }
    return true;
  }
}

module.exports = { DockerNetworkClient };
