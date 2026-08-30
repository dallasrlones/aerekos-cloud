import React, { useState, useEffect, useCallback } from 'react';
import { ActivityIndicator, Text } from 'react-native';
import api from '../../utils/api';
import { getApiBaseUrl } from '../../utils/api';
import { useProject } from '../../contexts/ProjectContext';
import { AppAccessPanel } from '../AppAccessPanel';
import { getAppAccessConfig, buildPrettyUrl } from '../../services/appAccessConfig';
import { ManagerAppAccessSectionStyles as S } from './ManagerAppAccessSection.styles';

/**
 * App-access hub for managers that only have ManagerConsole (queue, webhook, git).
 */
export const ManagerAppAccessSection = ({ serviceName }) => {
  const { currentProject } = useProject();
  const projectId = currentProject?.id;
  const config = getAppAccessConfig(serviceName);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(false);
  const apiBase = getApiBaseUrl();

  const loadResources = useCallback(async () => {
    if (!projectId || !config?.listPath) {
      setResources([]);
      return;
    }
    setLoading(true);
    try {
      const response = await api.get(
        `/api/services/${serviceName}/api${config.listPath}`,
        { params: { project_id: projectId } },
      );
      const items = response.data?.[config.listKey] || response.data?.items || [];
      setResources(
        items.map((item) => {
          const arn = config.resourceArn ? config.resourceArn(item, projectId) : item.arn;
          const prettyPath = config.prettyPreset ? config.prettyPreset(item, projectId) : null;
          return {
            id: item.id || item.name,
            name: item.name,
            arn,
            prettyUrl: buildPrettyUrl(apiBase, prettyPath),
          };
        }).filter((r) => r.arn),
      );
    } catch {
      setResources([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, serviceName, config, apiBase]);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  if (!config) return null;

  if (loading) {
    return <ActivityIndicator size="small" color="#888" style={{ marginVertical: 12 }} />;
  }

  if (!config.listPath && resources.length === 0) {
    return (
      <Text style={S.hint}>
        Create resources in this manager, then attach their ARNs to app credentials below.
      </Text>
    );
  }

  return (
    <AppAccessPanel
      projectId={projectId}
      apiBase={apiBase}
      title="App access"
      hint={`Create credentials scoped to ${serviceName.replace('_', ' ')} resources.`}
      resources={resources}
      scopes={config.scopes}
      defaultScopes={config.defaultScopes}
    />
  );
};
