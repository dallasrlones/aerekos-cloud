import apiClient from '../utils/api';

/**
 * Project Service - API calls for project management
 */
export const projectService = {
  /**
   * Get all available services
   */
  async getAllServices() {
    try {
      const response = await apiClient.get('/api/services');
      return {
        success: true,
        services: response.data.services || []
      };
    } catch (error) {
      console.error('Error fetching services:', error);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message || 'Failed to fetch services'
      };
    }
  },

  /**
   * Get all available workers
   */
  async getAllWorkers() {
    try {
      const response = await apiClient.get('/api/workers');
      return {
        success: true,
        workers: response.data.workers || []
      };
    } catch (error) {
      console.error('Error fetching workers:', error);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message || 'Failed to fetch workers'
      };
    }
  },
  /**
   * Get all projects
   */
  async getProjects() {
    try {
      const response = await apiClient.get('/api/projects');
      return {
        success: true,
        projects: response.data.projects || []
      };
    } catch (error) {
      console.error('Error fetching projects:', error);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message || 'Failed to fetch projects'
      };
    }
  },

  /**
   * Get project by ID
   */
  async getProject(id) {
    try {
      const response = await apiClient.get(`/api/projects/${id}`);
      return {
        success: true,
        project: response.data.project
      };
    } catch (error) {
      console.error('Error fetching project:', error);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message || 'Failed to fetch project'
      };
    }
  },

  /**
   * Create new project
   */
  async createProject(projectData) {
    try {
      const response = await apiClient.post('/api/projects', projectData);
      return {
        success: true,
        project: response.data.project,
        isFirst: response.data.project.isFirst || false
      };
    } catch (error) {
      console.error('Error creating project:', error);
      // Handle 409 Conflict (duplicate name) specifically
      if (error.response?.status === 409) {
        return {
          success: false,
          error: error.response?.data?.error?.message || 'A project with this name already exists. Please choose a different name.'
        };
      }
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message || 'Failed to create project'
      };
    }
  },

  /**
   * Update project
   */
  async updateProject(id, projectData) {
    try {
      const response = await apiClient.put(`/api/projects/${id}`, projectData);
      return {
        success: true,
        project: response.data.project
      };
    } catch (error) {
      console.error('Error updating project:', error);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message || 'Failed to update project'
      };
    }
  },

  /**
   * Delete project
   */
  async deleteProject(id) {
    try {
      const response = await apiClient.delete(`/api/projects/${id}`);
      return {
        success: true,
        ...response.data
      };
    } catch (error) {
      console.error('Error deleting project:', error);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message || 'Failed to delete project'
      };
    }
  },

  /**
   * Assign worker to project
   */
  async assignWorker(projectId, workerId) {
    try {
      const response = await apiClient.post(`/api/projects/${projectId}/workers/${workerId}`);
      return {
        success: true,
        ...response.data
      };
    } catch (error) {
      console.error('Error assigning worker:', error);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message || 'Failed to assign worker'
      };
    }
  },

  /**
   * Unassign worker from project
   */
  async unassignWorker(projectId, workerId) {
    try {
      const response = await apiClient.delete(`/api/projects/${projectId}/workers/${workerId}`);
      return {
        success: true,
        ...response.data
      };
    } catch (error) {
      console.error('Error unassigning worker:', error);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message || 'Failed to unassign worker'
      };
    }
  },

  /**
   * Assign service to project
   */
  async assignService(projectId, serviceId) {
    try {
      const response = await apiClient.post(`/api/projects/${projectId}/services/${serviceId}`);
      return {
        success: true,
        ...response.data
      };
    } catch (error) {
      console.error('Error assigning service:', error);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message || 'Failed to assign service'
      };
    }
  },

  /**
   * Unassign service from project
   */
  async unassignService(projectId, serviceId) {
    try {
      const response = await apiClient.delete(`/api/projects/${projectId}/services/${serviceId}`);
      return {
        success: true,
        ...response.data
      };
    } catch (error) {
      console.error('Error unassigning service:', error);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message || 'Failed to unassign service'
      };
    }
  },

  /**
   * Get project deployments
   */
  async getProjectDeployments(projectId) {
    try {
      const response = await apiClient.get(`/api/projects/${projectId}/deployments`);
      return {
        success: true,
        deployments: response.data.deployments || []
      };
    } catch (error) {
      console.error('Error fetching project deployments:', error);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message || 'Failed to fetch deployments'
      };
    }
  },

  /**
   * Enable service for project
   */
  async enableServiceForProject(projectId, serviceId, workerId = null) {
    try {
      const response = await apiClient.post(`/api/projects/${projectId}/services/${serviceId}/enable`, workerId ? { worker_id: workerId } : {});
      return {
        success: true,
        ...response.data
      };
    } catch (error) {
      console.error('Error enabling service:', error);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message || 'Failed to enable service'
      };
    }
  },

  async enableCoreStack(projectId) {
    const response = await apiClient.post(`/api/projects/${projectId}/enable-core-stack`);
    return response.data;
  },

  async enablePack(projectId, pack) {
    const response = await apiClient.post(`/api/setup/packs/${encodeURIComponent(pack)}`, { project_id: projectId });
    return response.data;
  },

  /**
   * Disable service for project
   */
  async disableServiceForProject(projectId, serviceId) {
    try {
      const response = await apiClient.post(`/api/projects/${projectId}/services/${serviceId}/disable`);
      return {
        success: true,
        ...response.data
      };
    } catch (error) {
      console.error('Error disabling service:', error);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message || 'Failed to disable service'
      };
    }
  },

  /**
   * Update service config for project
   */
  async updateServiceConfig(projectId, serviceId, config) {
    try {
      const response = await apiClient.put(`/api/projects/${projectId}/services/${serviceId}/config`, { config });
      return {
        success: true,
        ...response.data
      };
    } catch (error) {
      console.error('Error updating service config:', error);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message || 'Failed to update service config'
      };
    }
  },

  /**
   * Update scaling policy for project
   */
  async updateScalingPolicy(projectId, serviceId, scalingPolicy) {
    try {
      const response = await apiClient.put(`/api/projects/${projectId}/services/${serviceId}/scaling`, scalingPolicy);
      return {
        success: true,
        ...response.data
      };
    } catch (error) {
      console.error('Error updating scaling policy:', error);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message || 'Failed to update scaling policy'
      };
    }
  },

  /**
   * Get service assignments
   */
  async getServiceAssignments(projectId, serviceId) {
    try {
      const response = await apiClient.get(`/api/projects/${projectId}/services/${serviceId}/assignments`);
      return {
        success: true,
        ...response.data
      };
    } catch (error) {
      console.error('Error fetching service assignments:', error);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message || 'Failed to fetch service assignments'
      };
    }
  },

  /**
   * Get load balancer statistics
   */
  async getLoadBalancerStats(projectId, serviceId) {
    try {
      const response = await apiClient.get(`/api/projects/${projectId}/services/${serviceId}/load-balancer/statistics`);
      return {
        success: true,
        ...response.data
      };
    } catch (error) {
      console.error('Error fetching load balancer stats:', error);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message || 'Failed to fetch load balancer stats'
      };
    }
  },

  async getIacStatus(projectId) {
    const response = await apiClient.get(`/api/projects/${projectId}/iac/status`);
    return response.data;
  },

  async hookupIac(projectId, body) {
    const response = await apiClient.post(`/api/projects/${projectId}/iac/hookup`, body || {});
    return response.data;
  },

  async getEdgeStatus(projectId) {
    const response = await apiClient.get(`/api/projects/${projectId}/edge/status`);
    return response.data;
  },

  async hookupEdge(projectId) {
    const response = await apiClient.post(`/api/projects/${projectId}/edge/hookup`, {});
    return response.data;
  },

  async listEnvironments(projectId) {
    const response = await apiClient.get(`/api/projects/${projectId}/environments`);
    return response.data?.environments || [];
  },

  async createEnvironment(projectId, body) {
    const response = await apiClient.post(`/api/projects/${projectId}/environments`, body || {});
    return response.data?.environment;
  },

  async duplicateEnvironment(projectId, name, target) {
    const response = await apiClient.post(
      `/api/projects/${projectId}/environments/${encodeURIComponent(name)}/duplicate`,
      { target }
    );
    return response.data;
  },

  async listMembers(projectId) {
    const response = await apiClient.get(`/api/projects/${projectId}/members`);
    return response.data;
  },

  async addMember(projectId, body) {
    const response = await apiClient.post(`/api/projects/${projectId}/members`, body || {});
    return response.data;
  },

  async updateMemberRole(projectId, userId, role) {
    const response = await apiClient.patch(`/api/projects/${projectId}/members/${userId}`, { role });
    return response.data;
  },

  async revokeMember(projectId, userId) {
    const response = await apiClient.delete(`/api/projects/${projectId}/members/${userId}`);
    return response.data;
  },

  async listInvites(projectId) {
    const response = await apiClient.get(`/api/projects/${projectId}/invites`);
    return response.data;
  },

  async createInvite(projectId, body) {
    const response = await apiClient.post(`/api/projects/${projectId}/invites`, body || {});
    return response.data;
  },

  async revokeInvite(projectId, inviteId) {
    const response = await apiClient.delete(`/api/projects/${projectId}/invites/${inviteId}`);
    return response.data;
  },

  async acceptInvite(token) {
    const response = await apiClient.post('/api/projects/invites/accept', { token });
    return response.data;
  },

  async leaveProject(projectId) {
    const response = await apiClient.post(`/api/projects/${projectId}/members/leave`, {});
    return response.data;
  },

  async clearMembership(projectId) {
    const response = await apiClient.post(`/api/projects/${projectId}/members/clear`, {});
    return response.data;
  },
};
