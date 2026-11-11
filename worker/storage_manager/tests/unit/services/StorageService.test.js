const StorageService = require('../../../api/services/StorageService');
const FileRepository = require('../../../api/repos/FileRepository');
const BucketRepository = require('../../../api/repos/BucketRepository');
const EncryptionService = require('../../../api/services/EncryptionService');
const fsp = require('fs').promises;
const { Readable, PassThrough } = require('stream');
const actual = jest.requireActual('fs');

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
      unlink: jest.fn().mockResolvedValue(undefined),
      stat: jest.fn(),
      open: jest.fn()
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
      update: jest.fn(),
      logAccess: jest.fn()
    };
    
    mockBucketRepo = {
      findByProjectAndName: jest.fn(),
      findBySystemAndName: jest.fn(),
      findBySystem: jest.fn()
    };
    
    mockEncryptionService = {
      encryptStream: jest.fn(),
      decryptBuffer: jest.fn(),
      getKeyBuffer: jest.fn(),
      generateETag: jest.fn()
    };
    
    FileRepository.mockImplementation(() => mockFileRepo);
    BucketRepository.mockImplementation(() => mockBucketRepo);
    EncryptionService.mockImplementation(() => mockEncryptionService);
    
    // Download tests use real temp files: delegate stat/open to the real fs.
    fsp.stat.mockImplementation((...a) => actual.promises.stat(...a));
    fsp.open.mockImplementation((...a) => actual.promises.open(...a));
    
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
    const os = require('os');
    const path = require('path');
    const realFsp = jest.requireActual('fs').promises;
    const RealEncryptionService = jest.requireActual('../../../api/services/EncryptionService');
    const MOCK_HEX = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    // Build a real on-disk object ([IV][ciphertext][tag]) with the real
    // encryption code so the download path is exercised end to end.
    async function makeEncryptedTempFile(plain) {
      process.env.MOCK_KEY_MANAGER = 'true';
      process.env.MOCK_KEY_MATERIAL = MOCK_HEX;
      const svc = new RealEncryptionService('http://localhost:1', 'tok');
      const enc = await svc.encryptBuffer(plain, 'test-key', 'project1');
      const dir = await realFsp.mkdtemp(path.join(os.tmpdir(), 'st-'));
      const file = path.join(dir, 'obj.bin');
      await realFsp.writeFile(file, enc);
      return { file, enc };
    }

    function recordFor(file, plain) {
      return {
        id: 'file1',
        bucket_id: 'bucket1',
        key: 'test-file.txt',
        size: plain.length,
        content_type: 'text/plain',
        etag: 'test-etag',
        storage_path: file,
        encryption_key_version: 1,
        metadata: null
      };
    }

    function wireDownload(bucket, fileRec) {
      mockBucketRepo.findByProjectAndName.mockResolvedValue(bucket);
      mockFileRepo.findByBucketAndKey.mockResolvedValue(fileRec);
      mockEncryptionService.getKeyBuffer.mockResolvedValue(
        Buffer['from'](MOCK_HEX, 'hex')
      );
      mockFileRepo.logAccess.mockResolvedValue();
    }

    async function drain(stream) {
      const chunks = [];
      for await (const c of stream) chunks.push(c);
      return Buffer.concat(chunks);
    }

    it('should stream and decrypt the whole object', async () => {
      const plain = Buffer['from']('hello world, this is a stored object');
      const { file } = await makeEncryptedTempFile(plain);
      const bucket = { id: 'bucket1', name: 'test-bucket', encryption_key_name: 'test-key' };
      wireDownload(bucket, recordFor(file, plain));

      const result = await storageService.downloadFile('project1', 'test-bucket', 'test-file.txt');

      expect(result.size).toBe(plain.length);
      expect(result.totalSize).toBe(plain.length);
      expect(result.content_type).toBe('text/plain');
      expect(result.contentRange).toBeNull();
      expect(await drain(result.stream)).toEqual(plain);
      expect(mockEncryptionService.getKeyBuffer).toHaveBeenCalled();
    });

    it('should serve a byte range (206 semantics)', async () => {
      const plain = Buffer['from']('0123456789ABCDEF');
      const { file } = await makeEncryptedTempFile(plain);
      const bucket = { id: 'bucket1', name: 'test-bucket', encryption_key_name: 'test-key' };
      wireDownload(bucket, recordFor(file, plain));

      const result = await storageService.downloadFile(
        'project1', 'test-bucket', 'test-file.txt', null, 'bytes=2-5'
      );

      expect(result.contentRange).toBe('bytes 2-5/16');
      expect(result.size).toBe(4);
      expect(result.totalSize).toBe(16);
      expect(await drain(result.stream)).toEqual(plain.subarray(2, 6));
    });

    it('should serve a suffix range (bytes=-N)', async () => {
      const plain = Buffer['from']('0123456789ABCDEF');
      const { file } = await makeEncryptedTempFile(plain);
      const bucket = { id: 'bucket1', name: 'test-bucket', encryption_key_name: 'test-key' };
      wireDownload(bucket, recordFor(file, plain));

      const result = await storageService.downloadFile(
        'project1', 'test-bucket', 'test-file.txt', null, 'bytes=-5'
      );

      expect(result.contentRange).toBe('bytes 11-15/16');
      expect(await drain(result.stream)).toEqual(plain.subarray(11, 16));
    });

    it('should reject an unsatisfiable range with status 416', async () => {
      const plain = Buffer['from']('0123456789ABCDEF');
      const { file } = await makeEncryptedTempFile(plain);
      const bucket = { id: 'bucket1', name: 'test-bucket', encryption_key_name: 'test-key' };
      wireDownload(bucket, recordFor(file, plain));

      await expect(
        storageService.downloadFile('project1', 'test-bucket', 'test-file.txt', null, 'bytes=99-')
      ).rejects.toMatchObject({ status: 416 });
    });

    it('should throw when the stored object is missing on disk', async () => {
      const plain = Buffer['from']('whatever');
      const bucket = { id: 'bucket1', name: 'test-bucket', encryption_key_name: 'test-key' };
      const rec = recordFor('/nonexistent/path/xyz.bin', plain);
      wireDownload(bucket, rec);

      await expect(
        storageService.downloadFile('project1', 'test-bucket', 'test-file.txt')
      ).rejects.toThrow(/Stored object missing/);
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
    it('should delete file and physical storage (hard delete)', async () => {
      process.env.STORAGE_HARD_DELETE = '1';
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
      delete process.env.STORAGE_HARD_DELETE;
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

    it('paginates a large bucket without dropping rows (regression: double offset)', async () => {
      const bucket = { id: 'bucket1', name: 'test-bucket' };
      // Mirror the production incident: 2365 rows in one bucket, where the
      // 1000 rows at offset 1000-1999 vanished under the old double-offset
      // (SQL OFFSET + a second JS slice by offset).
      const all = Array.from({ length: 2365 }, (_, i) => ({
        id: 'f' + i,
        key: i < 1000
          ? 'movies/m' + String(i).padStart(4, '0') + '.mp4'
          : 'tv-shows/lost-in-space/s01e' + String(i - 1000).padStart(2, '0') + '.avi',
        size: 100,
        metadata: '{}'
      }));

      mockBucketRepo.findByProjectAndName.mockResolvedValue(bucket);
      // Emulate the repo's SQL LIMIT/OFFSET semantics.
      mockFileRepo.findByBucket.mockImplementation((_id, { maxKeys, offset = 0 } = {}) =>
        Promise.resolve(all.slice(offset, offset + maxKeys))
      );

      // Walk the list exactly like the TV app does.
      let offset = 0;
      const seen = [];
      let result;
      for (let page = 0; page < 20; page++) {
        result = await storageService.listFiles('project1', 'test-bucket', '', 1000, '', offset);
        seen.push(...result.files.map((f) => f.key));
        if (!result.hasMore) break;
        offset += result.files.length;
      }

      expect(result.hasMore).toBe(false);
      expect(seen).toHaveLength(2365);
      expect(new Set(seen).size).toBe(2365);
      expect(seen).toEqual(all.map((f) => f.key)); // same order, no gaps
    });
  });
});
