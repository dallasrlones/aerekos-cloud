import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { Box } from '../../components/Box/Box';
import { Button } from '../../components/Button/Button';
import { ServiceStatus } from '../../components/ServiceStatus/ServiceStatus';
import { ServiceToggle } from '../../components/ServiceToggle/ServiceToggle';
import { apiManagerService } from '../../services/apiManagerService';
import { useProject } from '../../contexts/ProjectContext';
import { getApiBaseUrl } from '../../utils/api';
import { colors } from '../../styles/theme';
import { ApiGatewayManagerStyles as S } from './ApiGatewayManager.styles';

export const ApiGatewayManager = ({ navigation }) => {
  const { currentProject } = useProject();
  const projectId = currentProject?.id;
  const apiBase = getApiBaseUrl();

  const [status, setStatus] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [toggling, setToggling] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const st = await apiManagerService.getStatus();
      setStatus(st);
      if (projectId && st?.enabled) {
        setRoutes(await apiManagerService.listRoutes(projectId));
      } else {
        setRoutes([]);
      }
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load');
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = async (enabled) => {
    setToggling(true);
    try {
      if (enabled) await apiManagerService.enable();
      else await apiManagerService.disable();
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Toggle failed');
    } finally {
      setToggling(false);
    }
  };

  const handleSeed = async () => {
    if (!projectId) return;
    setSeeding(true);
    try {
      await apiManagerService.seedPresets(projectId);
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Seed failed');
    } finally {
      setSeeding(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={S.container}
      contentContainerStyle={S.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={S.title}>API Gateway</Text>
      <Text style={S.subtitle}>Pretty invoke URLs → manager proxy with ARN injection</Text>

      {error ? (
        <Box style={S.errorBox}><Text style={S.errorText}>{error}</Text></Box>
      ) : null}

      <ServiceStatus status={status} loading={!status} />
      <ServiceToggle enabled={!!status?.enabled} onToggle={handleToggle} loading={toggling} />

      <Box title="Project routes">
        {!projectId ? (
          <Text style={S.hint}>Select a project to manage gateway routes.</Text>
        ) : (
          <>
            <Button title="Seed standard presets" onPress={handleSeed} loading={seeding} />
            <Text style={S.hint}>
              Presets are auto-seeded when a project is created. Re-seed to refresh after upgrades.
            </Text>
            {routes.length === 0 ? (
              <Text style={S.hint}>No routes yet — seed presets for this project.</Text>
            ) : (
              routes.map((r) => (
                <View key={r.id} style={S.routeRow}>
                  <Text style={S.routeName}>{r.method} {r.name}</Text>
                  <Text style={S.routePath} selectable>{r.public_path}</Text>
                  <Text style={S.routeTarget}>→ {r.target_service}{r.target_path}</Text>
                  {r.pretty_invoke_url ? (
                    <Text style={S.routeUrl} selectable>
                      Example: {r.pretty_invoke_url.replace('{endpoint_name}', 'my-endpoint').replace('{database_name}', 'my-db').replace('{queue_name}', 'my-queue')}
                    </Text>
                  ) : null}
                </View>
              ))
            )}
          </>
        )}
      </Box>

      <Box title="Token URL">
        <Text style={S.mono} selectable>{apiBase}/api/services/auth_manager/api/v1/auth/token</Text>
      </Box>
    </ScrollView>
  );
};
