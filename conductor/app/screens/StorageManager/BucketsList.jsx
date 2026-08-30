import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, TextInput, Alert, ActivityIndicator, Modal, Platform } from 'react-native';
import { useProject } from '../../contexts/ProjectContext';
import { storageManagerService } from '../../services/storageManagerService';
import { Box } from '../../components/Box/Box';
import { BucketsListStyles } from './BucketsList.styles';
import { stackService } from '../../services/stackService';

export const BucketsList = ({ navigation, route }) => {
  const { currentProject } = useProject();
  const projectId = route?.params?.projectId || currentProject?.id;
  
  const [buckets, setBuckets] = useState([]);
  const [filteredBuckets, setFilteredBuckets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBucketName, setNewBucketName] = useState('');
  const [creating, setCreating] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingBucket, setDeletingBucket] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (projectId) {
      loadBuckets();
    } else {
      setError('No project selected. Please select a project first.');
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    filterBuckets();
  }, [buckets, searchQuery]);

  const loadBuckets = async () => {
    if (!projectId) {
      setError('No project selected');
      return;
    }

    try {
      setLoading(true);
      const response = await storageManagerService.getBuckets(projectId);
      setBuckets(response.buckets || []);
      setError(null);
    } catch (err) {
      console.error('Error loading buckets:', err);
      setError(err.message || 'Failed to load buckets');
    } finally {
      setLoading(false);
    }
  };

  const filterBuckets = () => {
    let filtered = [...buckets];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(bucket =>
        bucket.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredBuckets(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBuckets();
    setRefreshing(false);
  };

  const handleCreateBucket = async () => {
    if (!newBucketName.trim()) {
      Alert.alert('Error', 'Bucket name is required');
      return;
    }

    if (!projectId) {
      Alert.alert('Error', 'No project selected');
      return;
    }

    // Validate bucket name (S3-like naming rules)
    const bucketNameRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
    if (!bucketNameRegex.test(newBucketName.toLowerCase())) {
      Alert.alert(
        'Invalid Bucket Name',
        'Bucket name must:\n- Be 3-63 characters\n- Contain only lowercase letters, numbers, and hyphens\n- Start and end with a letter or number'
      );
      return;
    }

    setCreating(true);
    try {
      await storageManagerService.createBucket(projectId, {
        name: newBucketName.trim(),
        metadata: {}
      });
      await stackService.record(projectId, { service: 'storage_manager', resource: { name: newBucketName.trim() } });
      
      Alert.alert('Success', 'Bucket created successfully');
      setNewBucketName('');
      setShowCreateModal(false);
      await loadBuckets();
    } catch (err) {
      console.error('Error creating bucket:', err);
      Alert.alert('Error', `Failed to create bucket: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteClick = (bucketId, bucketName) => {
    setDeletingBucket({ id: bucketId, name: bucketName });
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingBucket || !projectId) return;

    setDeleting(true);
    try {
      await storageManagerService.deleteBucket(projectId, deletingBucket.name);
      await stackService.unrecord(projectId, { service: 'storage_manager', name: deletingBucket.name });
      setShowDeleteModal(false);
      setDeletingBucket(null);
      Alert.alert('Success', `Bucket "${deletingBucket.name}" and all its files have been deleted`);
      await loadBuckets();
    } catch (err) {
      console.error('Error deleting bucket:', err);
      Alert.alert('Error', `Failed to delete bucket: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setDeletingBucket(null);
  };

  if (!projectId) {
    return (
      <View style={BucketsListStyles.container}>
        <View style={BucketsListStyles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={BucketsListStyles.backButton}
          >
            <Text style={BucketsListStyles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={BucketsListStyles.title}>Buckets</Text>
        </View>
        <Box>
          <Text style={BucketsListStyles.errorText}>
            No project selected. Please select a project first.
          </Text>
        </Box>
      </View>
    );
  }

  return (
    <View style={BucketsListStyles.container}>
      {/* Header */}
      <View style={BucketsListStyles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={BucketsListStyles.backButton}
        >
          <Text style={BucketsListStyles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={BucketsListStyles.title}>Buckets</Text>
        <TouchableOpacity
          onPress={() => setShowCreateModal(true)}
          style={BucketsListStyles.createButton}
        >
          <Text style={BucketsListStyles.createButtonText}>+ Create</Text>
        </TouchableOpacity>
      </View>

      {/* Project Info */}
      {currentProject && (
        <Box style={BucketsListStyles.projectInfo}>
          <Text style={BucketsListStyles.projectLabel}>Project:</Text>
          <Text style={BucketsListStyles.projectName}>{currentProject.name}</Text>
        </Box>
      )}

      {/* Search */}
      <View style={BucketsListStyles.searchContainer}>
        <TextInput
          style={BucketsListStyles.searchInput}
          placeholder="Search buckets..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
      </View>

      {/* Error Message */}
      {error && (
        <Box style={BucketsListStyles.errorBox}>
          <Text style={BucketsListStyles.errorText}>{error}</Text>
        </Box>
      )}

      {/* Buckets List */}
      <ScrollView
        style={BucketsListStyles.list}
        contentContainerStyle={BucketsListStyles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <View style={BucketsListStyles.loadingContainer}>
            <ActivityIndicator size="large" color="#2C2C2C" />
            <Text style={BucketsListStyles.loadingText}>Loading buckets...</Text>
          </View>
        ) : filteredBuckets.length === 0 ? (
          <View style={BucketsListStyles.emptyContainer}>
            <Text style={BucketsListStyles.emptyText}>
              {searchQuery ? 'No buckets match your search' : 'No buckets yet'}
            </Text>
            {!searchQuery && (
              <TouchableOpacity
                onPress={() => setShowCreateModal(true)}
                style={BucketsListStyles.emptyButton}
              >
                <Text style={BucketsListStyles.emptyButtonText}>Create Your First Bucket</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredBuckets.map((bucket) => (
            <TouchableOpacity
              key={bucket.id}
              style={BucketsListStyles.bucketCard}
              onPress={() => {
                navigation.navigate('bucketDetails', {
                  projectId,
                  bucketName: bucket.name,
                  bucket
                });
              }}
            >
              <View style={BucketsListStyles.bucketCardContent}>
                <Text style={BucketsListStyles.bucketName}>{bucket.name}</Text>
                {bucket.metadata && typeof bucket.metadata === 'string' && (
                  <Text style={BucketsListStyles.bucketMetadata}>
                    {JSON.parse(bucket.metadata).description || ''}
                  </Text>
                )}
                <Text style={BucketsListStyles.bucketDate}>
                  Created: {new Date(bucket.created_at).toLocaleDateString()}
                </Text>
              </View>
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  handleDeleteClick(bucket.id, bucket.name);
                }}
                style={BucketsListStyles.deleteButton}
              >
                <Text style={BucketsListStyles.deleteButtonText}>🗑️ Delete</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Create Bucket Modal */}
      {showCreateModal && (
        <View style={BucketsListStyles.modalOverlay}>
          <View style={BucketsListStyles.modalContent}>
            <Text style={BucketsListStyles.modalTitle}>Create New Bucket</Text>
            <TextInput
              style={BucketsListStyles.modalInput}
              placeholder="Bucket name (e.g., my-bucket)"
              value={newBucketName}
              onChangeText={setNewBucketName}
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor="#999"
            />
            <Text style={BucketsListStyles.modalHint}>
              Bucket name must be 3-63 characters, lowercase letters, numbers, and hyphens only.
            </Text>
            <View style={BucketsListStyles.modalButtons}>
              <TouchableOpacity
                onPress={() => {
                  setShowCreateModal(false);
                  setNewBucketName('');
                }}
                style={[BucketsListStyles.modalButton, BucketsListStyles.modalButtonCancel]}
              >
                <Text style={BucketsListStyles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateBucket}
                disabled={creating || !newBucketName.trim()}
                style={[
                  BucketsListStyles.modalButton,
                  BucketsListStyles.modalButtonCreate,
                  (creating || !newBucketName.trim()) && BucketsListStyles.modalButtonDisabled
                ]}
              >
                <Text style={BucketsListStyles.modalButtonText}>
                  {creating ? 'Creating...' : 'Create'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Delete Bucket Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleDeleteCancel}
      >
        <View style={BucketsListStyles.modalOverlay}>
          <View style={BucketsListStyles.modalContent}>
            <Text style={BucketsListStyles.modalTitle}>Delete Bucket</Text>
            <Text style={BucketsListStyles.modalMessage}>
              Are you sure you want to delete bucket "{deletingBucket?.name}"?
            </Text>
            <Text style={BucketsListStyles.modalWarning}>
              ⚠️ This action cannot be undone. All files in this bucket will be permanently deleted.
            </Text>
            <View style={BucketsListStyles.modalButtons}>
              <TouchableOpacity
                onPress={handleDeleteCancel}
                disabled={deleting}
                style={[BucketsListStyles.modalButton, BucketsListStyles.modalButtonCancel]}
              >
                <Text style={BucketsListStyles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDeleteConfirm}
                disabled={deleting}
                style={[BucketsListStyles.modalButton, BucketsListStyles.modalButtonDelete]}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[BucketsListStyles.modalButtonText, BucketsListStyles.modalButtonDeleteText]}>
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
