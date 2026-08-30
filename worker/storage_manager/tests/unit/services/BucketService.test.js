jest.mock('axios');
jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    promises: {
      ...actual.promises,
      unlink: jest.fn().mockResolvedValue(undefined),
      rm: jest.fn().mockResolvedValue(undefined)
    }
  };
});

const axios = require('axios');
const BucketService = require('../../../api/services/BucketService');
const BucketRepository = require('../../../api/repos/BucketRepository');
const FileRepository = require('../../../api/repos/FileRepository');
const ProjectRepository = require('../../../api/repos/ProjectRepository');

jest.mock('../../../api/repos/BucketRepository');
jest.mock('../../../api/repos/FileRepository');
jest.mock('../../../api/repos/ProjectRepository');

describe('BucketService', () => {
  let bucketService;
  let mockBucketRepo;
  let mockFileRepo;
  let mockProjectRepo;

  beforeEach(() => {
    process.env.CONDUCTOR_URL = 'http://conductor.test';
    process.env.SERVICE_TOKEN = 'test-token';
    axios.get.mockReset();
    axios.post.mockReset();
    axios.delete.mockReset();
    axios.get.mockRejectedValue({ response: { status: 404 } });
    axios.post.mockResolvedValue({ data: {} });
    axios.delete.mockResolvedValue({ data: {} });

    mockBucketRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByProjectAndName: jest.fn(),
      findByProject: jest.fn(),
      findByEncryptionKey: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    };

    mockFileRepo = {
      findByBucket: jest.fn(),
      delete: jest.fn()
    };
    mockProjectRepo = {
      findById: jest.fn()
    };

    BucketRepository.mockImplementation(() => mockBucketRepo);
    FileRepository.mockImplementation(() => mockFileRepo);
    ProjectRepository.mockImplementation(() => mockProjectRepo);

    bucketService = new BucketService();
  });

  describe('createBucket', () => {
    it('should create a new bucket', async () => {
      const bucketData = { id: '1', project_id: 'project1', name: 'test-bucket' };
      mockProjectRepo.findById.mockResolvedValue({ id: 'project1' });
      mockBucketRepo.findByProjectAndName.mockResolvedValue(null);
      mockBucketRepo.create.mockResolvedValue(bucketData);

      const result = await bucketService.createBucket('project1', 'test-bucket', 'test', null, {});

      expect(result).toEqual(bucketData);
      expect(mockBucketRepo.create).toHaveBeenCalled();
      expect(axios.post).toHaveBeenCalled();
    });

    it('should throw error if project not found', async () => {
      mockProjectRepo.findById.mockRejectedValue(new Error('not found'));

      await expect(
        bucketService.createBucket('project1', 'test-bucket', 'test')
      ).rejects.toThrow();
    });

    it('should throw error if bucket already exists', async () => {
      mockProjectRepo.findById.mockResolvedValue({ id: 'project1' });
      mockBucketRepo.findByProjectAndName.mockResolvedValue({ id: '1', name: 'test-bucket' });

      await expect(
        bucketService.createBucket('project1', 'test-bucket', 'test')
      ).rejects.toThrow('already exists');
    });
  });

  describe('getBucket', () => {
    it('should return bucket by project and name', async () => {
      const bucket = { id: '1', project_id: 'project1', name: 'test-bucket', metadata: '{}' };
      mockBucketRepo.findByProjectAndName.mockResolvedValue(bucket);

      const result = await bucketService.getBucket('project1', 'test-bucket');

      expect(result.name).toBe('test-bucket');
    });

    it('should throw error if bucket not found', async () => {
      mockBucketRepo.findByProjectAndName.mockResolvedValue(null);

      await expect(
        bucketService.getBucket('project1', 'test-bucket')
      ).rejects.toThrow('not found');
    });
  });

  describe('listBuckets', () => {
    it('should return list of buckets', async () => {
      const buckets = [
        { id: '1', name: 'bucket1', metadata: '{}' },
        { id: '2', name: 'bucket2', metadata: '{}' }
      ];
      mockProjectRepo.findById.mockResolvedValue({ id: 'project1' });
      mockBucketRepo.findByProject.mockResolvedValue(buckets);

      const result = await bucketService.listBuckets('project1');

      expect(result).toHaveLength(2);
    });
  });

  describe('deleteBucket', () => {
    it('should delete empty bucket and remove encryption key when unused', async () => {
      const bucket = {
        id: '1',
        name: 'test-bucket',
        encryption_key_name: 'key-1'
      };
      mockBucketRepo.findByProjectAndName.mockResolvedValue(bucket);
      mockFileRepo.findByBucket.mockResolvedValue([]);
      mockBucketRepo.delete.mockResolvedValue(true);
      mockBucketRepo.findByEncryptionKey.mockResolvedValue([]);

      await bucketService.deleteBucket('project1', 'test-bucket');

      expect(mockFileRepo.findByBucket).toHaveBeenCalledWith('1', { maxKeys: 10000 });
      expect(mockBucketRepo.delete).toHaveBeenCalledWith('1');
      expect(axios.delete).toHaveBeenCalled();
    });

    it('should delete bucket and all associated files', async () => {
      const bucket = {
        id: '1',
        name: 'test-bucket',
        encryption_key_name: 'key-1'
      };
      mockBucketRepo.findByProjectAndName.mockResolvedValue(bucket);
      mockFileRepo.findByBucket.mockResolvedValue([
        { id: 'f1', key: 'a', storage_path: '/tmp/x' },
        { id: 'f2', key: 'b', storage_path: '/tmp/y' }
      ]);
      mockBucketRepo.delete.mockResolvedValue(true);
      mockBucketRepo.findByEncryptionKey.mockResolvedValue([]);

      await bucketService.deleteBucket('project1', 'test-bucket');

      expect(mockFileRepo.delete).toHaveBeenCalledTimes(2);
      expect(mockFileRepo.delete).toHaveBeenCalledWith('f1');
      expect(mockFileRepo.delete).toHaveBeenCalledWith('f2');
      expect(mockBucketRepo.delete).toHaveBeenCalledWith('1');
    });
  });
});
