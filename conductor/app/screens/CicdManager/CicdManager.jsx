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
  const { currentProject, currentEnvironment } = useProject();
  const [items, setItems] = useState([]);
  const [containers, setContainers] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    if (!currentProject?.id) return;
    try {
      const [r, tasks] = await Promise.all([
        api.get('/api/services/cicd_manager/api/v1/pipelines', {
          params: { project_id: currentProject.id, environment: currentEnvironment || undefined },
        }),
        computeManagerService.listTasks(currentProject.id).catch(() => []),
      ]);
      setItems(r.data?.items || []);
      setContainers(tasks || []);
      setError(null);
    } catch (e) {
      setError(e.response?.data?.error?.message || e.message);
    }
  }, [currentProject?.id, currentEnvironment]);

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
    <Page title="CI / CD Pipelines" subtitle="Push to an environment’s branch deploys that env’s Cloud task. Unlinked pipelines never create a container. system + aerekos-cloud + main still publishes a fleet release.">
      <ScrollView>
        <EnvSwitcher />
        {error ? <Text>{error}</Text> : null}
        {items.filter((p) => !p.environment || !currentEnvironment || p.environment === currentEnvironment).map((p) => (
          <Box key={p.id} title={p.name || p.id}>
            <Text>state: {p.state || 'idle'}</Text>
            {p.repo || p.repo_name ? <Text>repo: {p.repo || p.repo_name}</Text> : null}
            <Text>env: {p.environment || 'prod'} · branch: {p.git_ref || 'main'}{p.require_pr ? ' · require PR' : ''}</Text>
            {p.pin_worker_id ? <Text>pin: {p.pin_worker_id}</Text> : null}
            {p.target_container_id ? <Text>target: {p.target_container_id}</Text> : <Text>target: not linked — deploy is blocked</Text>}
            {p.last_run_json ? <Text>last run: {(() => { try { const j = typeof p.last_run_json === 'string' ? JSON.parse(p.last_run_json) : p.last_run_json; return `${j.action || ''} ${j.reason || j.ok === false ? 'failed' : ''} ${j.at || ''}`.trim(); } catch { return String(p.last_run_json).slice(0, 80); } })()}</Text> : null}
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
