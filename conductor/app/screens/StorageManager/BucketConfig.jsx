import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Platform, Switch, Modal } from 'react-native';
import { useProject } from '../../contexts/ProjectContext';
import { storageManagerService } from '../../services/storageManagerService';
import { keyManagerService } from '../../services/keyManagerService';
import { Box } from '../../components/Box/Box';
import { BucketConfigStyles } from './BucketConfig.styles';

export const BucketConfig = ({ navigation, route }) => {
  const { currentProject } = useProject();
  const { projectId, bucketName, bucket: initialBucket } = route?.params || {};
  const finalProjectId = projectId || currentProject?.id;
  
  const [bucket, setBucket] = useState(initialBucket);
  const [loading, setLoading] = useState(!initialBucket);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  
  // TTL Configuration
  const [ttlEnabled, setTtlEnabled] = useState(false);
  const [ttlDays, setTtlDays] = useState('');
  const [ttlForever, setTtlForever] = useState(true);
  
  // Versioning Configuration
  const [versioningEnabled, setVersioningEnabled] = useState(false);
  
  // Encryption Key Configuration
  const [availableKeys, setAvailableKeys] = useState([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [showKeySelector, setShowKeySelector] = useState(false);
  const [selectedKeyName, setSelectedKeyName] = useState('');

  useEffect(() => {
    if (finalProjectId && bucketName) {
      loadBucket();
      loadAvailableKeys();
    }
  }, [finalProjectId, bucketName]);

  const loadBucket = async () => {
    if (!finalProjectId || !bucketName) return;
    
    try {
      setLoading(true);
      setError(null);
      const bucketData = await storageManagerService.getBucket(finalProjectId, bucketName);
      setBucket(bucketData);
      setSelectedKeyName(bucketData.encryption_key_name || '');
      
      // Parse metadata for existing config
      if (bucketData.metadata) {
        const metadata = typeof bucketData.metadata === 'string' 
          ? JSON.parse(bucketData.metadata) 
          : bucketData.metadata;
        
        // Load TTL settings
        if (metadata.ttl) {
          setTtlEnabled(true);
          if (metadata.ttl === 'forever' || metadata.ttl === null) {
            setTtlForever(true);
            setTtlDays('');
          } else {
            setTtlForever(false);
            setTtlDays(String(metadata.ttl));
          }
        } else {
          setTtlEnabled(false);
          setTtlForever(true);
          setTtlDays('');
        }
        
        // Load versioning settings
        setVersioningEnabled(metadata.versioning === true || metadata.versioning === 'enabled');
      }
    } catch (err) {
      console.error('Error loading bucket:', err);
      setError(err.message || 'Failed to load bucket configuration');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableKeys = async () => {
    if (!finalProjectId) return;
    
    try {
      setLoadingKeys(true);
      const response = await keyManagerService.getKeys(finalProjectId, { type: 'symmetric' });
      setAvailableKeys(response.keys || []);
    } catch (err) {
      console.error('Error loading keys:', err);
      // Don't set error - keys are optional for display
    } finally {
      setLoadingKeys(false);
    }
  };

  const handleKeyClick = () => {
    if (bucket?.encryption_key_name) {
      navigation.navigate('keyDetails', { keyName: bucket.encryption_key_name });
    }
  };

  const handleChangeKey = () => {
    setShowKeySelector(true);
  };

  const handleKeySelect = async (keyName) => {
    if (!finalProjectId || !bucketName) return;
    
    try {
      setSaving(true);
      await storageManagerService.updateBucket(finalProjectId, bucketName, {
        encryption_key_name: keyName
      });
      
      setSelectedKeyName(keyName);
      setShowKeySelector(false);
      await loadBucket(); // Reload to get updated bucket data
      Alert.alert('Success', 'Encryption key updated successfully');
    } catch (err) {
      console.error('Error updating encryption key:', err);
      Alert.alert('Error', `Failed to update encryption key: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!finalProjectId || !bucketName) {
      Alert.alert('Error', 'Missing required parameters');
      return;
    }

    // Validate TTL days if TTL is enabled and not forever
    if (ttlEnabled && !ttlForever) {
      const days = parseInt(ttlDays);
      if (isNaN(days) || days < 1) {
        Alert.alert('Error', 'TTL days must be a positive number');
        return;
      }
    }

    setSaving(true);
    try {
      // Build metadata object
      const metadata = bucket?.metadata 
        ? (typeof bucket.metadata === 'string' ? JSON.parse(bucket.metadata) : bucket.metadata)
        : {};
      
      // Update TTL settings
      if (ttlEnabled) {
        if (ttlForever) {
          metadata.ttl = 'forever';
        } else {
          metadata.ttl = parseInt(ttlDays);
        }
      } else {
        delete metadata.ttl;
      }
      
      // Update versioning settings
      metadata.versioning = versioningEnabled ? 'enabled' : 'disabled';
      
      // Save bucket configuration
      await storageManagerService.updateBucket(finalProjectId, bucketName, { metadata });
      
      Alert.alert('Success', 'Bucket configuration saved successfully');
      navigation.goBack();
    } catch (err) {
      console.error('Error saving bucket configuration:', err);
      Alert.alert('Error', `Failed to save configuration: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={BucketConfigStyles.container}>
        <View style={BucketConfigStyles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={BucketConfigStyles.backButton}
          >
            <Text style={BucketConfigStyles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={BucketConfigStyles.title}>Bucket Configuration</Text>
        </View>
        <View style={BucketConfigStyles.loadingContainer}>
          <ActivityIndicator size="large" color="#2C2C2C" />
          <Text style={BucketConfigStyles.loadingText}>Loading configuration...</Text>
        </View>
      </View>
    );
  }

  if (error || !bucket) {
    return (
      <View style={BucketConfigStyles.container}>
        <View style={BucketConfigStyles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={BucketConfigStyles.backButton}
          >
            <Text style={BucketConfigStyles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={BucketConfigStyles.title}>Bucket Configuration</Text>
        </View>
        <Box style={BucketConfigStyles.errorBox}>
          <Text style={BucketConfigStyles.errorText}>
            {error || 'Bucket not found'}
          </Text>
        </Box>
      </View>
    );
  }

  return (
    <View style={BucketConfigStyles.container}>
      {/* Header */}
      <View style={BucketConfigStyles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={BucketConfigStyles.backButton}
        >
          <Text style={BucketConfigStyles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={BucketConfigStyles.title} numberOfLines={1}>
          {bucketName} - Configuration
        </Text>
      </View>

      <ScrollView
        style={BucketConfigStyles.content}
        contentContainerStyle={BucketConfigStyles.contentContainer}
      >
        {/* Bucket Info */}
        <Box style={BucketConfigStyles.infoBox}>
          <Text style={BucketConfigStyles.sectionTitle}>Bucket Information</Text>
          <View style={BucketConfigStyles.infoRow}>
            <Text style={BucketConfigStyles.infoLabel}>Name:</Text>
            <Text style={BucketConfigStyles.infoValue}>{bucket.name}</Text>
          </View>
          <View style={BucketConfigStyles.infoRow}>
            <Text style={BucketConfigStyles.infoLabel}>Encryption Key:</Text>
            <View style={BucketConfigStyles.keyContainer}>
              {bucket.encryption_key_name ? (
                <>
                  <TouchableOpacity
                    onPress={handleKeyClick}
                    style={BucketConfigStyles.keyLink}
                  >
                    <Text style={BucketConfigStyles.keyLinkText}>
                      {bucket.encryption_key_name}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleChangeKey}
                    style={BucketConfigStyles.changeKeyButton}
                  >
                    <Text style={BucketConfigStyles.changeKeyButtonText}>Change</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={BucketConfigStyles.keyContainer}>
                  <Text style={BucketConfigStyles.infoValue}>Disabled</Text>
                  <TouchableOpacity
                    onPress={handleChangeKey}
                    style={BucketConfigStyles.changeKeyButton}
                  >
                    <Text style={BucketConfigStyles.changeKeyButtonText}>Set Key</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
          <View style={BucketConfigStyles.infoRow}>
            <Text style={BucketConfigStyles.infoLabel}>Created:</Text>
            <Text style={BucketConfigStyles.infoValue}>
              {new Date(bucket.created_at).toLocaleString()}
            </Text>
          </View>
        </Box>

        {/* TTL Configuration */}
        <Box style={BucketConfigStyles.configBox}>
          <Text style={BucketConfigStyles.sectionTitle}>File Lifecycle (TTL)</Text>
          <Text style={BucketConfigStyles.sectionDescription}>
            Configure how long files should be stored in this bucket before automatic deletion.
          </Text>
          
          <View style={BucketConfigStyles.switchRow}>
            <View style={BucketConfigStyles.switchLabelContainer}>
              <Text style={BucketConfigStyles.switchLabel}>Enable TTL</Text>
              <Text style={BucketConfigStyles.switchDescription}>
                Automatically delete files after a specified period
              </Text>
            </View>
            <Switch
              value={ttlEnabled}
              onValueChange={setTtlEnabled}
              trackColor={{ false: '#767577', true: '#2C2C2C' }}
              thumbColor={ttlEnabled ? '#fff' : '#f4f3f4'}
            />
          </View>

          {ttlEnabled && (
            <View style={BucketConfigStyles.ttlOptions}>
              <TouchableOpacity
                onPress={() => {
                  setTtlForever(true);
                  setTtlDays('');
                }}
                style={[
                  BucketConfigStyles.radioOption,
                  ttlForever && BucketConfigStyles.radioOptionSelected
                ]}
              >
                <View style={BucketConfigStyles.radioCircle}>
                  {ttlForever && <View style={BucketConfigStyles.radioCircleInner} />}
                </View>
                <View style={BucketConfigStyles.radioTextContainer}>
                  <Text style={BucketConfigStyles.radioLabel}>Keep files forever</Text>
                  <Text style={BucketConfigStyles.radioDescription}>
                    Files will never be automatically deleted
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setTtlForever(false);
                  if (!ttlDays) setTtlDays('30');
                }}
                style={[
                  BucketConfigStyles.radioOption,
                  !ttlForever && BucketConfigStyles.radioOptionSelected
                ]}
              >
                <View style={BucketConfigStyles.radioCircle}>
                  {!ttlForever && <View style={BucketConfigStyles.radioCircleInner} />}
                </View>
                <View style={BucketConfigStyles.radioTextContainer}>
                  <Text style={BucketConfigStyles.radioLabel}>Delete after days</Text>
                  <Text style={BucketConfigStyles.radioDescription}>
                    Files will be automatically deleted after the specified number of days
                  </Text>
                </View>
              </TouchableOpacity>

              {!ttlForever && (
                <View style={BucketConfigStyles.inputContainer}>
                  <TextInput
                    style={BucketConfigStyles.numberInput}
                    placeholder="Number of days"
                    value={ttlDays}
                    onChangeText={setTtlDays}
                    keyboardType="numeric"
                    placeholderTextColor="#999"
                  />
                  <Text style={BucketConfigStyles.inputHint}>
                    Files will be deleted {ttlDays ? `${ttlDays} day${parseInt(ttlDays) !== 1 ? 's' : ''}` : 'X days'} after upload
                  </Text>
                </View>
              )}
            </View>
          )}
        </Box>

        {/* Versioning Configuration */}
        <Box style={BucketConfigStyles.configBox}>
          <Text style={BucketConfigStyles.sectionTitle}>Versioning</Text>
          <Text style={BucketConfigStyles.sectionDescription}>
            Enable versioning to keep multiple versions of files when they are updated or deleted.
          </Text>
          
          <View style={BucketConfigStyles.switchRow}>
            <View style={BucketConfigStyles.switchLabelContainer}>
              <Text style={BucketConfigStyles.switchLabel}>Enable Versioning</Text>
              <Text style={BucketConfigStyles.switchDescription}>
                Keep multiple versions of files when updated or deleted
              </Text>
            </View>
            <Switch
              value={versioningEnabled}
              onValueChange={setVersioningEnabled}
              trackColor={{ false: '#767577', true: '#2C2C2C' }}
              thumbColor={versioningEnabled ? '#fff' : '#f4f3f4'}
            />
          </View>

          {versioningEnabled && (
            <View style={BucketConfigStyles.infoBox}>
              <Text style={BucketConfigStyles.infoText}>
                ✓ Versioning enabled. When files are updated or deleted, previous versions will be retained.
              </Text>
            </View>
          )}
        </Box>

        {/* Save Button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={[
            BucketConfigStyles.saveButton,
            saving && BucketConfigStyles.saveButtonDisabled
          ]}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={BucketConfigStyles.saveButtonText}>💾 Save Configuration</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Key Selector Modal */}
      <Modal
        visible={showKeySelector}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowKeySelector(false)}
      >
        <View style={BucketConfigStyles.modalOverlay}>
          <View style={BucketConfigStyles.modalContent}>
            <Text style={BucketConfigStyles.modalTitle}>Select Encryption Key</Text>
            <Text style={BucketConfigStyles.modalDescription}>
              Choose an encryption key to use for this bucket. Files encrypted with the previous key will remain encrypted with that key.
            </Text>
            
            {loadingKeys ? (
              <ActivityIndicator size="large" color="#2C2C2C" style={{ marginVertical: 20 }} />
            ) : (
              <ScrollView style={BucketConfigStyles.keysList}>
                {availableKeys.length === 0 ? (
                  <Text style={BucketConfigStyles.noKeysText}>
                    No encryption keys available. Create one in Key Manager first.
                  </Text>
                ) : (
                  availableKeys.map((key) => (
                    <TouchableOpacity
                      key={key.name}
                      onPress={() => handleKeySelect(key.name)}
                      style={[
                        BucketConfigStyles.keyOption,
                        selectedKeyName === key.name && BucketConfigStyles.keyOptionSelected
                      ]}
                    >
                      <View style={BucketConfigStyles.keyOptionContent}>
                        <Text style={BucketConfigStyles.keyOptionName}>{key.name}</Text>
                        <Text style={BucketConfigStyles.keyOptionType}>
                          {key.type || 'symmetric'} • {key.active ? 'Active' : 'Inactive'}
                        </Text>
                      </View>
                      {selectedKeyName === key.name && (
                        <Text style={BucketConfigStyles.keyOptionCheck}>✓</Text>
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            )}
            
            <View style={BucketConfigStyles.modalButtons}>
              <TouchableOpacity
                onPress={() => setShowKeySelector(false)}
                style={[BucketConfigStyles.modalButton, BucketConfigStyles.modalButtonCancel]}
              >
                <Text style={BucketConfigStyles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

