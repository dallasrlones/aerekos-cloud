const ChunkedUploadService = require('../../../api/services/ChunkedUploadService');
const FileRepository = require('../../../api/repos/FileRepository');
const FileChunkRepository = require('../../../api/repos/FileChunkRepository');
const BucketRepository = require('../../../api/repos/BucketRepository');
const EncryptionService = require('../../../api/services/EncryptionService');
const fsp = require('fs').promises;

jest.mock('../../../api/repos/FileRepository');
jest.mock('../../../api/repos/FileChunkRepository');
jest.mock('../../../api/repos/BucketRepository');
jest.mock('../../../api/services/EncryptionService');
jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    promises: {
      ...actual.promises,
      mkdir: jest.fn().mockResolvedValue(undefined),
      writeFile: jest.fn().mockResolvedValue(undefined),
      readFile: jest.fn(),
      unlink: jest.fn().mockResolvedValue(undefined)
    }
  };
});

describe('ChunkedUploadService', () => {
  let chunkedUploadService;
  let mockFileRepo;
  let mockChunkRepo;
  let mockBucketRepo;
  let mockEncryptionService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockFileRepo = {
      create: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    };
    
    mockChunkRepo = {
      create: jest.fn(),
      findByFile: jest.fn(),
      findByFileAndNumber: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    };
    
    mockBucketRepo = {
      findByProjectAndName: jest.fn(),
      findById: jest.fn()
    };
    
    mockEncryptionService = {
      encryptBuffer: jest.fn(),
      decryptBuffer: jest.fn(),
      generateETag: jest.fn(() => 'etag-mock')
    };
    
    FileRepository.mockImplementation(() => mockFileRepo);
    FileChunkRepository.mockImplementation(() => mockChunkRepo);
    BucketRepository.mockImplementation(() => mockBucketRepo);
    EncryptionService.mockImplementation(() => mockEncryptionService);
    
    chunkedUploadService = new ChunkedUploadService('http://localhost:3000', 'test-token');
  });

  describe('initiateChunkedUpload', () => {
    it('should initiate chunked upload', async () => {
      const bucket = { id: 'bucket1', name: 'test-bucket', project_id: 'project1' };
      const file = {
        id: 'file1',
        bucket_id: 'bucket1',
        key: 'test-file.txt',
        upload_id: 'upload1',
        chunk_count: 2,
        chunk_size: 5242880
      };
      
      mockBucketRepo.findByProjectAndName.mockResolvedValue(bucket);
      mockFileRepo.create.mockResolvedValue(file);

      const result = await chunkedUploadService.initiateChunkedUpload(
        'project1',
        'test-bucket',
        'test-file.txt',
        10485760, // 10MB
        5242880,  // 5MB chunks
        {}
      );

      expect(result).toHaveProperty('upload_id');
      expect(result).toHaveProperty('chunk_count', 2);
      expect(mockFileRepo.create).toHaveBeenCalled();
    });
  });

  describe('uploadChunk', () => {
    it('should upload a chunk', async () => {
      const file = {
        id: 'file1',
        upload_id: 'upload1',
        upload_status: 'in_progress',
        bucket_id: 'bucket1'
      };
      const bucket = { id: 'bucket1', project_id: 'project1', encryption_key_name: 'test-key' };
      const chunkData = Buffer.from('chunk data');
      const encryptedChunk = Buffer.from('encrypted chunk');
      
      mockFileRepo.findAll.mockResolvedValue([file]);
      mockBucketRepo.findById.mockResolvedValue(bucket);
      mockEncryptionService.encryptBuffer.mockResolvedValue(encryptedChunk);
      mockChunkRepo.findByFileAndNumber.mockResolvedValue(null);
      mockChunkRepo.create.mockResolvedValue({ id: 'chunk1' });
      fsp.mkdir.mockResolvedValue();
      fsp.writeFile.mockResolvedValue();

      const result = await chunkedUploadService.uploadChunk('upload1', 1, chunkData);

      expect(result).toHaveProperty('chunk_number', 1);
      expect(mockEncryptionService.encryptBuffer).toHaveBeenCalledWith(
        chunkData,
        'test-key',
        'project1'
      );
    });

    it('should throw error if upload not found', async () => {
      mockFileRepo.findAll.mockResolvedValue([]);

      await expect(
        chunkedUploadService.uploadChunk('nonexistent-upload', 1, Buffer.from('data'))
      ).rejects.toThrow('not found');
    });
  });

  describe('completeChunkedUpload', () => {
    it('should complete chunked upload and merge chunks', async () => {
      const file = {
        id: 'file1',
        upload_id: 'upload1',
        upload_status: 'in_progress',
        bucket_id: 'bucket1',
        chunk_count: 2,
        key: 'test-file.txt'
      };
      const bucket = { id: 'bucket1', project_id: 'project1', encryption_key_name: 'test-key' };
      const chunks = [
        { id: 'chunk1', chunk_number: 1, chunk_path: '/path/chunk1' },
        { id: 'chunk2', chunk_number: 2, chunk_path: '/path/chunk2' }
      ];
      const mergedData = Buffer.from('merged data');
      
      mockFileRepo.findAll.mockResolvedValue([file]);
      mockBucketRepo.findById.mockResolvedValue(bucket);
      mockChunkRepo.findByFile.mockResolvedValue(chunks);
      fsp.readFile.mockResolvedValue(Buffer.from('encrypted'));
      mockEncryptionService.decryptBuffer.mockResolvedValue(Buffer.from('decrypted'));
      mockFileRepo.update.mockResolvedValue(file);
      fsp.mkdir.mockResolvedValue();
      fsp.writeFile.mockResolvedValue();
      fsp.unlink.mockResolvedValue();
      mockChunkRepo.delete.mockResolvedValue();

      const result = await chunkedUploadService.completeChunkedUpload('upload1');

      expect(result).toHaveProperty('file_id');
      expect(mockFileRepo.update).toHaveBeenCalled();
    });

    it('should throw error if chunk count mismatch', async () => {
      const file = {
        id: 'file1',
        upload_id: 'upload1',
        upload_status: 'in_progress',
        chunk_count: 2
      };
      const chunks = [{ id: 'chunk1', chunk_number: 1 }];
      
      mockFileRepo.findAll.mockResolvedValue([file]);
      mockChunkRepo.findByFile.mockResolvedValue(chunks);

      await expect(
        chunkedUploadService.completeChunkedUpload('upload1')
      ).rejects.toThrow('Expected');
    });
  });

  describe('abortChunkedUpload', () => {
    it('should abort upload and clean up chunks', async () => {
      const file = {
        id: 'file1',
        upload_id: 'upload1'
      };
      const chunks = [
        { id: 'chunk1', chunk_path: '/path/chunk1' },
        { id: 'chunk2', chunk_path: '/path/chunk2' }
      ];
      
      mockFileRepo.findAll.mockResolvedValue([file]);
      mockChunkRepo.findByFile.mockResolvedValue(chunks);
      fsp.unlink.mockResolvedValue();
      mockChunkRepo.delete.mockResolvedValue();
      mockFileRepo.delete.mockResolvedValue();

      await chunkedUploadService.abortChunkedUpload('upload1');

      expect(mockFileRepo.delete).toHaveBeenCalledWith('file1');
      expect(fsp.unlink).toHaveBeenCalledTimes(2);
    });
  });
});
