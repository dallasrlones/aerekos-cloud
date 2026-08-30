import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform, Modal, Image } from 'react-native';
import { storageManagerService } from '../../services/storageManagerService';
import { Box } from '../../components/Box/Box';
import { FileDetailsStyles } from './FileDetails.styles';

export const FileDetails = ({ navigation, route }) => {
  const { projectId, bucketName, key, file: initialFile } = route?.params || {};
  
  const [file, setFile] = useState(initialFile);
  const [loading, setLoading] = useState(!initialFile);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [error, setError] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (projectId && bucketName && key && !initialFile) {
      loadFileMetadata();
    }
  }, [projectId, bucketName, key]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl && Platform.OS === 'web' && typeof window !== 'undefined') {
        window.URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const loadFileMetadata = async () => {
    if (!projectId || !bucketName || !key) return;

    try {
      setLoading(true);
      setError(null);
      const metadata = await storageManagerService.getFileMetadata(projectId, bucketName, key);
      setFile(metadata);
    } catch (err) {
      console.error('Error loading file metadata:', err);
      setError(err.message || 'Failed to load file metadata');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!projectId || !bucketName || !key) {
      Alert.alert('Error', 'Missing required parameters');
      return;
    }

    setDownloading(true);
    try {
      const blob = await storageManagerService.downloadFile(projectId, bucketName, key);
      
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        // Create download link for web
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = key.split('/').pop() || 'download';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        // For React Native, you'd use a file system library
        Alert.alert('Download', 'File download on mobile coming soon');
      }

      Alert.alert('Success', 'File downloaded successfully');
    } catch (err) {
      console.error('Error downloading file:', err);
      Alert.alert('Error', `Failed to download file: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!projectId || !bucketName || !key) {
      Alert.alert('Error', 'Missing required parameters');
      return;
    }

    setDeleting(true);
    try {
      await storageManagerService.deleteFile(projectId, bucketName, key);
      setShowDeleteModal(false);
      Alert.alert('Success', 'File deleted successfully');
      navigation.goBack();
    } catch (err) {
      console.error('Error deleting file:', err);
      Alert.alert('Error', `Failed to delete file: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
  };

  const handlePreview = async () => {
    if (!projectId || !bucketName || !key) {
      Alert.alert('Error', 'Missing required parameters');
      return;
    }

    // Check if file is an image
    const contentType = file?.content_type || '';
    if (!contentType.startsWith('image/')) {
      Alert.alert('Preview Not Available', 'Preview is only available for image files');
      return;
    }

    setPreviewLoading(true);
    try {
      const blob = await storageManagerService.downloadFile(projectId, bucketName, key);
      
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        // Create object URL for preview
        const url = window.URL.createObjectURL(blob);
        setPreviewUrl(url);
        setShowPreviewModal(true);
      } else {
        // For React Native, you'd use a different approach
        Alert.alert('Preview', 'Image preview on mobile coming soon');
      }
    } catch (err) {
      console.error('Error loading preview:', err);
      Alert.alert('Error', `Failed to load preview: ${err.message}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleClosePreview = () => {
    setShowPreviewModal(false);
    // Clean up blob URL
    if (previewUrl && Platform.OS === 'web' && typeof window !== 'undefined') {
      window.URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const isImage = () => {
    const contentType = file?.content_type || '';
    return contentType.startsWith('image/');
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = () => {
    const contentType = file?.content_type || '';
    if (contentType.startsWith('image/')) return '🖼️';
    if (contentType.startsWith('video/')) return '🎥';
    if (contentType.startsWith('audio/')) return '🎵';
    if (contentType.includes('pdf')) return '📄';
    if (contentType.includes('zip') || contentType.includes('tar')) return '📦';
    if (contentType.includes('text') || contentType.includes('json')) return '📝';
    return '📄';
  };

  if (loading) {
    return (
      <View style={FileDetailsStyles.container}>
        <View style={FileDetailsStyles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={FileDetailsStyles.backButton}
          >
            <Text style={FileDetailsStyles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={FileDetailsStyles.title}>File Details</Text>
        </View>
        <View style={FileDetailsStyles.loadingContainer}>
          <ActivityIndicator size="large" color="#2C2C2C" />
          <Text style={FileDetailsStyles.loadingText}>Loading file details...</Text>
        </View>
      </View>
    );
  }

  if (error || !file) {
    return (
      <View style={FileDetailsStyles.container}>
        <View style={FileDetailsStyles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={FileDetailsStyles.backButton}
          >
            <Text style={FileDetailsStyles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={FileDetailsStyles.title}>File Details</Text>
        </View>
        <Box style={FileDetailsStyles.errorBox}>
          <Text style={FileDetailsStyles.errorText}>
            {error || 'File not found'}
          </Text>
        </Box>
      </View>
    );
  }

  const fileName = key.split('/').pop() || key;

  return (
    <View style={FileDetailsStyles.container}>
      {/* Header */}
      <View style={FileDetailsStyles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={FileDetailsStyles.backButton}
        >
          <Text style={FileDetailsStyles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={FileDetailsStyles.title} numberOfLines={1}>
          {fileName}
        </Text>
      </View>

      <ScrollView
        style={FileDetailsStyles.content}
        contentContainerStyle={FileDetailsStyles.contentContainer}
      >
        {/* File Icon and Name */}
        <Box style={FileDetailsStyles.fileHeader}>
          <Text style={FileDetailsStyles.fileIcon}>{getFileIcon()}</Text>
          <Text style={FileDetailsStyles.fileName}>{fileName}</Text>
          <Text style={FileDetailsStyles.filePath}>{key}</Text>
        </Box>

        {/* File Metadata */}
        <Box style={FileDetailsStyles.metadataBox}>
          <Text style={FileDetailsStyles.sectionTitle}>File Information</Text>
          
          <View style={FileDetailsStyles.metadataRow}>
            <Text style={FileDetailsStyles.metadataLabel}>Size:</Text>
            <Text style={FileDetailsStyles.metadataValue}>
              {formatFileSize(file.size)}
            </Text>
          </View>

          <View style={FileDetailsStyles.metadataRow}>
            <Text style={FileDetailsStyles.metadataLabel}>Content Type:</Text>
            <Text style={FileDetailsStyles.metadataValue}>
              {file.content_type || 'application/octet-stream'}
            </Text>
          </View>

          <View style={FileDetailsStyles.metadataRow}>
            <Text style={FileDetailsStyles.metadataLabel}>Last Modified:</Text>
            <Text style={FileDetailsStyles.metadataValue}>
              {file.last_modified
                ? new Date(file.last_modified).toLocaleString()
                : 'Unknown'}
            </Text>
          </View>

          {file.etag && (
            <View style={FileDetailsStyles.metadataRow}>
              <Text style={FileDetailsStyles.metadataLabel}>ETag:</Text>
              <Text style={FileDetailsStyles.metadataValue} numberOfLines={1}>
                {file.etag}
              </Text>
            </View>
          )}

          {file.metadata && Object.keys(file.metadata).length > 0 && (
            <View style={FileDetailsStyles.metadataRow}>
              <Text style={FileDetailsStyles.metadataLabel}>Metadata:</Text>
              <Text style={FileDetailsStyles.metadataValue}>
                {JSON.stringify(file.metadata, null, 2)}
              </Text>
            </View>
          )}
        </Box>

        {/* Actions */}
        <View style={FileDetailsStyles.actions}>
          {isImage() && (
            <TouchableOpacity
              onPress={handlePreview}
              disabled={previewLoading}
              style={[
                FileDetailsStyles.actionButton,
                FileDetailsStyles.previewButton,
                previewLoading && FileDetailsStyles.actionButtonDisabled
              ]}
            >
              {previewLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={FileDetailsStyles.actionButtonText}>👁️ Preview</Text>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={handleDownload}
            disabled={downloading}
            style={[
              FileDetailsStyles.actionButton,
              FileDetailsStyles.downloadButton,
              downloading && FileDetailsStyles.actionButtonDisabled
            ]}
          >
            {downloading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={FileDetailsStyles.actionButtonText}>⬇️ Download</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleDeleteClick}
            disabled={deleting}
            style={[
              FileDetailsStyles.actionButton,
              FileDetailsStyles.deleteButton,
              deleting && FileDetailsStyles.actionButtonDisabled
            ]}
          >
            {deleting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={FileDetailsStyles.actionButtonText}>🗑️ Delete</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Info Box */}
        <Box style={FileDetailsStyles.infoBox}>
          <Text style={FileDetailsStyles.infoText}>
            💡 Files are encrypted at rest. Decryption happens automatically when you download.
          </Text>
        </Box>
      </ScrollView>

      {/* Image Preview Modal */}
      <Modal
        visible={showPreviewModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleClosePreview}
      >
        <View style={FileDetailsStyles.previewModalOverlay}>
          <View style={FileDetailsStyles.previewModalContent}>
            <View style={FileDetailsStyles.previewHeader}>
              <Text style={FileDetailsStyles.previewTitle} numberOfLines={1}>
                {fileName}
              </Text>
              <TouchableOpacity
                onPress={handleClosePreview}
                style={FileDetailsStyles.previewCloseButton}
              >
                <Text style={FileDetailsStyles.previewCloseButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            {previewUrl && (
              <View style={FileDetailsStyles.previewImageContainer}>
                {Platform.OS === 'web' ? (
                  <img
                    src={previewUrl}
                    alt={fileName}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '80vh',
                      objectFit: 'contain',
                      display: 'block',
                      margin: '0 auto',
                    }}
                  />
                ) : (
                  <Image
                    source={{ uri: previewUrl }}
                    style={FileDetailsStyles.previewImage}
                    resizeMode="contain"
                  />
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleDeleteCancel}
      >
        <View style={FileDetailsStyles.modalOverlay}>
          <View style={FileDetailsStyles.modalContent}>
            <Text style={FileDetailsStyles.modalTitle}>Delete File</Text>
            <Text style={FileDetailsStyles.modalMessage}>
              Are you sure you want to delete "{fileName}"?
            </Text>
            <Text style={FileDetailsStyles.modalWarning}>
              This action cannot be undone. The file will be permanently deleted.
            </Text>
            <View style={FileDetailsStyles.modalButtons}>
              <TouchableOpacity
                onPress={handleDeleteCancel}
                disabled={deleting}
                style={[FileDetailsStyles.modalButton, FileDetailsStyles.modalButtonCancel]}
              >
                <Text style={FileDetailsStyles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDeleteConfirm}
                disabled={deleting}
                style={[FileDetailsStyles.modalButton, FileDetailsStyles.modalButtonDelete]}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[FileDetailsStyles.modalButtonText, FileDetailsStyles.modalButtonDeleteText]}>
                    Delete
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

