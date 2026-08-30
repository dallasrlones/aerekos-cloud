const SignedUrlService = require('../../../api/services/SignedUrlService');
const SignedUrlRepository = require('../../../api/repos/SignedUrlRepository');
const FileRepository = require('../../../api/repos/FileRepository');
const BucketRepository = require('../../../api/repos/BucketRepository');

jest.mock('../../../api/repos/SignedUrlRepository');
jest.mock('../../../api/repos/FileRepository');
jest.mock('../../../api/repos/BucketRepository');

describe('SignedUrlService', () => {
  let signedUrlService;
  let mockSignedUrlRepo;
  let mockFileRepo;
  let mockBucketRepo;

  beforeEach(() => {
    mockSignedUrlRepo = {
      create: jest.fn(),
      findByUrl: jest.fn(),
      findExpired: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    };
    
    mockFileRepo = {
      findByBucketAndKey: jest.fn(),
      create: jest.fn()
    };
    
    mockBucketRepo = {
      findByProjectAndName: jest.fn()
    };
    
    SignedUrlRepository.mockImplementation(() => mockSignedUrlRepo);
    FileRepository.mockImplementation(() => mockFileRepo);
    BucketRepository.mockImplementation(() => mockBucketRepo);
    
    signedUrlService = new SignedUrlService('http://localhost:3000');
  });

  describe('generateSignedUploadUrl', () => {
    it('should generate signed upload URL', async () => {
      const bucket = { id: 'bucket1', name: 'test-bucket', project_id: 'project1' };
      const file = { id: 'file1', bucket_id: 'bucket1', key: 'test-file.txt' };
      
      mockBucketRepo.findByProjectAndName.mockResolvedValue(bucket);
      mockFileRepo.findByBucketAndKey.mockResolvedValue(null);
      mockFileRepo.create.mockResolvedValue(file);
      mockSignedUrlRepo.create.mockResolvedValue({ id: 'url1' });

      const result = await signedUrlService.generateSignedUploadUrl(
        'project1',
        'test-bucket',
        'test-file.txt',
        3600
      );

      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('expires_at');
      expect(result.url).toContain('signed');
    });
  });

  describe('generateSignedDownloadUrl', () => {
    it('should generate signed download URL', async () => {
      const bucket = { id: 'bucket1', name: 'test-bucket', project_id: 'project1' };
      const file = { id: 'file1', bucket_id: 'bucket1', key: 'test-file.txt' };
      
      mockBucketRepo.findByProjectAndName.mockResolvedValue(bucket);
      mockFileRepo.findByBucketAndKey.mockResolvedValue(file);
      mockSignedUrlRepo.create.mockResolvedValue({ id: 'url1' });

      const result = await signedUrlService.generateSignedDownloadUrl(
        'project1',
        'test-bucket',
        'test-file.txt',
        3600
      );

      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('expires_at');
    });

    it('should throw error if file not found', async () => {
      const bucket = { id: 'bucket1', name: 'test-bucket', project_id: 'project1' };
      
      mockBucketRepo.findByProjectAndName.mockResolvedValue(bucket);
      mockFileRepo.findByBucketAndKey.mockResolvedValue(null);

      await expect(
        signedUrlService.generateSignedDownloadUrl('project1', 'test-bucket', 'nonexistent.txt')
      ).rejects.toThrow('not found');
    });
  });

  describe('validateSignedUrl', () => {
    it('should validate valid signed URL', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const ttl = 3600;
      const signature = require('crypto')
        .createHmac('sha256', 'change-this-secret-key-in-production')
        .update(`file1:bucket1:download:${timestamp}:${ttl}`)
        .digest('hex');
      
      mockSignedUrlRepo.findByUrl.mockResolvedValue({ id: 'url1', used: 0 });

      const result = await signedUrlService.validateSignedUrl(
        signature,
        'file1',
        'bucket1',
        'download',
        timestamp.toString(),
        ttl.toString()
      );

      expect(result.valid).toBe(true);
    });

    it('should throw error for invalid signature', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const ttl = 3600;

      await expect(
        signedUrlService.validateSignedUrl(
          'invalid-signature',
          'file1',
          'bucket1',
          'download',
          timestamp.toString(),
          ttl.toString()
        )
      ).rejects.toThrow('Invalid signature');
    });

    it('should throw error for expired URL', async () => {
      const timestamp = Math.floor((Date.now() - 7200000) / 1000); // 2 hours ago
      const ttl = 3600; // 1 hour
      const signature = require('crypto')
        .createHmac('sha256', 'change-this-secret-key-in-production')
        .update(`file1:bucket1:download:${timestamp}:${ttl}`)
        .digest('hex');

      await expect(
        signedUrlService.validateSignedUrl(
          signature,
          'file1',
          'bucket1',
          'download',
          timestamp.toString(),
          ttl.toString()
        )
      ).rejects.toThrow('expired');
    });
  });

  describe('cleanupExpiredUrls', () => {
    it('should cleanup expired URLs', async () => {
      const expiredUrls = [
        { id: 'url1' },
        { id: 'url2' }
      ];
      
      mockSignedUrlRepo.findExpired.mockResolvedValue(expiredUrls);
      mockSignedUrlRepo.delete.mockResolvedValue();

      const count = await signedUrlService.cleanupExpiredUrls();

      expect(count).toBe(2);
      expect(mockSignedUrlRepo.delete).toHaveBeenCalledTimes(2);
    });
  });
});
