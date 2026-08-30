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
