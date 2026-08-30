import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Alert, Modal, ActivityIndicator } from 'react-native';
import { Box } from '../../components/Box/Box';
import { KeyMaterial } from '../../components/KeyMaterial/KeyMaterial';
import { keyManagerService } from '../../services/keyManagerService';
// Removed storageManagerService import - key_manager shouldn't depend on storage_manager
import { useProject } from '../../contexts/ProjectContext';
import { KeyDetailsStyles } from './KeyDetails.styles';
import { stackService } from '../../services/stackService';

export const KeyDetails = ({ navigation, route }) => {
  const { currentProject } = useProject();
  const { keyName } = route.params || {};
  const [key, setKey] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  // Removed bucketsUsingKey state - key_manager shouldn't check storage_manager
  // Removed loadingBuckets state - key_manager shouldn't check storage_manager
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [availableKeys, setAvailableKeys] = useState([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [replacing, setReplacing] = useState(false);

  useEffect(() => {
    if (keyName && currentProject?.id) {
      loadKey();
      loadVersions();
      // Removed loadBucketsUsingKey - key_manager shouldn't check storage_manager
    } else if (!currentProject?.id) {
      setError('No project selected. Please select a project first.');
      setLoading(false);
    }
  }, [keyName, currentProject?.id]);

  const loadKey = async () => {
    if (!currentProject?.id) {
      setError('No project selected');
      return;
    }
    try {
      setLoading(true);
      const data = await keyManagerService.getKey(currentProject.id, keyName);
      setKey(data);
      setError(null);
    } catch (err) {
      console.error('Error loading key:', err);
      setError(err.message || 'Failed to load key');
    } finally {
      setLoading(false);
    }
  };

  const loadVersions = async () => {
    if (!currentProject?.id) return;
    try {
      const data = await keyManagerService.getKeyVersions(currentProject.id, keyName);
      setVersions(data.versions || []);
    } catch (err) {
      console.error('Error loading versions:', err);
    }
  };

  // Removed loadBucketsUsingKey function - key_manager shouldn't check storage_manager

  const loadAvailableKeys = async () => {
    if (!currentProject?.id) return;
    try {
      setLoadingKeys(true);
      const response = await keyManagerService.getKeys(currentProject.id, { type: 'symmetric' });
      // Filter out the current key
      const filtered = (response.keys || []).filter(k => k.name !== keyName);
      setAvailableKeys(filtered);
    } catch (err) {
      console.error('Error loading keys:', err);
      Alert.alert('Error', `Failed to load keys: ${err.message}`);
    } finally {
      setLoadingKeys(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadKey(), loadVersions()]);
    setRefreshing(false);
  };

  const handleRotate = async () => {
    if (!currentProject?.id) {
      Alert.alert('Error', 'No project selected');
      return;
    }
    Alert.alert(
      'Rotate Key',
      'This will create a new version and mark the current version as inactive. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Rotate',
          style: 'destructive',
          onPress: async () => {
            try {
              await keyManagerService.rotateKey(currentProject.id, keyName);
              await loadKey();
              await loadVersions();
              Alert.alert('Success', 'Key rotated successfully');
            } catch (err) {
              Alert.alert('Error', `Failed to rotate key: ${err.message}`);
            }
          }
        }
      ]
    );
  };

  const handleArchive = async () => {
    if (!currentProject?.id) {
      Alert.alert('Error', 'No project selected');
      return;
    }
    Alert.alert(
      'Archive Key',
      'This will mark the key as inactive. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          onPress: async () => {
            try {
              await keyManagerService.archiveKey(currentProject.id, keyName);
              await stackService.unrecord(currentProject.id, { service: 'key_manager', name: keyName });
              await loadKey();
              Alert.alert('Success', 'Key archived successfully');
            } catch (err) {
              Alert.alert('Error', `Failed to archive key: ${err.message}`);
            }
          }
        }
      ]
    );
  };

  // Removed delete functionality - keys should only be archived, never deleted

  const handleReplace = () => {
    loadAvailableKeys();
    setShowReplaceModal(true);
  };

  const handleReplaceConfirm = async (newKeyName) => {
    if (!currentProject?.id) {
      Alert.alert('Error', 'No project selected');
      return;
    }
    
    setReplacing(true);
    try {
      const result = await keyManagerService.replaceKey(
        currentProject.id,
        keyName,
        newKeyName
      );
      
      setShowReplaceModal(false);
      Alert.alert(
        'Success',
        `Key replaced successfully. ${result.updated_count || 0} bucket(s) updated to use the new key.`,
        [
          {
            text: 'OK',
            onPress: async () => {
              await loadKey();
              await loadVersions();
              // Removed loadBucketsUsingKey - key_manager shouldn't check storage_manager
            }
          }
        ]
      );
    } catch (err) {
      console.error('Error replacing key:', err);
      Alert.alert('Error', `Failed to replace key: ${err.message}`);
    } finally {
      setReplacing(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const handleCopyKeyMaterial = (keyMaterial) => {
    // Copy to clipboard (simplified - in real app use Clipboard API)
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(keyMaterial);
    }
    Alert.alert('Copied', 'Key material copied to clipboard');
  };

  if (loading) {
    return (
      <View style={KeyDetailsStyles.container}>
        <Text style={KeyDetailsStyles.loadingText}>Loading key details...</Text>
      </View>
    );
  }

  if (error || !key) {
    return (
      <View style={KeyDetailsStyles.container}>
        <Text style={KeyDetailsStyles.errorText}>{error || 'Key not found'}</Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={KeyDetailsStyles.backButton}
        >
          <Text style={KeyDetailsStyles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={KeyDetailsStyles.container}
      contentContainerStyle={KeyDetailsStyles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={KeyDetailsStyles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={KeyDetailsStyles.backButton}
        >
          <Text style={KeyDetailsStyles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={KeyDetailsStyles.title}>{key.name}</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Key Information */}
      <Box title="Key Information">
        <View style={KeyDetailsStyles.infoRow}>
          <Text style={KeyDetailsStyles.label}>Name:</Text>
          <Text style={KeyDetailsStyles.value}>{key.name}</Text>
        </View>
        <View style={KeyDetailsStyles.infoRow}>
          <Text style={KeyDetailsStyles.label}>Type:</Text>
          <Text style={KeyDetailsStyles.value}>{key.type}</Text>
        </View>
        <View style={KeyDetailsStyles.infoRow}>
          <Text style={KeyDetailsStyles.label}>Algorithm:</Text>
          <Text style={KeyDetailsStyles.value}>{key.algorithm}</Text>
        </View>
        <View style={KeyDetailsStyles.infoRow}>
          <Text style={KeyDetailsStyles.label}>Version:</Text>
          <Text style={KeyDetailsStyles.value}>v{key.key_version}</Text>
        </View>
        <View style={KeyDetailsStyles.infoRow}>
          <Text style={KeyDetailsStyles.label}>Status:</Text>
          <Text style={[
            KeyDetailsStyles.value,
            key.is_active ? KeyDetailsStyles.statusActive : KeyDetailsStyles.statusArchived
          ]}>
            {key.is_active ? 'Active' : 'Archived'}
          </Text>
        </View>
        <View style={KeyDetailsStyles.infoRow}>
          <Text style={KeyDetailsStyles.label}>Created:</Text>
          <Text style={KeyDetailsStyles.value}>{formatDate(key.created_at)}</Text>
        </View>
        <View style={KeyDetailsStyles.infoRow}>
          <Text style={KeyDetailsStyles.label}>Updated:</Text>
          <Text style={KeyDetailsStyles.value}>{formatDate(key.updated_at)}</Text>
        </View>
        {key.rotated_at && (
          <View style={KeyDetailsStyles.infoRow}>
            <Text style={KeyDetailsStyles.label}>Rotated:</Text>
            <Text style={KeyDetailsStyles.value}>{formatDate(key.rotated_at)}</Text>
          </View>
        )}
        {key.metadata && Object.keys(key.metadata).length > 0 && (
          <View style={KeyDetailsStyles.metadataContainer}>
            <Text style={KeyDetailsStyles.label}>Metadata:</Text>
            <Text style={KeyDetailsStyles.metadataText}>
              {JSON.stringify(key.metadata, null, 2)}
            </Text>
          </View>
        )}
      </Box>

      {/* Key Material */}
      {key.key_material && (
        <Box title="Key Material">
          <KeyMaterial
            keyMaterial={key.key_material}
            onCopy={handleCopyKeyMaterial}
          />
        </Box>
      )}

      {/* Removed "Buckets Using This Key" section - key_manager shouldn't depend on storage_manager */}

      {/* Version History */}
      {versions.length > 0 && (
        <Box title={`Version History (${versions.length} version${versions.length !== 1 ? 's' : ''})`}>
          {versions.map((version) => (
            <View key={version.id} style={KeyDetailsStyles.versionItem}>
              <View style={KeyDetailsStyles.versionHeader}>
                <Text style={KeyDetailsStyles.versionText}>
                  Version {version.key_version}
                  {version.key_version === key.key_version && ' (Current)'}
                </Text>
                <Text style={[
                  KeyDetailsStyles.versionStatus,
                  version.is_active ? KeyDetailsStyles.statusActive : KeyDetailsStyles.statusArchived
                ]}>
                  {version.is_active ? 'Active' : 'Inactive'}
                </Text>
              </View>
              <Text style={KeyDetailsStyles.versionDate}>
                Created: {formatDate(version.created_at)}
              </Text>
              {version.rotated_at && (
                <Text style={KeyDetailsStyles.versionDate}>
                  Rotated: {formatDate(version.rotated_at)}
                </Text>
              )}
            </View>
          ))}
        </Box>
      )}

      {/* Actions */}
      <Box title="Actions">
        <View style={KeyDetailsStyles.actions}>
          {key.is_active && (
            <>
              <TouchableOpacity
                onPress={handleRotate}
                style={[KeyDetailsStyles.actionButton, KeyDetailsStyles.rotateButton]}
              >
                <Text style={KeyDetailsStyles.actionButtonText}>🔄 Rotate Key</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleReplace}
                style={[KeyDetailsStyles.actionButton, KeyDetailsStyles.replaceButton]}
              >
                <Text style={KeyDetailsStyles.actionButtonText}>🔄 Replace Key</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleArchive}
                style={[KeyDetailsStyles.actionButton, KeyDetailsStyles.archiveButton]}
              >
                <Text style={KeyDetailsStyles.actionButtonText}>📦 Archive Key</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Box>

      {/* Replace Key Modal */}
      <Modal
        visible={showReplaceModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowReplaceModal(false)}
      >
        <View style={KeyDetailsStyles.modalOverlay}>
          <View style={KeyDetailsStyles.modalContent}>
            <Text style={KeyDetailsStyles.modalTitle}>Replace Encryption Key</Text>
            <Text style={KeyDetailsStyles.modalDescription}>
              This will archive "{keyName}" and update all buckets using it to use the selected new key.
            </Text>
            
            {loadingKeys ? (
              <ActivityIndicator size="large" color="#2C2C2C" style={{ marginVertical: 20 }} />
            ) : (
              <ScrollView style={KeyDetailsStyles.keysList}>
                {availableKeys.length === 0 ? (
                  <Text style={KeyDetailsStyles.noKeysText}>
                    No other encryption keys available. Create one in Key Manager first.
                  </Text>
                ) : (
                  availableKeys.map((availableKey) => (
                    <TouchableOpacity
                      key={availableKey.name}
                      onPress={() => handleReplaceConfirm(availableKey.name)}
                      disabled={replacing}
                      style={[
                        KeyDetailsStyles.keyOption,
                        replacing && KeyDetailsStyles.keyOptionDisabled
                      ]}
                    >
                      <View style={KeyDetailsStyles.keyOptionContent}>
                        <Text style={KeyDetailsStyles.keyOptionName}>{availableKey.name}</Text>
                        <Text style={KeyDetailsStyles.keyOptionType}>
                          {availableKey.type || 'symmetric'} • {availableKey.active ? 'Active' : 'Inactive'}
                        </Text>
                      </View>
                      {replacing ? (
                        <ActivityIndicator size="small" color="#2C2C2C" />
                      ) : (
                        <Text style={KeyDetailsStyles.keyOptionArrow}>→</Text>
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            )}
            
            <View style={KeyDetailsStyles.modalButtons}>
              <TouchableOpacity
                onPress={() => setShowReplaceModal(false)}
                disabled={replacing}
                style={[KeyDetailsStyles.modalButton, KeyDetailsStyles.modalButtonCancel]}
              >
                <Text style={KeyDetailsStyles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};
