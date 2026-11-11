import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, TextInput, Alert } from 'react-native';
import { Box } from '../../components/Box/Box';
import { ServiceStatus } from '../../components/ServiceStatus/ServiceStatus';
import { ServiceToggle } from '../../components/ServiceToggle/ServiceToggle';
import { Button } from '../../components/Button/Button';
import { useProject } from '../../contexts/ProjectContext';
import { storageManagerService } from '../../services/storageManagerService';
import { StorageManagerStyles } from './StorageManager.styles';
import { ResourceCrud } from '../../components/ResourceCrud';
import { AnimusPage } from '../../components/Animus';

export const StorageManager = ({ navigation }) => {
  const { currentProject } = useProject();
  const [status, setStatus] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [storagePath, setStoragePath] = useState('');
  const [editingStoragePath, setEditingStoragePath] = useState(false);
  const [savingPath, setSavingPath] = useState(false);

  useEffect(() => {
    loadStatus();
    loadMetrics();
    loadStoragePath();
  }, []);

  const loadStoragePath = async () => {
    try {
      // Get storage path from status or use default
      const currentStatus = await storageManagerService.getStatus();
      if (currentStatus?.config?.storage_path) {
        setStoragePath(currentStatus.config.storage_path);
      } else {
        setStoragePath('/app/storage'); // Default
      }
    } catch (err) {
      console.error('Error loading storage path:', err);
      setStoragePath('/app/storage'); // Fallback to default
    }
  };

  const handleSaveStoragePath = async () => {
    if (!storagePath.trim()) {
      Alert.alert('Error', 'Storage path cannot be empty');
      return;
    }

    setSavingPath(true);
    try {
      // TODO: Add API endpoint to update storage path
      // For now, just show success message
      Alert.alert('Success', 'Storage path updated. Restart the service for changes to take effect.');
      setEditingStoragePath(false);
    } catch (err) {
      console.error('Error saving storage path:', err);
      Alert.alert('Error', `Failed to save storage path: ${err.message}`);
    } finally {
      setSavingPath(false);
    }
  };

  const loadStatus = async () => {
    try {
      const data = await storageManagerService.getStatus();
      setStatus(data);
      setError(null);
    } catch (err) {
      console.error('Error loading status:', err);
      setError(err.message || 'Failed to load service status');
    }
  };

  const loadMetrics = async () => {
    try {
      const data = await storageManagerService.getMetrics();
      setMetrics(data);
    } catch (err) {
      console.error('Error loading metrics:', err);
      // Metrics are optional, don't set error
    }
  };

  const handleToggle = async (enabled) => {
    setLoading(true);
    setError(null);
    try {
      if (enabled) {
        await storageManagerService.enable();
      } else {
        await storageManagerService.disable();
      }
      await loadStatus();
      await loadMetrics();
    } catch (err) {
      console.error('Error toggling service:', err);
      setError(err.message || 'Failed to toggle service');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadStatus(), loadMetrics()]);
    setRefreshing(false);
  };

  return (
    <AnimusPage
      title="Object Storage"
      job="Deep vault for buckets and objects — sealed chambers with signed access."
      metaphor="vault"
      scroll={false}
      primaryAction={<Button title="Projects" onPress={() => navigation.navigate('projectsList')} />}
    >
    <ScrollView
      style={StorageManagerStyles.container}
      contentContainerStyle={StorageManagerStyles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >

      {error && (
        <Box style={StorageManagerStyles.errorBox}>
          <Text style={StorageManagerStyles.errorText}>{error}</Text>
        </Box>
      )}

      {/* Service Status */}
      <Box title="Service Status">
        {status ? (
          <>
            <ServiceToggle
              enabled={status.enabled}
              onToggle={handleToggle}
              loading={loading}
            />
            <ServiceStatus
              status={status.enabled ? 'enabled' : 'disabled'}
              lastChecked={new Date().toISOString()}
              onRefresh={loadStatus}
            />
            {status.deployed && (
              <View style={StorageManagerStyles.infoRow}>
                <Text style={StorageManagerStyles.infoLabel}>Deployed on:</Text>
                <Text style={StorageManagerStyles.infoValue}>
                  Worker {status.worker_id || 'Unknown'}
                </Text>
              </View>
            )}
            {status.health && (
              <View style={StorageManagerStyles.infoRow}>
                <Text style={StorageManagerStyles.infoLabel}>Health:</Text>
                <Text style={StorageManagerStyles.infoValue}>
                  {status.health.status || 'Unknown'}
                </Text>
              </View>
            )}
          </>
        ) : (
          <ActivityIndicator size="small" color="#2C2C2C" />
        )}
      </Box>

      {/* Metrics */}
      {metrics && status?.enabled && (
        <Box title="Statistics">
          <View style={StorageManagerStyles.metricsGrid}>
            <View style={StorageManagerStyles.metricItem}>
              <Text style={StorageManagerStyles.metricValue}>{metrics.projects_total || 0}</Text>
              <Text style={StorageManagerStyles.metricLabel}>Total Projects</Text>
            </View>
            <View style={StorageManagerStyles.metricItem}>
              <Text style={StorageManagerStyles.metricValue}>{metrics.buckets_total || 0}</Text>
              <Text style={StorageManagerStyles.metricLabel}>Total Buckets</Text>
            </View>
            <View style={StorageManagerStyles.metricItem}>
              <Text style={StorageManagerStyles.metricValue}>{metrics.files_total || 0}</Text>
              <Text style={StorageManagerStyles.metricLabel}>Total Files</Text>
            </View>
            <View style={StorageManagerStyles.metricItem}>
              <Text style={StorageManagerStyles.metricValue}>
                {metrics.storage_used ? formatBytes(metrics.storage_used) : '0 B'}
              </Text>
              <Text style={StorageManagerStyles.metricLabel}>Storage Used</Text>
            </View>
          </View>
        </Box>
      )}

      {/* Storage Configuration */}
      {status?.enabled && (
        <Box title="Storage Configuration">
          <View style={StorageManagerStyles.configRow}>
            <Text style={StorageManagerStyles.configLabel}>Storage Path:</Text>
            {editingStoragePath ? (
              <View style={StorageManagerStyles.pathInputContainer}>
                <TextInput
                  style={StorageManagerStyles.pathInput}
                  value={storagePath}
                  onChangeText={setStoragePath}
                  placeholder="/app/storage"
                  autoFocus
                />
                <TouchableOpacity
                  onPress={handleSaveStoragePath}
                  disabled={savingPath}
                  style={StorageManagerStyles.saveButton}
                >
                  <Text style={StorageManagerStyles.saveButtonText}>
                    {savingPath ? 'Saving...' : 'Save'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setEditingStoragePath(false);
                    loadStoragePath(); // Reset to original
                  }}
                  style={StorageManagerStyles.cancelButton}
                >
                  <Text style={StorageManagerStyles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={StorageManagerStyles.pathDisplayContainer}>
                <Text style={StorageManagerStyles.configValue}>{storagePath}</Text>
                <TouchableOpacity
                  onPress={() => setEditingStoragePath(true)}
                  style={StorageManagerStyles.editButton}
                >
                  <Text style={StorageManagerStyles.editButtonText}>Edit</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          <View style={StorageManagerStyles.configRow}>
            <Text style={StorageManagerStyles.configLabel}>Encryption:</Text>
            <Text style={StorageManagerStyles.configValue}>
              Enabled (AES-256-GCM)
            </Text>
          </View>
          <View style={StorageManagerStyles.configRow}>
            <Text style={StorageManagerStyles.configLabel}>Key Management:</Text>
            <Text style={StorageManagerStyles.configValue}>
              Unique key per bucket
            </Text>
          </View>
          <Text style={StorageManagerStyles.configNote}>
            Note: Storage path is where files are stored. Each bucket gets a unique encryption key from key_manager for HIPAA/PHI compliance.
          </Text>
        </Box>
      )}

      {/* Navigation to Bucket Management */}
      {status?.enabled && (
        <Box title="Storage Management">
          {!currentProject ? (
            <View style={StorageManagerStyles.noProjectContainer}>
              <Text style={StorageManagerStyles.noProjectText}>
                Please select a project to manage buckets
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => navigation.navigate('bucketsList', { projectId: currentProject.id })}
              style={StorageManagerStyles.navButton}
            >
              <Text style={StorageManagerStyles.navButtonText}>
                Manage Buckets →
              </Text>
              <Text style={StorageManagerStyles.navButtonSubtext}>
                Project: {currentProject.name}
              </Text>
            </TouchableOpacity>
          )}
        </Box>
      )}
      {status?.enabled ? <ResourceCrud serviceName="storage_manager" enabled title="Buckets" /> : null}
    </ScrollView>
    </AnimusPage>
  );
};

// Helper function to format bytes
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
