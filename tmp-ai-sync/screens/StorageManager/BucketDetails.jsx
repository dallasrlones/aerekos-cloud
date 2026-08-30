import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, TextInput, Alert, ActivityIndicator, Modal, Platform } from 'react-native';
import { useProject } from '../../contexts/ProjectContext';
import { storageManagerService } from '../../services/storageManagerService';
import { chunkedUploadService } from '../../services/chunkedUploadService';
import { Box } from '../../components/Box/Box';
import { BucketDetailsStyles } from './BucketDetails.styles';

export const BucketDetails = ({ navigation, route }) => {
  const { currentProject } = useProject();
  const { projectId, bucketName, bucket: initialBucket } = route?.params || {};
  const finalProjectId = projectId || currentProject?.id;
  
  const [bucket, setBucket] = useState(initialBucket);
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [currentPrefix, setCurrentPrefix] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadKey, setUploadKey] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  
  // Selection state
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (finalProjectId && bucketName) {
      loadBucket();
      setPage(1); // Reset to first page when prefix changes
      setSelectedFiles(new Set()); // Clear selection when prefix changes
      loadFiles();
    }
  }, [finalProjectId, bucketName, currentPrefix]);

  useEffect(() => {
    if (finalProjectId && bucketName) {
      loadFiles();
    }
  }, [page]);

  const loadBucket = async () => {
    if (!finalProjectId || !bucketName) return;
    
    try {
      const bucketData = await storageManagerService.getBucket(finalProjectId, bucketName);
      setBucket(bucketData);
    } catch (err) {
      console.error('Error loading bucket:', err);
    }
  };

  const loadFiles = async (resetPage = false) => {
    if (!finalProjectId || !bucketName) {
      setError('Project and bucket required');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const currentPage = resetPage ? 1 : page;
      const offset = (currentPage - 1) * pageSize;
      
      const response = await storageManagerService.getFiles(finalProjectId, bucketName, {
        prefix: currentPrefix,
        maxKeys: pageSize,
        delimiter: '/',
        offset
      });
      
      // Handle response structure - check for both possible formats
      if (Array.isArray(response)) {
        // If response is an array, it's just files
        setFiles(response);
        setFolders([]);
        setHasMore(response.length === pageSize);
        setTotalCount(response.length);
      } else {
        // Response is an object with files and folders
        const allItems = (response.files || []).concat(response.folders || []);
        setFiles(response.files || []);
        setFolders(response.folders || []);
        setHasMore(allItems.length === pageSize);
        setTotalCount(response.count || allItems.length);
      }
      
      if (resetPage) {
        setPage(1);
      }
    } catch (err) {
      console.error('Error loading files:', err);
      setError(err.message || 'Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadBucket(), loadFiles()]);
    setRefreshing(false);
  };

  const handleFolderClick = (folder) => {
    setCurrentPrefix(folder.prefix);
  };

  const handleFileClick = (file) => {
    navigation.navigate('fileDetails', {
      projectId: finalProjectId,
      bucketName,
      key: file.key,
      file
    });
  };

  const handleBackFolder = () => {
    if (currentPrefix) {
      const parts = currentPrefix.split('/').filter(p => p);
      parts.pop(); // Remove last folder
      setCurrentPrefix(parts.length > 0 ? parts.join('/') + '/' : '');
    }
  };

  const handleFileSelect = () => {
    console.log('[handleFileSelect] Called');
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      try {
        // Create file input element for web
        const input = document.createElement('input');
        input.type = 'file';
        input.style.display = 'none';
        input.style.position = 'absolute';
        input.style.left = '-9999px';
        input.style.opacity = '0';
        input.style.width = '0';
        input.style.height = '0';
        
        // Set up change handler BEFORE appending to DOM
        input.onchange = (event) => {
          console.log('[handleFileSelect] File selected');
          try {
            const file = event.target?.files?.[0];
            if (file) {
              console.log('[handleFileSelect] File:', file.name);
              setSelectedFile(file);
              // Auto-generate key based on current prefix
              const key = currentPrefix + file.name;
              setUploadKey(key);
              setShowUploadModal(true);
            }
          } catch (err) {
            console.error('Error handling file selection:', err);
            Alert.alert('Error', 'Failed to select file');
          } finally {
            // Clean up: remove input from DOM after selection
            setTimeout(() => {
              if (input.parentNode) {
                input.parentNode.removeChild(input);
              }
            }, 100);
          }
        };
        
        // Handle cancellation (user closes dialog without selecting)
        input.oncancel = () => {
          console.log('[handleFileSelect] Dialog cancelled');
          setTimeout(() => {
            if (input.parentNode) {
              input.parentNode.removeChild(input);
            }
          }, 100);
        };
        
        // Append to body FIRST, then click
        document.body.appendChild(input);
        console.log('[handleFileSelect] Input appended, clicking...');
        
        // Click immediately - no setTimeout needed
        input.click();
        console.log('[handleFileSelect] Click triggered');
      } catch (err) {
        console.error('Error creating file input:', err);
        Alert.alert('Error', 'Failed to open file picker');
      }
    } else {
      // For React Native, you'd use a file picker library
      Alert.alert('Upload', 'File upload on mobile coming soon');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !uploadKey.trim()) {
      Alert.alert('Error', 'Please select a file and enter a key');
      return;
    }

    if (!finalProjectId || !bucketName) {
      Alert.alert('Error', 'Project and bucket are required');
      return;
    }

    // Validate key doesn't contain invalid characters
    if (uploadKey.includes('//') || uploadKey.startsWith('/')) {
      Alert.alert('Error', 'Invalid key format. Keys should not start with / or contain //');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadedBytes(0);
    setTotalBytes(selectedFile.size);

    try {
      await chunkedUploadService.uploadFile(
        finalProjectId,
        bucketName,
        uploadKey.trim(),
        selectedFile,
        {
          content_type: selectedFile.type || 'application/octet-stream'
        },
        (percent, uploaded, total) => {
          setUploadProgress(percent);
          setUploadedBytes(uploaded);
          setTotalBytes(total);
        },
        (chunkNumber, totalChunks) => {
          console.log(`Uploading chunk ${chunkNumber}/${totalChunks}`);
        }
      );

      Alert.alert('Success', 'File uploaded successfully');
      setShowUploadModal(false);
      setSelectedFile(null);
      setUploadKey('');
      await loadFiles();
    } catch (err) {
      console.error('Error uploading file:', err);
      Alert.alert('Error', `Failed to upload file: ${err.message}`);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadedBytes(0);
      setTotalBytes(0);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      Alert.alert('Error', 'Please enter a folder name');
      return;
    }

    if (!finalProjectId || !bucketName) {
      Alert.alert('Error', 'Project and bucket are required');
      return;
    }

    // Validate folder name
    const folderName = newFolderName.trim();
    if (folderName.includes('/') || folderName.includes('\\')) {
      Alert.alert('Error', 'Folder name cannot contain slashes');
      return;
    }

    setCreatingFolder(true);

    try {
      // Create folder by uploading an empty marker file
      // S3-style: folders are implicit, but we can create a marker
      const folderKey = currentPrefix + folderName + '/.folder-marker';
      const emptyBlob = new Blob([''], { type: 'text/plain' });
      
      await chunkedUploadService.uploadFile(
        finalProjectId,
        bucketName,
        folderKey,
        emptyBlob,
        {
          content_type: 'text/plain',
          folder_marker: true
        }
      );

      Alert.alert('Success', `Folder "${folderName}" created successfully`);
      setShowFolderModal(false);
      setNewFolderName('');
      await loadFiles();
    } catch (err) {
      console.error('Error creating folder:', err);
      Alert.alert('Error', `Failed to create folder: ${err.message}`);
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleFileSelectToggle = (fileKey) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(fileKey)) {
      newSelected.delete(fileKey);
    } else {
      newSelected.add(fileKey);
    }
    setSelectedFiles(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(files.map(f => f.key)));
    }
  };

  const handleDeleteFile = async (file) => {
    Alert.alert(
      'Delete File',
      `Are you sure you want to delete "${file.name || file.key}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await storageManagerService.deleteFile(finalProjectId, bucketName, file.key);
              await loadFiles();
            } catch (err) {
              Alert.alert('Error', `Failed to delete file: ${err.message}`);
            }
          }
        }
      ]
    );
  };

  const handleBulkDeleteClick = () => {
    if (selectedFiles.size === 0) return;
    setShowDeleteModal(true);
  };

  const handleBulkDeleteConfirm = async () => {
    if (selectedFiles.size === 0) return;

    setDeleting(true);
    try {
      const fileKeys = Array.from(selectedFiles);
      const deletePromises = fileKeys.map(key =>
        storageManagerService.deleteFile(finalProjectId, bucketName, key)
      );
      
      await Promise.all(deletePromises);
      
      setShowDeleteModal(false);
      setSelectedFiles(new Set());
      Alert.alert('Success', `Deleted ${fileKeys.length} file(s) successfully`);
      await loadFiles(true);
    } catch (err) {
      console.error('Error deleting files:', err);
      Alert.alert('Error', `Failed to delete files: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDeleteCancel = () => {
    setShowDeleteModal(false);
  };

  const handlePreviousPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  const handleNextPage = () => {
    if (hasMore) {
      setPage(page + 1);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getBreadcrumbs = () => {
    const parts = currentPrefix.split('/').filter(p => p);
    return [
      { name: bucketName, prefix: '' },
      ...parts.map((part, index) => ({
        name: part,
        prefix: parts.slice(0, index + 1).join('/') + '/'
      }))
    ];
  };

  if (!finalProjectId || !bucketName) {
    return (
      <View style={BucketDetailsStyles.container}>
        <View style={BucketDetailsStyles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={BucketDetailsStyles.backButton}
          >
            <Text style={BucketDetailsStyles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={BucketDetailsStyles.title}>Bucket Details</Text>
        </View>
        <Box>
          <Text style={BucketDetailsStyles.errorText}>
            Project and bucket required
          </Text>
        </Box>
      </View>
    );
  }

  return (
    <View style={BucketDetailsStyles.container}>
      {/* Header */}
      <View style={BucketDetailsStyles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={BucketDetailsStyles.backButton}
        >
          <Text style={BucketDetailsStyles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={BucketDetailsStyles.title}>{bucketName}</Text>
        <View style={BucketDetailsStyles.headerActions}>
          <TouchableOpacity
            onPress={() => setShowFolderModal(true)}
            style={BucketDetailsStyles.folderButton}
          >
            <Text style={BucketDetailsStyles.folderButtonText}>📁 New Folder</Text>
          </TouchableOpacity>
          {Platform.OS === 'web' ? (
            <div
              onClick={handleFileSelect}
              style={{
                backgroundColor: '#2C2C2C',
                paddingLeft: 16,
                paddingRight: 16,
                paddingTop: 8,
                paddingBottom: 8,
                borderRadius: 8,
                cursor: 'pointer',
                userSelect: 'none',
                display: 'inline-block',
              }}
            >
              <span style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>📤 Upload</span>
            </div>
          ) : (
            <TouchableOpacity
              onPress={handleFileSelect}
              style={BucketDetailsStyles.uploadButton}
            >
              <Text style={BucketDetailsStyles.uploadButtonText}>📤 Upload</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Bucket Info */}
      {bucket && (
        <Box style={BucketDetailsStyles.bucketInfo}>
          <View style={BucketDetailsStyles.bucketInfoRow}>
            <Text style={BucketDetailsStyles.bucketInfoLabel}>Encryption:</Text>
            <Text style={BucketDetailsStyles.bucketInfoValue}>
              {bucket.encryption_key_name ? '✓ Enabled' : 'Disabled'}
            </Text>
          </View>
          <View style={BucketDetailsStyles.bucketInfoRow}>
            <Text style={BucketDetailsStyles.bucketInfoLabel}>Created:</Text>
            <Text style={BucketDetailsStyles.bucketInfoValue}>
              {new Date(bucket.created_at).toLocaleString()}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              navigation.navigate('bucketConfig', {
                projectId: finalProjectId,
                bucketName,
                bucket
              });
            }}
            style={BucketDetailsStyles.configButton}
          >
            <Text style={BucketDetailsStyles.configButtonText}>⚙️ Configure Bucket</Text>
          </TouchableOpacity>
        </Box>
      )}

      {/* Breadcrumbs */}
      {currentPrefix && (
        <View style={BucketDetailsStyles.breadcrumbs}>
          {getBreadcrumbs().map((crumb, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => setCurrentPrefix(crumb.prefix)}
              style={BucketDetailsStyles.breadcrumbItem}
            >
              <Text style={BucketDetailsStyles.breadcrumbText}>{crumb.name}</Text>
              {index < getBreadcrumbs().length - 1 && (
                <Text style={BucketDetailsStyles.breadcrumbSeparator}> / </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Error Message */}
      {error && (
        <Box style={BucketDetailsStyles.errorBox}>
          <Text style={BucketDetailsStyles.errorText}>{error}</Text>
        </Box>
      )}

      {/* Bulk Actions Bar */}
      {selectedFiles.size > 0 && (
        <View style={BucketDetailsStyles.bulkActionsBar}>
          <Text style={BucketDetailsStyles.bulkActionsText}>
            {selectedFiles.size} file{selectedFiles.size !== 1 ? 's' : ''} selected
          </Text>
          <TouchableOpacity
            onPress={handleBulkDeleteClick}
            style={BucketDetailsStyles.bulkDeleteButton}
          >
            <Text style={BucketDetailsStyles.bulkDeleteButtonText}>🗑️ Delete Selected</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSelectedFiles(new Set())}
            style={BucketDetailsStyles.bulkCancelButton}
          >
            <Text style={BucketDetailsStyles.bulkCancelButtonText}>✕ Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Files and Folders List */}
      <ScrollView
        style={BucketDetailsStyles.list}
        contentContainerStyle={BucketDetailsStyles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        scrollEnabled={true}
        nestedScrollEnabled={true}
      >
        {loading ? (
          <View style={BucketDetailsStyles.loadingContainer}>
            <ActivityIndicator size="large" color="#2C2C2C" />
            <Text style={BucketDetailsStyles.loadingText}>Loading files...</Text>
          </View>
        ) : (
          <>
            {/* Select All Checkbox */}
            {files.length > 0 && (
              <View style={BucketDetailsStyles.selectAllContainer}>
                <TouchableOpacity
                  onPress={handleSelectAll}
                  style={BucketDetailsStyles.selectAllCheckbox}
                >
                  <Text style={BucketDetailsStyles.checkboxText}>
                    {selectedFiles.size === files.length ? '☑' : '☐'} Select All
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Folders */}
            {folders.map((folder) => {
              const handleClick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Folder clicked:', folder);
                handleFolderClick(folder);
              };
              
              if (Platform.OS === 'web') {
                return (
                  <div
                    key={folder.key || folder.prefix}
                    style={{
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: '#fff',
                      padding: 16,
                      marginBottom: 12,
                      borderRadius: 12,
                      border: '1px solid #e0e0e0',
                      cursor: 'pointer',
                      userSelect: 'none',
                      position: 'relative',
                      zIndex: 1,
                    }}
                    onClick={handleClick}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', flex: 1, pointerEvents: 'none' }}>
                      <span style={{ fontSize: 32, marginRight: 12, pointerEvents: 'none' }}>📁</span>
                      <div style={{ flex: 1, pointerEvents: 'none' }}>
                        <div style={{ fontSize: 16, fontWeight: '600', color: '#2C2C2C', marginBottom: 4, pointerEvents: 'none' }}>
                          {folder.name || folder.prefix}
                        </div>
                        <div style={{ fontSize: 12, color: '#666', pointerEvents: 'none' }}>Folder</div>
                      </div>
                    </div>
                    <span style={{ fontSize: 20, color: '#666', marginLeft: 12, pointerEvents: 'none' }}>→</span>
                  </div>
                );
              }
              
              return (
                <TouchableOpacity
                  key={folder.key || folder.prefix}
                  style={BucketDetailsStyles.itemCard}
                  onPress={() => {
                    console.log('Folder clicked:', folder);
                    handleFolderClick(folder);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[BucketDetailsStyles.itemContent, { pointerEvents: 'none' }]}>
                    <Text style={BucketDetailsStyles.folderIcon}>📁</Text>
                    <View style={BucketDetailsStyles.itemInfo}>
                      <Text style={BucketDetailsStyles.itemName}>{folder.name || folder.prefix}</Text>
                      <Text style={BucketDetailsStyles.itemType}>Folder</Text>
                    </View>
                  </View>
                  <Text style={[BucketDetailsStyles.itemArrow, { pointerEvents: 'none' }]}>→</Text>
                </TouchableOpacity>
              );
            })}

            {/* Files */}
            {files.map((file) => {
              const isSelected = selectedFiles.has(file.key);
              
              const handleClick = (e) => {
                e.stopPropagation();
                if (selectedFiles.size > 0) {
                  // If in selection mode, toggle selection
                  handleFileSelectToggle(file.key);
                } else {
                  // Otherwise, navigate to file details
                  console.log('File clicked:', file);
                  handleFileClick(file);
                }
              };
              
              const handleCheckboxClick = (e) => {
                e.stopPropagation();
                handleFileSelectToggle(file.key);
              };
              
              const handleContextMenu = (e) => {
                e.preventDefault();
                handleDeleteFile(file);
              };
              
              if (Platform.OS === 'web') {
                return (
                  <div
                    key={file.key}
                    style={{
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: isSelected ? '#e3f2fd' : '#fff',
                      padding: 16,
                      marginBottom: 12,
                      borderRadius: 12,
                      border: isSelected ? '2px solid #2C2C2C' : '1px solid #e0e0e0',
                      cursor: 'pointer',
                      userSelect: 'none',
                      position: 'relative',
                      zIndex: 1,
                    }}
                    onClick={handleClick}
                    onContextMenu={handleContextMenu}
                  >
                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <span
                        onClick={handleCheckboxClick}
                        style={{
                          fontSize: 20,
                          marginRight: 12,
                          cursor: 'pointer',
                          userSelect: 'none',
                        }}
                      >
                        {isSelected ? '☑' : '☐'}
                      </span>
                      <span style={{ fontSize: 32, marginRight: 12, pointerEvents: 'none' }}>
                        {file.content_type?.startsWith('image/') ? '🖼️' :
                         file.content_type?.startsWith('video/') ? '🎥' :
                         file.content_type?.startsWith('audio/') ? '🎵' :
                         file.content_type?.includes('pdf') ? '📄' :
                         file.content_type?.includes('zip') || file.content_type?.includes('tar') ? '📦' :
                         '📄'}
                      </span>
                      <div style={{ flex: 1, pointerEvents: 'none' }}>
                        <div style={{ fontSize: 16, fontWeight: '600', color: '#2C2C2C', marginBottom: 4, pointerEvents: 'none' }}>
                          {file.name || file.key}
                        </div>
                        <div style={{ fontSize: 12, color: '#666', pointerEvents: 'none' }}>
                          {formatFileSize(file.size)} • {new Date(file.last_modified).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    {selectedFiles.size === 0 && (
                      <span style={{ fontSize: 20, color: '#666', marginLeft: 12, pointerEvents: 'none' }}>→</span>
                    )}
                  </div>
                );
              }
              
              return (
                <TouchableOpacity
                  key={file.key}
                  style={[
                    BucketDetailsStyles.itemCard,
                    isSelected && BucketDetailsStyles.itemCardSelected
                  ]}
                  onPress={() => {
                    if (selectedFiles.size > 0) {
                      handleFileSelectToggle(file.key);
                    } else {
                      console.log('File clicked:', file);
                      handleFileClick(file);
                    }
                  }}
                  onLongPress={() => handleDeleteFile(file)}
                  activeOpacity={0.7}
                >
                  <View style={BucketDetailsStyles.itemContent}>
                    <TouchableOpacity
                      onPress={() => handleFileSelectToggle(file.key)}
                      style={BucketDetailsStyles.checkbox}
                    >
                      <Text style={BucketDetailsStyles.checkboxText}>
                        {isSelected ? '☑' : '☐'}
                      </Text>
                    </TouchableOpacity>
                    <Text style={BucketDetailsStyles.fileIcon}>
                      {file.content_type?.startsWith('image/') ? '🖼️' :
                       file.content_type?.startsWith('video/') ? '🎥' :
                       file.content_type?.startsWith('audio/') ? '🎵' :
                       file.content_type?.includes('pdf') ? '📄' :
                       file.content_type?.includes('zip') || file.content_type?.includes('tar') ? '📦' :
                       '📄'}
                    </Text>
                    <View style={BucketDetailsStyles.itemInfo}>
                      <Text style={BucketDetailsStyles.itemName}>{file.name || file.key}</Text>
                      <Text style={BucketDetailsStyles.itemMeta}>
                        {formatFileSize(file.size)} • {new Date(file.last_modified).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                  {selectedFiles.size === 0 && (
                    <Text style={BucketDetailsStyles.itemArrow}>→</Text>
                  )}
                </TouchableOpacity>
              );
            })}

            {/* Pagination Controls */}
            {(page > 1 || hasMore) && (
              <View style={BucketDetailsStyles.paginationContainer}>
                <TouchableOpacity
                  onPress={handlePreviousPage}
                  disabled={page === 1}
                  style={[
                    BucketDetailsStyles.paginationButton,
                    page === 1 && BucketDetailsStyles.paginationButtonDisabled
                  ]}
                >
                  <Text style={BucketDetailsStyles.paginationButtonText}>← Previous</Text>
                </TouchableOpacity>
                <Text style={BucketDetailsStyles.paginationInfo}>
                  Page {page} {totalCount > 0 && `(${totalCount} items)`}
                </Text>
                <TouchableOpacity
                  onPress={handleNextPage}
                  disabled={!hasMore}
                  style={[
                    BucketDetailsStyles.paginationButton,
                    !hasMore && BucketDetailsStyles.paginationButtonDisabled
                  ]}
                >
                  <Text style={BucketDetailsStyles.paginationButtonText}>Next →</Text>
                </TouchableOpacity>
              </View>
            )}

            {folders.length === 0 && files.length === 0 && !loading && (
              <View style={BucketDetailsStyles.emptyContainer}>
                <Text style={BucketDetailsStyles.emptyText}>
                  {currentPrefix ? 'This folder is empty' : 'This bucket is empty'}
                </Text>
                {Platform.OS === 'web' ? (
                  <div
                    onClick={handleFileSelect}
                    style={{
                      backgroundColor: '#2C2C2C',
                      paddingLeft: 16,
                      paddingRight: 16,
                      paddingTop: 8,
                      paddingBottom: 8,
                      borderRadius: 8,
                      cursor: 'pointer',
                      userSelect: 'none',
                      display: 'inline-block',
                    }}
                  >
                    <span style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Upload Your First File</span>
                  </div>
                ) : (
                  <TouchableOpacity
                    onPress={handleFileSelect}
                    style={BucketDetailsStyles.emptyButton}
                  >
                    <Text style={BucketDetailsStyles.emptyButtonText}>Upload Your First File</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Upload Modal */}
      {showUploadModal && (
        <Modal
          visible={showUploadModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => !uploading && setShowUploadModal(false)}
        >
          <View style={BucketDetailsStyles.modalOverlay}>
            <View style={BucketDetailsStyles.modalContent}>
              <Text style={BucketDetailsStyles.modalTitle}>Upload File</Text>
              
              {selectedFile && (
                <View style={BucketDetailsStyles.uploadFileInfo}>
                  <Text style={BucketDetailsStyles.uploadFileName}>{selectedFile.name}</Text>
                  <Text style={BucketDetailsStyles.uploadFileSize}>
                    {formatFileSize(selectedFile.size)}
                  </Text>
                </View>
              )}

              <TextInput
                style={BucketDetailsStyles.modalInput}
                placeholder="File key/path (e.g., folder/file.jpg)"
                value={uploadKey}
                onChangeText={setUploadKey}
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor="#999"
                editable={!uploading}
              />

              {uploading && (
                <View style={BucketDetailsStyles.progressContainer}>
                  <View style={BucketDetailsStyles.progressBar}>
                    <View
                      style={[
                        BucketDetailsStyles.progressFill,
                        { width: `${uploadProgress}%` }
                      ]}
                    />
                  </View>
                  <Text style={BucketDetailsStyles.progressText}>
                    {uploadProgress}% ({formatFileSize(uploadedBytes)} / {formatFileSize(totalBytes)})
                  </Text>
                </View>
              )}

              <View style={BucketDetailsStyles.modalButtons}>
                <TouchableOpacity
                  onPress={() => {
                    if (!uploading) {
                      setShowUploadModal(false);
                      setSelectedFile(null);
                      setUploadKey('');
                    }
                  }}
                  disabled={uploading}
                  style={[
                    BucketDetailsStyles.modalButton,
                    BucketDetailsStyles.modalButtonCancel,
                    uploading && BucketDetailsStyles.modalButtonDisabled
                  ]}
                >
                  <Text style={BucketDetailsStyles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleUpload}
                  disabled={uploading || !selectedFile || !uploadKey.trim()}
                  style={[
                    BucketDetailsStyles.modalButton,
                    BucketDetailsStyles.modalButtonUpload,
                    (uploading || !selectedFile || !uploadKey.trim()) && BucketDetailsStyles.modalButtonDisabled
                  ]}
                >
                  <Text style={BucketDetailsStyles.modalButtonText}>
                    {uploading ? 'Uploading...' : 'Upload'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Bulk Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleBulkDeleteCancel}
      >
        <View style={BucketDetailsStyles.modalOverlay}>
          <View style={BucketDetailsStyles.modalContent}>
            <Text style={BucketDetailsStyles.modalTitle}>Delete Files</Text>
            <Text style={BucketDetailsStyles.modalMessage}>
              Are you sure you want to delete {selectedFiles.size} file{selectedFiles.size !== 1 ? 's' : ''}?
            </Text>
            <Text style={BucketDetailsStyles.modalWarning}>
              This action cannot be undone. The selected files will be permanently deleted.
            </Text>
            <View style={BucketDetailsStyles.modalButtons}>
              <TouchableOpacity
                onPress={handleBulkDeleteCancel}
                disabled={deleting}
                style={[BucketDetailsStyles.modalButton, BucketDetailsStyles.modalButtonCancel]}
              >
                <Text style={BucketDetailsStyles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleBulkDeleteConfirm}
                disabled={deleting}
                style={[BucketDetailsStyles.modalButton, BucketDetailsStyles.modalButtonDelete]}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[BucketDetailsStyles.modalButtonText, BucketDetailsStyles.modalButtonDeleteText]}>
                    Delete
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create Folder Modal */}
      {showFolderModal && (
        <Modal
          visible={showFolderModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => !creatingFolder && setShowFolderModal(false)}
        >
          <View 
            style={BucketDetailsStyles.modalOverlay}
            onStartShouldSetResponder={() => true}
            onResponderRelease={(e) => {
              // Close modal if clicking on overlay (not content)
              if (e.nativeEvent.target === e.target && !creatingFolder) {
                setShowFolderModal(false);
                setNewFolderName('');
              }
            }}
            {...(Platform.OS === 'web' && {
              onClick: (e) => {
                // Close modal if clicking on overlay (not content)
                if (e.target === e.currentTarget && !creatingFolder) {
                  setShowFolderModal(false);
                  setNewFolderName('');
                }
              },
            })}
          >
            <View 
              style={BucketDetailsStyles.modalContent}
              onStartShouldSetResponder={() => false}
              {...(Platform.OS === 'web' && {
                onClick: (e) => {
                  // Stop propagation so clicks inside don't close modal
                  e.stopPropagation();
                },
              })}
            >
              <Text style={BucketDetailsStyles.modalTitle}>Create Folder</Text>
              
              <TextInput
                style={BucketDetailsStyles.modalInput}
                placeholder="Folder name"
                value={newFolderName}
                onChangeText={setNewFolderName}
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor="#999"
                editable={!creatingFolder}
                autoFocus={Platform.OS !== 'web'}
                {...(Platform.OS === 'web' && {
                  onFocus: (e) => {
                    // Ensure focus works on web
                    if (e && e.target) {
                      e.target.focus();
                    }
                  },
                  onMouseDown: (e) => {
                    // Prevent event from bubbling up
                    e.stopPropagation();
                  },
                  onClick: (e) => {
                    // Ensure click works
                    e.stopPropagation();
                  },
                })}
              />

              <View style={BucketDetailsStyles.modalButtons}>
                <TouchableOpacity
                  onPress={() => {
                    if (!creatingFolder) {
                      setShowFolderModal(false);
                      setNewFolderName('');
                    }
                  }}
                  disabled={creatingFolder}
                  style={[
                    BucketDetailsStyles.modalButton,
                    BucketDetailsStyles.modalButtonCancel,
                    creatingFolder && BucketDetailsStyles.modalButtonDisabled
                  ]}
                >
                  <Text style={BucketDetailsStyles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleCreateFolder}
                  disabled={creatingFolder || !newFolderName.trim()}
                  style={[
                    BucketDetailsStyles.modalButton,
                    BucketDetailsStyles.modalButtonUpload,
                    (creatingFolder || !newFolderName.trim()) && BucketDetailsStyles.modalButtonDisabled
                  ]}
                >
                  <Text style={BucketDetailsStyles.modalButtonText}>
                    {creatingFolder ? 'Creating...' : 'Create'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

