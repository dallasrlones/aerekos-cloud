import React, { useState, useEffect, useCallback } from 'react';
import { Text, ScrollView, RefreshControl } from 'react-native';
import { Box } from '../../components/Box/Box';
import { ServiceToggle } from '../../components/ServiceToggle/ServiceToggle';
import { ServiceSetupWizard } from '../../components/ServiceSetupWizard';
import { ManagerAppAccessSection } from '../../components/ManagerAppAccessSection';
import { ResourceCrud } from '../../components/ResourceCrud';
import { managerService } from '../../services/managerService';
import { setupService } from '../../services/setupService';
import { useProject } from '../../contexts/ProjectContext';
import { IntegrationHubStyles as S } from './IntegrationHub.styles';

/**
 * Shared hub for queue, webhook, git, and registry. Full CRUD + stack JSON via ResourceCrud.
 */
export const IntegrationHub = ({
  navigation,
  serviceName,
  title,
  subtitle,
}) => {
  const { currentProject } = useProject();
  const projectId = currentProject?.id;

  const [status, setStatus] = useState(null);
  const [toggling, setToggling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      const st = await managerService.getStatus(serviceName);
      setStatus(st);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load');
    }
  }, [serviceName]);

  useEffect(() => {
    load();
  }, [load, tick]);

  const handleToggle = async (enabled) => {
    setToggling(true);
    try {
      if (enabled) await setupService.enable(projectId, serviceName);
      else await managerService.disable(serviceName);
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Toggle failed');
    } finally {
      setToggling(false);
    }
  };

  return (
    <ScrollView
      style={S.container}
      contentContainerStyle={S.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    >
      <Text style={S.title}>{title}</Text>
      {subtitle ? <Text style={S.subtitle}>{subtitle}</Text> : null}
      {error ? <Box><Text style={S.error}>{error}</Text></Box> : null}

      <Box title="Service">
        <ServiceToggle enabled={!!status?.enabled} onToggle={handleToggle} loading={toggling} />
      </Box>

      <ServiceSetupWizard serviceName={serviceName} navigation={navigation} onEnabled={load} />

      <ResourceCrud
        serviceName={serviceName}
        enabled={!!status?.enabled && !!projectId}
        title={title}
        onChanged={() => setTick((n) => n + 1)}
      />

      {status?.enabled && projectId ? (
        <Box title="App access">
          <ManagerAppAccessSection serviceName={serviceName} />
        </Box>
      ) : !projectId ? (
        <Box title="Project"><Text style={S.hint}>Select a project first.</Text></Box>
      ) : null}
    </ScrollView>
  );
};
