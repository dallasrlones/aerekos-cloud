'use strict';

const { SYSTEM_PROJECT_ID } = require('../../api/config/systemProject');

describe('ProjectService.deleteProject system guard', () => {
  let ProjectService;

  beforeEach(() => {
    jest.resetModules();
    const mockRepo = {
      findById: jest.fn(),
      getProjectDeployments: jest.fn(),
      getWorkers: jest.fn(),
      flagDeploymentsAsOrphaned: jest.fn(),
      deleteAllWorkerAssociations: jest.fn(),
      deleteAllServiceAssociations: jest.fn(),
      delete: jest.fn(),
    };
    jest.doMock('../../api/repos/ProjectRepository', () => mockRepo);
    jest.doMock('../../api/services/WorkerSocketService', () => ({
      sendOrphanCleanupInstruction: jest.fn(() => false),
    }));
    jest.doMock('../../api/services/ServiceManager', () => ({}));
    jest.doMock('../../api/repos/WorkerRepository', () => ({}));
    jest.doMock('../../api/models', () => ({
      Service: {},
      ProjectService: {},
      ProjectMember: {},
    }));
    ProjectService = require('../../api/services/ProjectService');
  });

  afterEach(() => {
    jest.resetModules();
  });

  test('refuses SYSTEM_PROJECT_ID', async () => {
    await expect(ProjectService.deleteProject(SYSTEM_PROJECT_ID)).rejects.toMatchObject({
      message: 'System project cannot be deleted',
      code: 'SYSTEM_PROJECT_IMMUTABLE',
      status: 403,
    });
  });

  test('refuses project named system', async () => {
    ProjectService.projectRepository.findById.mockResolvedValue({
      id: 'other-uuid',
      name: 'System',
    });
    await expect(ProjectService.deleteProject('other-uuid')).rejects.toMatchObject({
      code: 'SYSTEM_PROJECT_IMMUTABLE',
      status: 403,
    });
    expect(ProjectService.projectRepository.delete).not.toHaveBeenCalled();
  });

  test('allows deleting a normal project', async () => {
    const id = '11111111-1111-1111-1111-111111111111';
    ProjectService.projectRepository.findById.mockResolvedValue({
      id,
      name: 'demo',
    });
    ProjectService.projectRepository.getProjectDeployments.mockResolvedValue([]);
    ProjectService.projectRepository.getWorkers.mockResolvedValue([]);
    ProjectService.projectRepository.flagDeploymentsAsOrphaned.mockResolvedValue([]);
    ProjectService.projectRepository.deleteAllWorkerAssociations.mockResolvedValue();
    ProjectService.projectRepository.deleteAllServiceAssociations.mockResolvedValue();
    ProjectService.projectRepository.delete.mockResolvedValue({ name: 'demo' });

    const result = await ProjectService.deleteProject(id);
    expect(result).toBeTruthy();
    expect(ProjectService.projectRepository.delete).toHaveBeenCalledWith(id);
  });
});
