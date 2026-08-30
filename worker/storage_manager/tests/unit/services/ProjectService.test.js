const ProjectService = require('../../../api/services/ProjectService');
const ProjectRepository = require('../../../api/repos/ProjectRepository');
const BucketRepository = require('../../../api/repos/BucketRepository');

jest.mock('../../../api/repos/ProjectRepository');
jest.mock('../../../api/repos/BucketRepository');

describe('ProjectService', () => {
  let projectService;
  let mockProjectRepo;
  let mockBucketRepo;

  beforeEach(() => {
    mockProjectRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByName: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    };
    
    mockBucketRepo = {
      findByProject: jest.fn()
    };
    
    ProjectRepository.mockImplementation(() => mockProjectRepo);
    BucketRepository.mockImplementation(() => mockBucketRepo);
    
    projectService = new ProjectService();
  });

  describe('createProject', () => {
    it('should create a new project', async () => {
      const projectData = { id: '1', name: 'test-project', created_by: 'test' };
      mockProjectRepo.findByName.mockResolvedValue(null);
      mockProjectRepo.create.mockResolvedValue(projectData);

      const result = await projectService.createProject('test-project', 'test', {});

      expect(result).toEqual(projectData);
      expect(mockProjectRepo.findByName).toHaveBeenCalledWith('test-project');
      expect(mockProjectRepo.create).toHaveBeenCalled();
    });

    it('should throw error if project already exists', async () => {
      mockProjectRepo.findByName.mockResolvedValue({ id: '1', name: 'test-project' });

      await expect(
        projectService.createProject('test-project', 'test', {})
      ).rejects.toThrow('already exists');
    });
  });

  describe('getProject', () => {
    it('should return project by ID', async () => {
      const project = { id: '1', name: 'test-project', metadata: '{"test": true}' };
      mockProjectRepo.findById.mockResolvedValue(project);

      const result = await projectService.getProject('1');

      expect(result.name).toBe('test-project');
      expect(result.metadata).toEqual({ test: true });
    });

    it('should throw error if project not found', async () => {
      mockProjectRepo.findById.mockResolvedValue(null);

      await expect(projectService.getProject('1')).rejects.toThrow('not found');
    });
  });

  describe('listProjects', () => {
    it('should return list of projects', async () => {
      const projects = [
        { id: '1', name: 'project1', metadata: '{}' },
        { id: '2', name: 'project2', metadata: '{}' }
      ];
      mockProjectRepo.findAll.mockResolvedValue(projects);

      const result = await projectService.listProjects();

      expect(result).toHaveLength(2);
      expect(mockProjectRepo.findAll).toHaveBeenCalled();
    });
  });

  describe('updateProject', () => {
    it('should update project metadata', async () => {
      const project = { id: '1', name: 'test-project' };
      mockProjectRepo.findById.mockResolvedValue(project);
      mockProjectRepo.update.mockResolvedValue({ ...project, name: 'updated-project' });

      const result = await projectService.updateProject('1', { name: 'updated-project' });

      expect(mockProjectRepo.update).toHaveBeenCalled();
    });
  });

  describe('deleteProject', () => {
    it('should delete empty project', async () => {
      const project = { id: '1', name: 'test-project' };
      mockProjectRepo.findById.mockResolvedValue(project);
      mockBucketRepo.findByProject.mockResolvedValue([]);
      mockProjectRepo.delete.mockResolvedValue(true);

      await projectService.deleteProject('1');

      expect(mockProjectRepo.delete).toHaveBeenCalledWith('1');
    });

    it('should throw error if project has buckets', async () => {
      const project = { id: '1', name: 'test-project' };
      mockProjectRepo.findById.mockResolvedValue(project);
      mockBucketRepo.findByProject.mockResolvedValue([{ id: '1', name: 'bucket1' }]);

      await expect(projectService.deleteProject('1')).rejects.toThrow('has');
    });
  });
});
