import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Box } from '../../components/Box/Box';
import { Button } from '../../components/Button/Button';
import { ServiceStatus } from '../../components/ServiceStatus/ServiceStatus';
import { ServiceToggle } from '../../components/ServiceToggle/ServiceToggle';
import { computeManagerService } from '../../services/computeManagerService';
import { useProject } from '../../contexts/ProjectContext';
import { colors } from '../../styles/theme';
import { ComputeManagerStyles as S } from './ComputeManager.styles';
import { EnvSwitcher } from '../../components/EnvSwitcher/EnvSwitcher';
import { AnimusPage, AnimusNextSteps } from '../../components/Animus';
import { formatBytes, formatCpu } from '../../utils/formatBytes';

const statusColor = (status) => {
  switch (status) {
    case 'running': return '#4CAF50';
    case 'stopped': return '#FF9800';
    case 'pending': return '#2196F3';
    case 'failed': return '#F44336';
    default: return colors.textMuted;
  }
};

/**
 * Container Hosting hub: this project's compute_manager containers only.
 */
export const ComputeManager = ({ navigation }) => {
  const { currentProject, currentEnvironment } = useProject();
  const projectId = currentProject?.id;

  const [status, setStatus] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [toggling, setToggling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [error, setError] = useState(null);
  const [taskStats, setTaskStats] = useState({});

  const loadStatus = useCallback(async () => {
    try {
      const st = await computeManagerService.getStatus();
      setStatus(st);
      setError(null);
    } catch (err) {
      setStatus((prev) => prev || { enabled: false, deployed: false });
      setError(err.response?.data?.error?.message || err.message || 'Failed to load status');
    }
  }, []);

  const loadTasks = useCallback(async () => {
    if (!projectId) return;
    setLoadingTasks(true);
    try {
      const list = await computeManagerService.listTasks(projectId, currentEnvironment);
      setTasks(list);
      setError(null);
      const running = (list || []).filter((t) => t.status === 'running');
      const entries = await Promise.all(running.map(async (t) => {
        try {
          return [t.id, await computeManagerService.getTaskStats(projectId, t.id)];
        } catch {
          return [t.id, null];
        }
      }));
      setTaskStats(Object.fromEntries(entries));
    } catch (err) {
      setTasks([]);
      setError(err.response?.data?.error?.message || err.message || 'Failed to load containers');
    } finally {
      setLoadingTasks(false);
    }
  }, [projectId, currentEnvironment]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (status?.enabled) loadTasks();
  }, [status?.enabled, loadTasks]);

  useEffect(() => {
    if (!status?.enabled || !projectId) return undefined;
    const running = tasks.filter((t) => t.status === 'running');
    if (!running.length) return undefined;
    const tick = async () => {
      const entries = await Promise.all(running.map(async (t) => {
        try {
          return [t.id, await computeManagerService.getTaskStats(projectId, t.id)];
        } catch {
          return [t.id, null];
        }
      }));
      setTaskStats(Object.fromEntries(entries));
    };
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, [status?.enabled, projectId, tasks]);

  const handleToggle = async (enabled) => {
    setToggling(true);
    setError(null);
    try {
      if (enabled) await computeManagerService.enable();
      else await computeManagerService.disable();
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
    if (status?.enabled) await loadTasks();
    setRefreshing(false);
  };

  const goDetails = (id) => {
    navigation.navigate('containerDetails', { containerId: id, taskId: id });
  };

  return (
    <AnimusPage
      title="Container Hosting"
      job="Launch and manage this project’s containers from the hangar bay."
      metaphor="hangar"
      scroll={false}
      primaryAction={<Button title="Launch" onPress={() => navigation.navigate('launchContainer')} />}
    >
    <ScrollView
      style={S.container}
      contentContainerStyle={S.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <EnvSwitcher />
      <AnimusNextSteps navigation={navigation} filter={['launch', 'bind']} />

      {error && (
        <Box style={S.errorBox}><Text style={S.errorText}>{error}</Text></Box>
      )}

      <Box title="Service status">
        {status ? (
          <>
            <ServiceToggle enabled={status.enabled} onToggle={handleToggle} loading={toggling} />
            <ServiceStatus
              status={status.enabled ? 'enabled' : 'disabled'}
              lastChecked={new Date().toISOString()}
              onRefresh={loadStatus}
            />
            {status.deployed && (
              <View style={S.infoRow}>
                <Text style={S.infoLabel}>Deployed on</Text>
                <Text style={S.infoValue}>Worker {status.worker_id || 'unknown'}</Text>
              </View>
            )}
          </>
        ) : (
          <ActivityIndicator size="small" color={colors.primary} />
        )}
      </Box>

      {status?.enabled && (
        <View nativeID="icarus-compute-list" {...(Platform.OS === 'web' ? { dataSet: { icarusAnchor: 'compute-list' } } : {})}>
        <Box title="Containers">
          {!projectId ? (
            <Text style={S.hintText}>Select a project to view and launch containers.</Text>
          ) : (
            <>
              <View style={S.tasksHeader}>
                <Text style={S.hintText}>
                  {tasks.length} container{tasks.length === 1 ? '' : 's'} in {currentEnvironment || 'prod'}
                </Text>
                <Button title="Launch container" onPress={() => navigation.navigate('launchContainer')} style={S.runButton} />
              </View>

              {loadingTasks ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 12 }} />
              ) : tasks.length === 0 ? (
                <View style={S.emptyState}>
                  <Ionicons name="cube-outline" size={40} color={colors.textMuted} />
                  <Text style={S.emptyText}>No container in {currentEnvironment || 'prod'}. Launch one (environment is pre-filled).</Text>
                </View>
              ) : (
                tasks.map((task) => (
                  <TouchableOpacity
                    key={task.id}
                    style={S.taskRow}
                    activeOpacity={0.7}
                    onPress={() => goDetails(task.id)}
                  >
                    <View style={S.taskMain}>
                      <View style={S.taskTitleRow}>
                        <Text style={S.taskName} numberOfLines={1}>{task.name}</Text>
                        <View style={[S.statusBadge, { backgroundColor: statusColor(task.status) + '20' }]}>
                          <View style={[S.statusDot, { backgroundColor: statusColor(task.status) }]} />
                          <Text style={[S.statusText, { color: statusColor(task.status) }]}>{task.status}</Text>
                        </View>
                      </View>
                      <Text style={S.taskSub} numberOfLines={1}>
                        {task.image}
                        {task.worker_hostname ? ` · ${task.worker_hostname}` : ''}
                        {(task.env?.AEREKOS_ADOPTED === '1' || task.env?.AEREKOS_ADOPTED === 1) ? ' · adopted' : ''}
                        {task.status === 'running' && taskStats[task.id]?.cpu_percent != null
                          ? ` · ${formatCpu(taskStats[task.id].cpu_percent)} · ${formatBytes(taskStats[task.id].memory_bytes)}`
                          : ''}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                ))
              )}
            </>
          )}
        </Box>
        </View>
      )}

      {status && !status.enabled && (
        <Box title="Getting started">
          <Text style={S.hintText}>
            Enable Container Hosting above to deploy it to a worker. Once running you can launch
            containers from an image, a source repository, or an uploaded zip.
          </Text>
        </Box>
      )}
    </ScrollView>
    </AnimusPage>
  );
};
