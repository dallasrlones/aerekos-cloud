const path = require('path');
const StorageService = require('../../../api/services/StorageService');
const BucketService = require('../../../api/services/BucketService');
const FileRepository = require('../../../api/repos/FileRepository');
const BucketRepository = require('../../../api/repos/BucketRepository');
const ProjectRepository = require('../../../api/repos/ProjectRepository');
const EncryptionService = require('../../../api/services/EncryptionService');

jest.mock('../../../api/repos/FileRepository');
jest.mock('../../../api/repos/BucketRepository');
jest.mock('../../../api/repos/ProjectRepository');
jest.mock('../../../api/services/EncryptionService');

describe('System buckets', () => {
  let mockFileRepo, mockBucketRepo, mockProjectRepo, mockEncryption;

  beforeEach(() => {
    mockFileRepo = { findByBucketAndKey: jest.fn(), findByBucket: jest.fn(), delete: jest.fn(), update: jest.fn() };
    mockBucketRepo = { findByProjectAndName: jest.fn(), findBySystemAndName: jest.fn(), findBySystem: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() };
    mockProjectRepo = { findById: jest.fn(), findByName: jest.fn() };
    mockEncryption = { ensureKey: jest.fn(), getEncryptionKey: jest.fn() };
    FileRepository.mockImplementation(() => mockFileRepo);
    BucketRepository.mockImplementation(() => mockBucketRepo);
    ProjectRepository.mockImplementation(() => mockProjectRepo);
    EncryptionService.mockImplementation(() => mockEncryption);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.STORAGE_PATH;
    delete process.env.STORAGE_HARD_DELETE;
  });

  describe('StorageService', () => {
    it('resolves system buckets via findBySystemAndName (never touches project lookup)', async () => {
      mockBucketRepo.findBySystemAndName.mockResolvedValue({ id: 'b1', name: 'media', system_id: 'aerekos' });
      const svc = new StorageService('http://c', 't');
      const b = await svc._resolveBucket({ systemId: 'aerekos', name: 'media' });
      expect(b.id).toBe('b1');
      expect(mockBucketRepo.findByProjectAndName).not.toHaveBeenCalled();
      expect(mockBucketRepo.findBySystemAndName).toHaveBeenCalledWith('aerekos', 'media');
    });

    it('getBucketBase honors base_path override, else falls back to STORAGE_PATH', () => {
      process.env.STORAGE_PATH = '/data/sm';
      const svc = new StorageService('http://c', 't');
      expect(svc.getBucketBase({ base_path: '/mnt/usb24tb/aerekos-media' })).toBe('/mnt/usb24tb/aerekos-media');
      expect(svc.getBucketBase({})).toBe('/data/sm');
    });

    it('getStoragePath writes under base_path for system buckets', () => {
      process.env.STORAGE_PATH = '/data/sm';
      const svc = new StorageService('http://c', 't');
      expect(svc.getStoragePath({ id: 'b1' }, 'f1', 'a/b.txt')).toBe(path.join('/data/sm', 'b1', 'f1_a_b.txt'));
      expect(svc.getStoragePath({ id: 'b1', base_path: '/mnt/usb24tb/aerekos-media' }, 'f1', 'a/b.txt'))
        .toBe('/mnt/usb24tb/aerekos-media/b1/f1_a_b.txt');
    });
  });

  describe('BucketService.createSystemBucket', () => {
    it('creates a system bucket: null project, system_id set, base_path honored', async () => {
      mockBucketRepo.findBySystemAndName.mockResolvedValue(null);
      mockBucketRepo.create.mockResolvedValue({ id: 'b2' });
      const svc = new BucketService('http://c', 't');
      svc.ensureEncryptionKey = jest.fn().mockResolvedValue('k');

      const b = await svc.createSystemBucket('aerekos', 'media', 'download_manager', null, '/mnt/usb24tb/aerekos-media');

      expect(b.id).toBe('b2');
      expect(mockProjectRepo.findById).not.toHaveBeenCalled();
      expect(mockBucketRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        project_id: null,
        system_id: 'aerekos',
        name: 'media',
        base_path: '/mnt/usb24tb/aerekos-media'
      }));
    });

    it('throws on duplicate name within the same system', async () => {
      mockBucketRepo.findBySystemAndName.mockResolvedValue({ id: 'x' });
      const svc = new BucketService('http://c', 't');
      await expect(svc.createSystemBucket('aerekos', 'media', 'x')).rejects.toThrow('already exists');
    });
  });

  describe('BucketService.deleteSystemBucket protection', () => {
    it('refuses delete when metadata.protected is true', async () => {
      mockBucketRepo.findBySystemAndName.mockResolvedValue({
        id: 'b-prot',
        name: 'tv-media',
        system_id: 'aerekos',
        metadata: JSON.stringify({ protected: true }),
        encryption_key_name: null,
      });
      const svc = new BucketService('http://c', 't');
      await expect(svc.deleteSystemBucket('aerekos', 'tv-media')).rejects.toMatchObject({
        code: 'SYSTEM_BUCKET_IMMUTABLE',
        status: 403,
      });
      expect(mockBucketRepo.delete).not.toHaveBeenCalled();
    });

    it('refuses delete when name is listed in SYSTEM_PROTECTED_BUCKET_NAMES', async () => {
      process.env.SYSTEM_PROTECTED_BUCKET_NAMES = 'tv-media,tv-posters';
      mockBucketRepo.findBySystemAndName.mockResolvedValue({
        id: 'b-named',
        name: 'tv-posters',
        system_id: 'aerekos',
        metadata: '{}',
        encryption_key_name: null,
      });
      const svc = new BucketService('http://c', 't');
      await expect(svc.deleteSystemBucket('aerekos', 'tv-posters')).rejects.toMatchObject({
        code: 'SYSTEM_BUCKET_IMMUTABLE',
        status: 403,
      });
      expect(mockBucketRepo.delete).not.toHaveBeenCalled();
      delete process.env.SYSTEM_PROTECTED_BUCKET_NAMES;
    });

    it('allows delete of an unmarked system bucket', async () => {
      mockBucketRepo.findBySystemAndName.mockResolvedValue({
        id: 'b-ok',
        name: 'scratch',
        system_id: 'aerekos',
        metadata: {},
        encryption_key_name: null,
        base_path: null,
      });
      mockFileRepo.findByBucket.mockResolvedValue([]);
      mockBucketRepo.delete.mockResolvedValue(true);
      const svc = new BucketService('http://c', 't');
      await svc.deleteSystemBucket('aerekos', 'scratch');
      expect(mockBucketRepo.delete).toHaveBeenCalledWith('b-ok');
    });
  });
});
