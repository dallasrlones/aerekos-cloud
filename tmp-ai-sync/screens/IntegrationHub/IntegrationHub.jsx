import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, RefreshControl, TextInput, ActivityIndicator,
} from 'react-native';
import { Box } from '../../components/Box/Box';
import { Button } from '../../components/Button/Button';
import { ServiceToggle } from '../../components/ServiceToggle/ServiceToggle';
import { ServiceSetupWizard } from '../../components/ServiceSetupWizard';
import { ManagerAppAccessSection } from '../../components/ManagerAppAccessSection';
import { managerService } from '../../services/managerService';
import api from '../../utils/api';
import { useProject } from '../../contexts/ProjectContext';
import { colors } from '../../styles/theme';
import { IntegrationHubStyles as S } from './IntegrationHub.styles';

/**
 * Bespoke-but-shared hub for queue, webhook, and git managers (lock-6).
 */
export const IntegrationHub = ({
  navigation,
  serviceName,
  title,
  subtitle,
  listPath,
  listKey,
  createFields = [{ key: 'name', label: 'Name', placeholder: 'my-resource' }],
}) => {
  const { currentProject } = useProject();
  const projectId = currentProject?.id;
  const base = `/api/services/${serviceName}/api${listPath}`;

  const [status, setStatus] = useState(null);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({});
  const [creating, setCreating] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const st = await managerService.getStatus(serviceName);
      setStatus(st);
      if (projectId && st?.enabled) {
        const res = await api.get(base, { params: { project_id: projectId } });
        setItems(res.data?.[listKey] || res.data?.items || []);
      } else {
        setItems([]);
      }
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load');
      setItems([]);
    }
  }, [serviceName, projectId, base, listKey]);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = async (enabled) => {
    setToggling(true);
    try {
      if (enabled) await managerService.enable(serviceName, projectId);
      else await managerService.disable(serviceName);
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Toggle failed');
    } finally {
      setToggling(false);
    }
  };

  const handleCreate = async () => {
    if (!projectId) return;
    setCreating(true);
    try {
      await api.post(base, { project_id: projectId, ...form });
      setForm({});
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Create failed');
    } finally {
      setCreating(false);
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

      <ServiceSetupWizard serviceName={serviceName} onEnabled={load} />

      {status?.enabled && projectId ? (
        <>
          <Box title={`Create ${title.replace(/s$/, '')}`}>
            {createFields.map((f) => (
              <View key={f.key} style={S.field}>
                <Text style={S.label}>{f.label}</Text>
                <TextInput
                  style={S.input}
                  placeholder={f.placeholder}
                  placeholderTextColor={colors.textMuted}
                  value={form[f.key] || ''}
                  onChangeText={(v) => setForm((prev) => ({ ...prev, [f.key]: v }))}
                  autoCapitalize="none"
                />
              </View>
            ))}
            <Button title="Create" onPress={handleCreate} loading={creating} disabled={!form[createFields[0]?.key]} />
          </Box>

          <Box title="Resources">
            {items.length === 0 ? (
              <Text style={S.hint}>No resources yet.</Text>
            ) : (
              items.map((item) => (
                <View key={item.id || item.name} style={S.row}>
                  <Text style={S.rowName}>{item.name || item.id}</Text>
                  {item.arn ? <Text style={S.rowSub} numberOfLines={1}>{item.arn}</Text> : null}
                </View>
              ))
            )}
          </Box>

          <Box title="App access">
            <ManagerAppAccessSection serviceName={serviceName} />
          </Box>
        </>
      ) : !projectId ? (
        <Box title="Project"><Text style={S.hint}>Select a project first.</Text></Box>
      ) : null}
    </ScrollView>
  );
};
