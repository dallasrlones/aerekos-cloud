import api from '../utils/api';

/**
 * Storage Manager Service - API calls for storage manager service and storage management
 */
export const storageManagerService = {
  /**
   * Enable storage_manager service
   * @param {string} [workerId] - Optional worker ID
   * @returns {Promise<object>} Deployment result
   */
  async enable(workerId) {
    const response = await api.post('/api/services/storage_manager/enable', {
      worker_id: workerId
    });
    return response.data;
  },

  /**
   * Disable storage_manager service
   * @returns {Promise<object>} Shutdown result
   */
  async disable() {
    const response = await api.post('/api/services/storage_manager/disable');
    return response.data;
  },

  /**
   * Get storage_manager service status
   * @returns {Promise<object>} Service status
   */
  async getStatus() {
    const response = await api.get('/api/services/storage_manager/status');
    return response.data;
  },

  /**
   * Get storage_manager service metrics
   * @returns {Promise<object>} Service metrics
   */
  async getMetrics() {
    const response = await api.get('/api/services/storage_manager/metrics');
    return response.data;
  },

  /**
   * Get health status
   * @returns {Promise<object>} Health status
   */
  async getHealth() {
    const response = await api.get('/api/services/storage_manager/health');
    return response.data;
  },

  // Projects API
  /**
   * List all projects
   * @returns {Promise<object>} List of projects
   */
  async getProjects() {
    const response = await api.get('/api/services/storage_manager/api/projects');
    return response.data;
  },

  /**
   * Get project by ID
   * @param {string} projectId - Project ID
   * @returns {Promise<object>} Project details
   */
  async getProject(projectId) {
    const response = await api.get(`/api/services/storage_manager/api/projects/${projectId}`);
    return response.data;
  },

  /**
   * Create a new project
   * @param {object} projectData - Project data (name, description, metadata)
   * @returns {Promise<object>} Created project
   */
  async createProject(projectData) {
    const response = await api.post('/api/services/storage_manager/api/projects', projectData);
    return response.data;
  },

  /**
   * Update a project
   * @param {string} projectId - Project ID
   * @param {object} projectData - Updated project data
   * @returns {Promise<object>} Updated project
   */
  async updateProject(projectId, projectData) {
    const response = await api.put(`/api/services/storage_manager/api/projects/${projectId}`, projectData);
    return response.data;
  },

  /**
   * Delete a project
   * @param {string} projectId - Project ID
   * @returns {Promise<void>}
   */
  async deleteProject(projectId) {
    await api.delete(`/api/services/storage_manager/api/projects/${projectId}`);
  },

  // Buckets API
  /**
   * List buckets in a project
   * @param {string} projectId - Project ID
   * @returns {Promise<object>} List of buckets
   */
  async getBuckets(projectId) {
    const response = await api.get(`/api/services/storage_manager/api/projects/${projectId}/buckets`);
    return response.data;
  },

  /**
   * Get bucket by name
   * @param {string} projectId - Project ID
   * @param {string} bucketName - Bucket name
   * @returns {Promise<object>} Bucket details
   */
  async getBucket(projectId, bucketName) {
    const response = await api.get(`/api/services/storage_manager/api/projects/${projectId}/buckets/${bucketName}`);
    return response.data;
  },

  /**
   * Create a new bucket
   * @param {string} projectId - Project ID
   * @param {object} bucketData - Bucket data (name, description, metadata)
   * @returns {Promise<object>} Created bucket
   */
  async createBucket(projectId, bucketData) {
    const response = await api.post(`/api/services/storage_manager/api/projects/${projectId}/buckets`, bucketData);
    return response.data;
  },

  /**
   * Update a bucket
   * @param {string} projectId - Project ID
   * @param {string} bucketName - Bucket name
   * @param {object} bucketData - Updated bucket data
   * @returns {Promise<object>} Updated bucket
   */
  async updateBucket(projectId, bucketName, bucketData) {
    const response = await api.patch(`/api/services/storage_manager/api/projects/${projectId}/buckets/${bucketName}`, bucketData);
    return response.data;
  },

  /**
   * Delete a bucket
   * @param {string} projectId - Project ID
   * @param {string} bucketName - Bucket name
   * @returns {Promise<void>}
   */
  async deleteBucket(projectId, bucketName) {
    await api.delete(`/api/services/storage_manager/api/projects/${projectId}/buckets/${bucketName}`);
  },

  /**
   * Get buckets using a specific encryption key
   * @param {string} projectId - Project ID
   * @param {string} keyName - Encryption key name
   * @returns {Promise<object>} List of buckets using the key
   */
  async getBucketsByKey(projectId, keyName) {
    const response = await api.get(`/api/services/storage_manager/api/projects/${projectId}/buckets/by-key/${keyName}`);
    return response.data;
  },

  // Files API
  /**
   * List files in a bucket (S3-style with folders)
   * @param {string} projectId - Project ID
   * @param {string} bucketName - Bucket name (not ID)
   * @param {object} [options] - Query options (prefix, maxKeys, delimiter)
   * @returns {Promise<object>} List of files and folders
   */
  async getFiles(projectId, bucketName, options = {}) {
    const params = {};
    if (options.prefix) params.prefix = options.prefix;
    if (options.maxKeys) params.maxKeys = options.maxKeys;
    if (options.delimiter !== undefined) params.delimiter = options.delimiter;
    if (options.offset !== undefined) params.offset = options.offset;
    
    const response = await api.get(`/api/services/storage_manager/api/projects/${projectId}/buckets/${bucketName}/files`, { params });
    return response.data;
  },

  /**
   * Get file metadata
   * @param {string} projectId - Project ID
   * @param {string} bucketName - Bucket name
   * @param {string} key - File key/path
   * @returns {Promise<object>} File metadata
   */
  async getFileMetadata(projectId, bucketName, key) {
    const response = await api.head(`/api/services/storage_manager/api/projects/${projectId}/buckets/${bucketName}/files/${encodeURIComponent(key)}`);
    return {
      key,
      size: parseInt(response.headers['content-length'] || 0),
      content_type: response.headers['content-type'] || 'application/octet-stream',
      etag: response.headers['etag'],
      last_modified: response.headers['last-modified']
    };
  },

  /**
   * Upload a file
   * @param {string} projectId - Project ID
   * @param {string} bucketName - Bucket name
   * @param {string} key - File key/path
   * @param {File|Blob} file - File to upload
   * @param {object} [metadata] - Optional metadata
   * @param {function} [onProgress] - Progress callback
   * @returns {Promise<object>} Uploaded file details
   */
  async uploadFile(projectId, bucketName, key, file, metadata = {}, onProgress = null) {
    const formData = new FormData();
    formData.append('file', file);
    if (Object.keys(metadata).length > 0) {
      formData.append('metadata', JSON.stringify(metadata));
    }
    
    const config = {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    };
    
    // Add progress tracking if callback provided
    if (onProgress) {
      config.onUploadProgress = (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percentCompleted);
      };
    }
    
    const response = await api.post(
      `/api/services/storage_manager/api/projects/${projectId}/buckets/${bucketName}/files/${encodeURIComponent(key)}`,
      formData,
      config
    );
    return response.data;
  },

  /**
   * Download a file
   * @param {string} projectId - Project ID
   * @param {string} bucketName - Bucket name
   * @param {string} key - File key/path
   * @returns {Promise<Blob>} File blob
   */
  async downloadFile(projectId, bucketName, key) {
    const response = await api.get(
      `/api/services/storage_manager/api/projects/${projectId}/buckets/${bucketName}/files/${encodeURIComponent(key)}`,
      { responseType: 'blob' }
    );
    return response.data;
  },

  /**
   * Delete a file
   * @param {string} projectId - Project ID
   * @param {string} bucketName - Bucket name
   * @param {string} key - File key/path
   * @returns {Promise<void>}
   */
  async deleteFile(projectId, bucketName, key) {
    await api.delete(`/api/services/storage_manager/api/projects/${projectId}/buckets/${bucketName}/files/${encodeURIComponent(key)}`);
  },

  // Signed URLs API
  /**
   * Generate a signed URL for upload/download
   * @param {string} projectId - Project ID
   * @param {string} bucketName - Bucket name
   * @param {string} key - File key/path
   * @param {string} urlType - 'upload' or 'download'
   * @param {number} [ttl] - Time to live in seconds (default: 3600)
   * @returns {Promise<object>} Signed URL details
   */
  async generateSignedUrl(projectId, bucketName, key, urlType, ttl = 3600) {
    const response = await api.post(`/api/services/storage_manager/api/projects/${projectId}/buckets/${bucketName}/files/${encodeURIComponent(key)}/signed-url/${urlType}`, {
      ttl
    });
    return response.data;
  }
};
