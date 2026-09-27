const { getModels } = require('../models');

class BucketRepository {
  async create(bucketData) {
    const { Bucket } = await getModels();
    return await Bucket.create(bucketData);
  }
  
  async findById(id) {
    const { Bucket } = await getModels();
    return await Bucket.find(id);
  }
  
  async findByProjectAndName(projectId, name) {
    const { Bucket } = await getModels();
    const results = await Bucket.findAll({ 
      where: { project_id: projectId, name } 
    });
    return results.length > 0 ? results[0] : null;
  }
  
  async findBySystemAndName(systemId, name) {
    const { Bucket } = await getModels();
    const results = await Bucket.findAll({ 
      where: { system_id: systemId, name } 
    });
    return results.length > 0 ? results[0] : null;
  }
  
  async findBySystem(systemId, filter = {}) {
    const { Bucket } = await getModels();
    return await Bucket.findAll({ 
      where: { system_id: systemId, ...(filter.where || {}) },
      ...filter
    });
  }

  async listSystemIds() {
    const { Bucket } = await getModels();
    const rows = await Bucket.findAll();
    const seen = new Set();
    const out = [];
    for (const r of rows) {
      if (r.system_id && !seen.has(r.system_id)) {
        seen.add(r.system_id);
        out.push(r.system_id);
      }
    }
    return out;
  }
  
  async findByProject(projectId, filter = {}) {
    const { Bucket } = await getModels();
    return await Bucket.findAll({ 
      where: { project_id: projectId, ...filter.where },
      ...filter
    });
  }
  
  async update(id, bucketData) {
    const { Bucket } = await getModels();
    return await Bucket.update(id, bucketData);
  }
  
  async delete(id) {
    const { Bucket } = await getModels();
    return await Bucket.delete(id);
  }
  
  async countFiles(bucketId) {
    const { File } = await getModels();
    const files = await File.findAll({ where: { bucket_id: bucketId } });
    return files.length;
  }

  async findByEncryptionKey(encryptionKeyName) {
    const { Bucket } = await getModels();
    return await Bucket.findAll({ where: { encryption_key_name: encryptionKeyName } });
  }
}

module.exports = BucketRepository;
