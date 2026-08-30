import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Box } from '../../components/Box/Box';
import { ServiceStatus } from '../../components/ServiceStatus/ServiceStatus';
import { ServiceToggle } from '../../components/ServiceToggle/ServiceToggle';
import { keyManagerService } from '../../services/keyManagerService';
import { secretsManagerService } from '../../services/secretsManagerService';
import { KeyManagerStyles } from './KeyManager.styles';

export const KeyManager = ({ navigation }) => {
  const [status, setStatus] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [secretsStatus, setSecretsStatus] = useState(null);
  const [secretsLoading, setSecretsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [secretsError, setSecretsError] = useState(null);

  useEffect(() => {
    loadStatus();
    loadMetrics();
    loadSecretsStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const data = await keyManagerService.getStatus();
      setStatus(data);
      setError(null);
    } catch (err) {
      console.error('Error loading status:', err);
      setError(err.message || 'Failed to load service status');
    }
  };

  const loadMetrics = async () => {
    try {
      const data = await keyManagerService.getMetrics();
      setMetrics(data);
    } catch (err) {
      console.error('Error loading metrics:', err);
    }
  };

  const loadSecretsStatus = async () => {
    try {
      const data = await secretsManagerService.getStatus();
      setSecretsStatus(data);
      setSecretsError(null);
    } catch (err) {
      console.error('Error loading secrets_manager status:', err);
      setSecretsError(err.message || 'Failed to load secrets service status');
    }
  };

  const handleToggle = async (enabled) => {
    setLoading(true);
    setError(null);
    try {
      if (enabled) {
        await keyManagerService.enable();
      } else {
        await keyManagerService.disable();
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

  const handleSecretsToggle = async (enabled) => {
    setSecretsLoading(true);
    setSecretsError(null);
    try {
      if (enabled) {
        await secretsManagerService.enable();
      } else {
        await secretsManagerService.disable();
      }
      await loadSecretsStatus();
    } catch (err) {
      console.error('Error toggling secrets_manager:', err);
      setSecretsError(err.message || 'Failed to toggle secrets service');
    } finally {
      setSecretsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadStatus(), loadMetrics(), loadSecretsStatus()]);
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={KeyManagerStyles.container}
      contentContainerStyle={KeyManagerStyles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={KeyManagerStyles.title}>Key Manager Service</Text>

      {error && (
        <Box style={KeyManagerStyles.errorBox}>
          <Text style={KeyManagerStyles.errorText}>{error}</Text>
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
              <View style={KeyManagerStyles.infoRow}>
                <Text style={KeyManagerStyles.infoLabel}>Deployed on:</Text>
                <Text style={KeyManagerStyles.infoValue}>
                  Worker {status.worker_id || 'Unknown'}
                </Text>
              </View>
            )}
            {status.health && (
              <View style={KeyManagerStyles.infoRow}>
                <Text style={KeyManagerStyles.infoLabel}>Health:</Text>
                <Text style={KeyManagerStyles.infoValue}>
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
          <View style={KeyManagerStyles.metricsGrid}>
            <View style={KeyManagerStyles.metricItem}>
              <Text style={KeyManagerStyles.metricValue}>{metrics.keys_total || 0}</Text>
              <Text style={KeyManagerStyles.metricLabel}>Total Keys</Text>
            </View>
            <View style={KeyManagerStyles.metricItem}>
              <Text style={KeyManagerStyles.metricValue}>{metrics.keys_active || 0}</Text>
              <Text style={KeyManagerStyles.metricLabel}>Active Keys</Text>
            </View>
            <View style={KeyManagerStyles.metricItem}>
              <Text style={KeyManagerStyles.metricValue}>{metrics.keys_archived || 0}</Text>
              <Text style={KeyManagerStyles.metricLabel}>Archived Keys</Text>
            </View>
          </View>
        </Box>
      )}

      {/* Navigation to Key Management */}
      {status?.enabled && (
        <Box title="Encryption keys (KMS)">
          <Text style={KeyManagerStyles.hintText}>
            Symmetric and asymmetric keys for storage and platform crypto.
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('keysList')}
            style={KeyManagerStyles.navButton}
          >
            <Text style={KeyManagerStyles.navButtonText}>
              Manage encryption keys →
            </Text>
          </TouchableOpacity>
        </Box>
      )}

      <Box title="Service secrets (API tokens)">
        {secretsError ? (
          <Text style={KeyManagerStyles.errorTextSmall}>{secretsError}</Text>
        ) : null}
        {secretsStatus ? (
          <>
            <ServiceToggle
              enabled={secretsStatus.enabled}
              onToggle={handleSecretsToggle}
              loading={secretsLoading}
            />
            {secretsStatus.enabled && (
              <TouchableOpacity
                onPress={() => navigation.navigate('serviceSecretsList')}
                style={KeyManagerStyles.navButton}
              >
                <Text style={KeyManagerStyles.navButtonText}>
                  Manage service secrets (Cloudflare, webhooks, …) →
                </Text>
              </TouchableOpacity>
            )}
            {!secretsStatus.enabled && (
              <Text style={KeyManagerStyles.hintText}>
                Enable to store project-scoped tokens (for example for tunnel and DNS services). Keys
                are still managed above; this adds credential blobs encrypted via key manager.
              </Text>
            )}
          </>
        ) : (
          <ActivityIndicator size="small" color="#2C2C2C" />
        )}
      </Box>
    </ScrollView>
  );
};
