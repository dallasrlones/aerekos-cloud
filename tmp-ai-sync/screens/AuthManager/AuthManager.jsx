import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Box } from '../../components/Box/Box';
import { Button } from '../../components/Button/Button';
import { ServiceStatus } from '../../components/ServiceStatus/ServiceStatus';
import { ServiceToggle } from '../../components/ServiceToggle/ServiceToggle';
import { authManagerService } from '../../services/authManagerService';
import { useProject } from '../../contexts/ProjectContext';
import { colors } from '../../styles/theme';
import { AuthManagerStyles as S } from './AuthManager.styles';

/**
 * Authentication (auth_manager) console: service status + the project's identity
 * providers (OIDC/OAuth metadata). Client secrets are stored in Secrets Manager.
 */
export const AuthManager = ({ navigation }) => {
  const { currentProject } = useProject();
  const projectId = currentProject?.id;

  const [status, setStatus] = useState(null);
  const [providers, setProviders] = useState([]);
  const [toggling, setToggling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [error, setError] = useState(null);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await authManagerService.getStatus());
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load status');
    }
  }, []);

  const loadProviders = useCallback(async () => {
    if (!projectId) return;
    setLoadingList(true);
    try {
      setProviders(await authManagerService.listProviders(projectId));
    } catch (err) {
      setProviders([]);
    } finally {
      setLoadingList(false);
    }
  }, [projectId]);

  useEffect(() => { loadStatus(); }, [loadStatus]);
  useEffect(() => { if (status?.enabled) loadProviders(); }, [status?.enabled, loadProviders]);

  const handleToggle = async (enabled) => {
    setToggling(true);
    setError(null);
    try {
      if (enabled) await authManagerService.enable();
      else await authManagerService.disable();
      await loadStatus();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to toggle service');
    } finally {
      setToggling(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStatus();
    if (status?.enabled) await loadProviders();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={S.container}
      contentContainerStyle={S.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={S.title}>Authentication</Text>
      <Text style={S.subtitle}>Sign-in, sessions and identity providers.</Text>

      {error && <Box style={S.errorBox}><Text style={S.errorText}>{error}</Text></Box>}

      <Box title="Service status">
        {status ? (
          <>
            <ServiceToggle enabled={status.enabled} onToggle={handleToggle} loading={toggling} />
            <ServiceStatus
              status={status.enabled ? 'enabled' : 'disabled'}
              lastChecked={new Date().toISOString()}
              onRefresh={loadStatus}
            />
          </>
        ) : (
          <ActivityIndicator size="small" color={colors.primary} />
        )}
      </Box>

      {status?.enabled && (
        <Box title="Identity providers">
          {!projectId ? (
            <Text style={S.hintText}>Select a project to manage identity providers.</Text>
          ) : (
            <>
              <View style={S.listHeader}>
                <Text style={S.hintText}>
                  {providers.length} provider{providers.length === 1 ? '' : 's'} in {currentProject?.name || 'this project'}
                </Text>
                <Button title="Add provider" onPress={() => navigation.navigate('providerForm', {})} style={S.addButton} />
              </View>

              {loadingList ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 12 }} />
              ) : providers.length === 0 ? (
                <View style={S.emptyState}>
                  <Ionicons name="finger-print-outline" size={40} color={colors.textMuted} />
                  <Text style={S.emptyText}>No identity providers yet.</Text>
                </View>
              ) : (
                providers.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={S.row}
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate('providerForm', { providerId: p.id })}
                  >
                    <View style={S.rowMain}>
                      <Text style={S.rowName} numberOfLines={1}>{p.name}</Text>
                      <Text style={S.rowSub} numberOfLines={1}>
                        {(p.provider_type || 'oidc')}{p.issuer ? ` · ${p.issuer}` : ''}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                ))
              )}
            </>
          )}
        </Box>
      )}

      {status && !status.enabled && (
        <Box title="Getting started">
          <Text style={S.hintText}>
            Enable Authentication above to deploy it to a worker, then register OIDC/OAuth
            identity providers. Store provider client secrets in Secrets Manager.
          </Text>
        </Box>
      )}
    </ScrollView>
  );
};
