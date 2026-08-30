const { getModels } = require('../models');

class FileRepository {
  async create(fileData) {
    const { File } = await getModels();
    return await File.create(fileData);
  }
  
  async findById(id) {
    const { File } = await getModels();
    return await File.find(id);
  }
  
  async findByBucketAndKey(bucketId, key) {
    const { File } = await getModels();
    const results = await File.findAll({ 
      where: { bucket_id: bucketId, key } 
    });
    return results.length > 0 ? results[0] : null;
  }
  
  async findByBucket(bucketId, options = {}) {
    const { File } = await getModels();
    const { prefix, maxKeys = 1000, marker, offset = 0 } = options;
    
    let where = { bucket_id: bucketId };
    if (prefix) {
      where.key = { $like: `${prefix}%` };
    }
    
    const query = {
      where,
      limit: maxKeys,
      offset: parseInt(offset)
    };
    
    if (marker) {
      query.where.id = { $gt: marker };
    }
    
    return await File.findAll(query);
  }
  
  async update(id, fileData) {
    const { File } = await getModels();
    return await File.update(id, fileData);
  }
  
  async delete(id) {
    const { File } = await getModels();
    return await File.delete(id);
  }
  
  async findAll(filter = {}) {
    const { File } = await getModels();
    return await File.findAll(filter);
  }
  
  async logAccess(fileId, accessData) {
    const { FileAccess } = await getModels();
    return await FileAccess.create({
      file_id: fileId,
      ...accessData,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = FileRepository;
