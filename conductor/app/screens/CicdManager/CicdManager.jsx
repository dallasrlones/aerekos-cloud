import React, { useCallback, useEffect, useState } from 'react';
import { Text, ScrollView } from 'react-native';
import { Page } from '../../components/ui';
import { Box } from '../../components/Box/Box';
import { Button } from '../../components/Button/Button';
import { useProject } from '../../contexts/ProjectContext';
import api from '../../utils/api';
import { computeManagerService } from '../../services/computeManagerService';
import { EnvSwitcher } from '../../components/EnvSwitcher/EnvSwitcher';

export const CicdManager = ({ navigation }) => {
  const { currentProject } = useProject();
  const [items, setItems] = useState([]);
  const [containers, setContainers] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    if (!currentProject?.id) return;
    try {
      const [r, tasks] = await Promise.all([
        api.get('/api/services/cicd_manager/api/v1/pipelines', {
          params: { project_id: currentProject.id },
        }),
        computeManagerService.listTasks(currentProject.id).catch(() => []),
      ]);
      setItems(r.data?.items || []);
      setContainers(tasks || []);
      setError(null);
    } catch (e) {
      setError(e.response?.data?.error?.message || e.message);
    }
  }, [currentProject?.id]);

  useEffect(() => { load(); }, [load]);

  const run = async (id, action = 'test') => {
    setBusy(`${id}:${action}`);
    try {
      await api.post(`/api/services/cicd_manager/api/v1/pipelines/${id}/run`, {
        project_id: currentProject.id,
        action,
      });
      await load();
    } catch (e) {
      setError(e.response?.data?.error?.message || e.message);
    } finally {
      setBusy(null);
    }
  };

  const link = async (pipelineId, containerId) => {
    try {
      await api.patch(`/api/services/cicd_manager/api/v1/pipelines/${pipelineId}`, {
        project_id: currentProject.id,
        target_container_id: containerId,
      });
      await load();
    } catch (e) {
      setError(e.response?.data?.error?.message || e.message);
    }
  };

  return (
    <Page title="CI / CD Pipelines" subtitle="Merge runs Actions. App repos deploy that environment’s container. system + aerekos-cloud + main publishes a fleet release — devices self-update.">
      <ScrollView>
        <EnvSwitcher />
        {error ? <Text>{error}</Text> : null}
        {items.map((p) => (
          <Box key={p.id} title={p.name || p.id}>
            <Text>state: {p.state || 'idle'}</Text>
            {p.repo || p.repo_name ? <Text>repo: {p.repo || p.repo_name}</Text> : null}
            {p.target_container_id ? <Text>target: {p.target_container_id}</Text> : null}
            <Button
              title={busy === `${p.id}:test` ? 'Running…' : 'Run test'}
              onPress={() => run(p.id, 'test')}
              variant="secondary"
            />
            <Button
              title={busy === `${p.id}:deploy` ? 'Deploying…' : 'Deploy'}
              onPress={() => run(p.id, 'deploy')}
              variant="secondary"
            />
            {p.target_container_id ? (
              <Button
                title="Open container"
                onPress={() => navigation.navigate('containerDetails', { containerId: p.target_container_id, taskId: p.target_container_id })}
                variant="secondary"
              />
            ) : (
              containers.map((c) => (
                <Button
                  key={c.id}
                  title={`Target ${c.name}`}
                  onPress={() => link(p.id, c.id)}
                  variant="secondary"
                />
              ))
            )}
          </Box>
        ))}
        {!items.length && !error ? <Text>No pipelines yet. Launch from a repository to create one, or a git push will record a run when a pipeline exists.</Text> : null}
      </ScrollView>
    </Page>
  );
};
