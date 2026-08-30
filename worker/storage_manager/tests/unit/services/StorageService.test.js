const StorageService = require('../../../api/services/StorageService');
const FileRepository = require('../../../api/repos/FileRepository');
const BucketRepository = require('../../../api/repos/BucketRepository');
const EncryptionService = require('../../../api/services/EncryptionService');
const fsp = require('fs').promises;
const { Readable, PassThrough } = require('stream');

jest.mock('../../../api/repos/FileRepository');
jest.mock('../../../api/repos/BucketRepository');
jest.mock('../../../api/services/EncryptionService');
jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  const { Writable } = require('stream');
  return {
    ...actual,
    createWriteStream: jest.fn(() =>
      new Writable({
        write(_chunk, _enc, cb) {
          cb();
        }
      })
    ),
    promises: {
      ...actual.promises,
      access: jest.fn().mockResolvedValue(undefined),
      mkdir: jest.fn().mockResolvedValue(undefined),
      writeFile: jest.fn().mockResolvedValue(undefined),
      readFile: jest.fn(),
      unlink: jest.fn().mockResolvedValue(undefined)
    }
  };
});

describe('StorageService', () => {
  let storageService;
  let mockFileRepo;
  let mockBucketRepo;
  let mockEncryptionService;

  beforeEach(() => {
    mockFileRepo = {
      create: jest.fn(),
      findByBucketAndKey: jest.fn(),
      findByBucket: jest.fn(),
      delete: jest.fn(),
      logAccess: jest.fn()
    };
    
    mockBucketRepo = {
      findByProjectAndName: jest.fn()
    };
    
    mockEncryptionService = {
      encryptStream: jest.fn(),
      decryptBuffer: jest.fn(),
      generateETag: jest.fn()
    };
    
    FileRepository.mockImplementation(() => mockFileRepo);
    BucketRepository.mockImplementation(() => mockBucketRepo);
    EncryptionService.mockImplementation(() => mockEncryptionService);
    
    storageService = new StorageService('http://localhost:3000', 'test-token');
  });

  describe('uploadFile', () => {
    it('should upload and encrypt file', async () => {
      const bucket = {
        id: 'bucket1',
        name: 'test-bucket',
        project_id: 'project1',
        encryption_key_name: 'test-key'
      };
      const fileStream = Readable.from(Buffer.from('test data'));

      mockBucketRepo.findByProjectAndName.mockResolvedValue(bucket);
      mockFileRepo.findByBucketAndKey.mockResolvedValue(null);
      mockEncryptionService.generateETag.mockReturnValue('test-etag');
      mockEncryptionService.encryptStream.mockImplementation(async () => {
        const t = new PassThrough();
        return t;
      });
      mockFileRepo.create.mockResolvedValue({
        id: 'file1',
        key: 'test-file.txt',
        size: 9,
        content_type: 'text/plain',
        etag: 'test-etag'
      });
      
      fsp.mkdir.mockResolvedValue();
      fsp.writeFile.mockResolvedValue();

      const result = await storageService.uploadFile(
        'project1',
        'test-bucket',
        'test-file.txt',
        fileStream,
        { content_type: 'text/plain' }
      );

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('key', 'test-file.txt');
      expect(mockEncryptionService.encryptStream).toHaveBeenCalledWith(
        fileStream,
        'test-key',
        'project1'
      );
      expect(mockFileRepo.create).toHaveBeenCalled();
    });

    it('should throw error if bucket not found', async () => {
      mockBucketRepo.findByProjectAndName.mockResolvedValue(null);
      const fileStream = Readable.from(Buffer.from('test data'));

      await expect(
        storageService.uploadFile('project1', 'nonexistent-bucket', 'file.txt', fileStream)
      ).rejects.toThrow('not found');
    });
  });

  describe('downloadFile', () => {
    it('should download and decrypt file', async () => {
      const bucket = { id: 'bucket1', name: 'test-bucket', encryption_key_name: 'test-key' };
      const file = {
        id: 'file1',
        bucket_id: 'bucket1',
        key: 'test-file.txt',
        size: 9,
        content_type: 'text/plain',
        etag: 'test-etag',
        storage_path: '/test/path',
        encryption_key_version: 1
      };
      const encryptedData = Buffer.from('encrypted data');
      const decryptedData = Buffer.from('test data');
      
      mockBucketRepo.findByProjectAndName.mockResolvedValue(bucket);
      mockFileRepo.findByBucketAndKey.mockResolvedValue(file);
      fsp.readFile.mockResolvedValue(encryptedData);
      mockEncryptionService.decryptBuffer.mockResolvedValue(decryptedData);
      mockFileRepo.logAccess.mockResolvedValue();

      const result = await storageService.downloadFile('project1', 'test-bucket', 'test-file.txt');

      expect(result).toHaveProperty('stream');
      expect(result.size).toBe(9);
      expect(result.content_type).toBe('text/plain');
      expect(mockEncryptionService.decryptBuffer).toHaveBeenCalled();
    });

    it('should throw error if file not found', async () => {
      const bucket = { id: 'bucket1', name: 'test-bucket' };
      mockBucketRepo.findByProjectAndName.mockResolvedValue(bucket);
      mockFileRepo.findByBucketAndKey.mockResolvedValue(null);

      await expect(
        storageService.downloadFile('project1', 'test-bucket', 'nonexistent-file.txt')
      ).rejects.toThrow('not found');
    });
  });

  describe('deleteFile', () => {
    it('should delete file and physical storage', async () => {
      const bucket = { id: 'bucket1', name: 'test-bucket' };
      const file = {
        id: 'file1',
        bucket_id: 'bucket1',
        key: 'test-file.txt',
        storage_path: '/test/path'
      };
      
      mockBucketRepo.findByProjectAndName.mockResolvedValue(bucket);
      mockFileRepo.findByBucketAndKey.mockResolvedValue(file);
      fsp.unlink.mockResolvedValue();
      mockFileRepo.delete.mockResolvedValue();

      await storageService.deleteFile('project1', 'test-bucket', 'test-file.txt');

      expect(fsp.unlink).toHaveBeenCalledWith('/test/path');
      expect(mockFileRepo.delete).toHaveBeenCalledWith('file1');
    });
  });

  describe('listFiles', () => {
    it('should return list of files', async () => {
      const bucket = { id: 'bucket1', name: 'test-bucket' };
      const files = [
        { id: 'file1', key: 'file1.txt', size: 100, metadata: '{}' },
        { id: 'file2', key: 'file2.txt', size: 200, metadata: '{}' }
      ];
      
      mockBucketRepo.findByProjectAndName.mockResolvedValue(bucket);
      mockFileRepo.findByBucket.mockResolvedValue(files);

      const result = await storageService.listFiles('project1', 'test-bucket', '', 1000);

      expect(result.files).toHaveLength(2);
      expect(result.files[0]).toHaveProperty('key', 'file1.txt');
    });
  });
});
