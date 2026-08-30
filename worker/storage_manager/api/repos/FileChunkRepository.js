const { getModels } = require('../models');

class FileChunkRepository {
  async create(chunkData) {
    const { FileChunk } = await getModels();
    return await FileChunk.create(chunkData);
  }
  
  async findByFile(fileId) {
    const { FileChunk } = await getModels();
    return await FileChunk.findAll({ 
      where: { file_id: fileId },
      orderBy: { chunk_number: 'ASC' }
    });
  }
  
  async findByFileAndNumber(fileId, chunkNumber) {
    const { FileChunk } = await getModels();
    const results = await FileChunk.findAll({ 
      where: { file_id: fileId, chunk_number: chunkNumber } 
    });
    return results.length > 0 ? results[0] : null;
  }
  
  async update(id, chunkData) {
    const { FileChunk } = await getModels();
    return await FileChunk.update(id, chunkData);
  }
  
  async delete(id) {
    const { FileChunk } = await getModels();
    return await FileChunk.delete(id);
  }
  
  async deleteByFile(fileId) {
    const { FileChunk } = await getModels();
    const chunks = await this.findByFile(fileId);
    for (const chunk of chunks) {
      await this.delete(chunk.id);
    }
  }
}

module.exports = FileChunkRepository;
