import api from '../utils/api';

/**
 * Robust Chunked Upload Service with retry logic and signed URLs
 */
export const chunkedUploadService = {
  CHUNK_SIZE: 5 * 1024 * 1024, // 5MB chunks
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 second

  /**
   * Upload file with chunked upload and signed URLs
   * @param {string} projectId - Project ID
   * @param {string} bucketName - Bucket name
   * @param {string} key - File key/path
   * @param {File|Blob} file - File to upload
   * @param {object} metadata - File metadata
   * @param {function} onProgress - Progress callback (percent, uploaded, total)
   * @param {function} onChunkProgress - Chunk progress callback (chunkNumber, totalChunks)
   * @returns {Promise<object>} Upload result
   */
  async uploadFile(projectId, bucketName, key, file, metadata = {}, onProgress = null, onChunkProgress = null) {
    // Validate inputs
    if (!projectId || !bucketName || !key || !file) {
      throw new Error('Missing required parameters: projectId, bucketName, key, and file are required');
    }

    const fileSize = file.size;
    const chunkSize = this.CHUNK_SIZE;
    const totalChunks = Math.ceil(fileSize / chunkSize);

    // For small files (< chunk size), use direct upload with signed URL
    if (fileSize <= chunkSize) {
      return await this.uploadSmallFile(projectId, bucketName, key, file, metadata, onProgress);
    }

    // For large files, use chunked upload
    return await this.uploadLargeFile(
      projectId,
      bucketName,
      key,
      file,
      metadata,
      chunkSize,
      totalChunks,
      onProgress,
      onChunkProgress
    );
  },

  /**
   * Upload small file directly with signed URL
   */
  async uploadSmallFile(projectId, bucketName, key, file, metadata, onProgress) {
    // Validate inputs
    if (!projectId || !bucketName || !key || !file) {
      throw new Error('Missing required parameters: projectId, bucketName, key, and file are required');
    }

    try {
      // Get signed upload URL
      const signedUrlResponse = await api.post(
        `/api/services/storage_manager/api/projects/${projectId}/buckets/${bucketName}/files/${encodeURIComponent(key)}/signed-url/upload`,
        {
          ttl_seconds: 3600,
          metadata: {
            ...metadata,
            content_type: file.type || 'application/octet-stream'
          }
        }
      );

      const signedUrl = signedUrlResponse.data.url;

      // Upload to signed URL using PUT with progress tracking
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        // Track upload progress
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable && onProgress) {
            const percent = Math.round((e.loaded / e.total) * 100);
            onProgress(percent, e.loaded, e.total);
          }
        });
        
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            let result;
            try {
              result = JSON.parse(xhr.responseText);
            } catch (e) {
              result = {
                success: true,
                key,
                size: file.size
              };
            }
            resolve(result);
          } else {
            let errorMessage = `Upload failed: ${xhr.statusText}`;
            try {
              const errorJson = JSON.parse(xhr.responseText);
              errorMessage = errorJson.error?.message || errorMessage;
            } catch (e) {
              // Use default error message
            }
            reject(new Error(errorMessage));
          }
        });
        
        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'));
        });
        
        xhr.addEventListener('abort', () => {
          reject(new Error('Upload aborted'));
        });
        
        xhr.open('PUT', signedUrl);
        xhr.setRequestHeader('Content-Type', file.type || metadata.content_type || 'application/octet-stream');
        xhr.send(file);
      });
    } catch (error) {
      console.error('Error uploading small file:', error);
      throw error;
    }
  },

  /**
   * Upload large file with chunked upload
   */
  async uploadLargeFile(projectId, bucketName, key, file, metadata, chunkSize, totalChunks, onProgress, onChunkProgress) {
    let uploadId = null;
    let fileId = null;

    try {
      // Step 1: Initiate chunked upload
      const initiateResponse = await api.post(
        `/api/services/storage_manager/api/projects/${projectId}/buckets/${bucketName}/files/${encodeURIComponent(key)}/upload/initiate`,
        {
          total_size: file.size,
          chunk_size: chunkSize,
          metadata: {
            ...metadata,
            content_type: file.type || 'application/octet-stream'
          }
        }
      );

      uploadId = initiateResponse.data.upload_id;
      fileId = initiateResponse.data.file_id;

      // Step 2: Upload chunks with retry logic
      const chunkETags = [];
      let uploadedBytes = 0;

      for (let chunkNumber = 1; chunkNumber <= totalChunks; chunkNumber++) {
        const start = (chunkNumber - 1) * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);

        // Upload chunk with retry
        const chunkResult = await this.uploadChunkWithRetry(
          projectId,
          bucketName,
          key,
          uploadId,
          chunkNumber,
          chunk,
          chunkETags
        );

        chunkETags.push(chunkResult.etag);
        uploadedBytes += chunk.size;

        // Update progress
        if (onProgress) {
          const percent = Math.round((uploadedBytes / file.size) * 100);
          onProgress(percent, uploadedBytes, file.size);
        }

        if (onChunkProgress) {
          onChunkProgress(chunkNumber, totalChunks);
        }
      }

      // Step 3: Complete chunked upload
      const completeResponse = await api.post(
        `/api/services/storage_manager/api/projects/${projectId}/buckets/${bucketName}/files/${encodeURIComponent(key)}/upload/${uploadId}/complete`,
        {
          chunk_etags: chunkETags
        }
      );

      if (onProgress) {
        onProgress(100, file.size, file.size);
      }

      return {
        success: true,
        upload_id: uploadId,
        file_id: fileId,
        key,
        size: file.size,
        etag: completeResponse.data.etag
      };
    } catch (error) {
      // Abort upload on error
      if (uploadId) {
        try {
          await api.delete(
            `/api/services/storage_manager/api/projects/${projectId}/buckets/${bucketName}/files/${encodeURIComponent(key)}/upload/${uploadId}`
          );
        } catch (abortError) {
          console.error('Error aborting upload:', abortError);
        }
      }

      throw error;
    }
  },

  /**
   * Upload chunk with retry logic
   */
  async uploadChunkWithRetry(projectId, bucketName, key, uploadId, chunkNumber, chunk, chunkETags, retryCount = 0) {
    try {
      const formData = new FormData();
      formData.append('chunk', chunk);

      const response = await api.put(
        `/api/services/storage_manager/api/projects/${projectId}/buckets/${bucketName}/files/${encodeURIComponent(key)}/upload/${uploadId}/chunk/${chunkNumber}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      return response.data;
    } catch (error) {
      if (retryCount < this.MAX_RETRIES) {
        // Exponential backoff
        const delay = this.RETRY_DELAY * Math.pow(2, retryCount);
        await new Promise(resolve => setTimeout(resolve, delay));

        console.log(`Retrying chunk ${chunkNumber}, attempt ${retryCount + 1}/${this.MAX_RETRIES}`);
        return await this.uploadChunkWithRetry(
          projectId,
          bucketName,
          key,
          uploadId,
          chunkNumber,
          chunk,
          chunkETags,
          retryCount + 1
        );
      }

      throw new Error(`Failed to upload chunk ${chunkNumber} after ${this.MAX_RETRIES} retries: ${error.message}`);
    }
  },

  /**
   * Get upload status
   */
  async getUploadStatus(projectId, bucketName, key, uploadId) {
    const response = await api.get(
      `/api/services/storage_manager/api/projects/${projectId}/buckets/${bucketName}/files/${encodeURIComponent(key)}/upload/${uploadId}/status`
    );
    return response.data;
  },

  /**
   * Abort upload
   */
  async abortUpload(projectId, bucketName, key, uploadId) {
    await api.delete(
      `/api/services/storage_manager/api/projects/${projectId}/buckets/${bucketName}/files/${encodeURIComponent(key)}/upload/${uploadId}`
    );
  }
};

