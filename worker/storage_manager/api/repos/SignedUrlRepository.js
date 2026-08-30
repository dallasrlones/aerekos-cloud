const { getModels } = require('../models');

class SignedUrlRepository {
  async create(urlData) {
    const { SignedUrl } = await getModels();
    return await SignedUrl.create(urlData);
  }
  
  async findById(id) {
    const { SignedUrl } = await getModels();
    return await SignedUrl.find(id);
  }
  
  async findByUrl(url) {
    const { SignedUrl } = await getModels();
    const results = await SignedUrl.findAll({ where: { url } });
    return results.length > 0 ? results[0] : null;
  }
  
  async findByBucket(bucketId, filter = {}) {
    const { SignedUrl } = await getModels();
    return await SignedUrl.findAll({ 
      where: { bucket_id: bucketId, ...filter.where },
      ...filter
    });
  }
  
  async findByFile(fileId) {
    const { SignedUrl } = await getModels();
    return await SignedUrl.findAll({ where: { file_id: fileId } });
  }
  
  async update(id, urlData) {
    const { SignedUrl } = await getModels();
    return await SignedUrl.update(id, urlData);
  }
  
  async delete(id) {
    const { SignedUrl } = await getModels();
    return await SignedUrl.delete(id);
  }
  
  async findExpired() {
    const { SignedUrl } = await getModels();
    const now = new Date().toISOString();
    return await SignedUrl.findAll({ 
      where: { expires_at: { $lt: now } } 
    });
  }
}

module.exports = SignedUrlRepository;
