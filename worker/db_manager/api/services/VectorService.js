const Record = require('aerekos-record');
const logger = require('../utils/logger');
const { DEFAULT_TABLE } = require('./databases/lancedb');

const DEFAULT_VECTOR_DIM = 384;

class VectorService {
  constructor(databaseService) {
    this.databaseService = databaseService;
    this._lanceClients = new Map();
  }

  async resolveLanceClient(name, projectId) {
    const cacheKey = `${projectId}:${name}`;
    if (this._lanceClients.has(cacheKey)) {
      return this._lanceClients.get(cacheKey);
    }

    const dbInstance = await this.databaseService.getDatabase(name, projectId);
    if (dbInstance.type !== 'lancedb') {
      throw new Error(`Database '${name}' is not a lancedb instance`);
    }
    const metadata = JSON.parse(dbInstance.metadata || '{}');
    const databasePath = metadata.database;
    if (!databasePath) {
      throw new Error(`LanceDB path missing for '${name}'`);
    }

    const tableName = metadata.defaultTable || DEFAULT_TABLE;
    if (typeof Record.connectLance !== 'function') {
      throw new Error('aerekos-record connectLance is required for lancedb vector APIs');
    }
    const lance = Record.connectLance({
      database: databasePath,
      table: tableName,
      vectorDim: DEFAULT_VECTOR_DIM
    });
    const client = { dbInstance, databasePath, tableName, lance };
    this._lanceClients.set(cacheKey, client);
    return client;
  }

  async upsert(name, projectId, { rows, vector_dim: vectorDim = DEFAULT_VECTOR_DIM, table } = {}) {
    const { lance, tableName } = await this.resolveLanceClient(name, projectId);
    const result = await lance.upsert(rows, {
      table: table || tableName,
      vector_dim: vectorDim
    });
    logger.info(`[VectorService] Upserted ${result.upserted} rows into ${result.table}`);
    return result;
  }

  async search(name, projectId, { vector, top_k: topK = 10, filter, vector_dim: vectorDim = DEFAULT_VECTOR_DIM, table } = {}) {
    const { lance, tableName } = await this.resolveLanceClient(name, projectId);
    const results = await lance.search(vector, {
      table: table || tableName,
      top_k: topK,
      filter,
      vector_dim: vectorDim
    });
    return { results, table: table || tableName };
  }

  async deleteVectors(name, projectId, { ids, filter, table } = {}) {
    const { lance, tableName } = await this.resolveLanceClient(name, projectId);
    const result = await lance.deleteVectors({
      ids,
      filter,
      table: table || tableName
    });
    logger.info(`[VectorService] Deleted vectors from ${result.table} where ${result.where}`);
    return result;
  }
}

module.exports = VectorService;
module.exports.DEFAULT_VECTOR_DIM = DEFAULT_VECTOR_DIM;
