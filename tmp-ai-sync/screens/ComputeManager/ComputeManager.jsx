import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Box } from '../../components/Box/Box';
import { Button } from '../../components/Button/Button';
import { ServiceStatus } from '../../components/ServiceStatus/ServiceStatus';
import { ServiceToggle } from '../../components/ServiceToggle/ServiceToggle';
import { computeManagerService } from '../../services/computeManagerService';
import { useProject } from '../../contexts/ProjectContext';
import { colors } from '../../styles/theme';
import { ComputeManagerStyles as S } from './ComputeManager.styles';

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
 * Container Hosting (compute_manager) console hub: service status + the project's
 * running tasks (containers). "Run task" opens the create flow; tapping a task
 * opens its detail page.
 */
export const ComputeManager = ({ navigation }) => {
  const { currentProject } = useProject();
  const projectId = currentProject?.id;

  const [status, setStatus] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [toggling, setToggling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [error, setError] = useState(null);

  const loadStatus = useCallback(async () => {
    try {
      const st = await computeManagerService.getStatus();
      setStatus(st);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load status');
    }
  }, []);

  const loadTasks = useCallback(async () => {
    if (!projectId) return;
    setLoadingTasks(true);
    try {
      const list = await computeManagerService.listTasks(projectId);
      setTasks(list);
      setError(null);
    } catch (err) {
      // Service may be disabled/unreachable; surface gently.
      setTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (status?.enabled) loadTasks();
  }, [status?.enabled, loadTasks]);

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

  return (
    <ScrollView
      style={S.container}
      contentContainerStyle={S.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={S.title}>Container Hosting</Text>
      <Text style={S.subtitle}>Run containers and workloads across your worker fleet.</Text>

      {error && (
        <Box style={S.errorBox}><Text style={S.errorText}>{error}</Text></Box>
      )}

      {/* Service status */}
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

      {/* Tasks */}
      {status?.enabled && (
        <Box title="Tasks">
          {!projectId ? (
            <Text style={S.hintText}>Select a project to view and run containers.</Text>
          ) : (
            <>
              <View style={S.tasksHeader}>
                <Text style={S.hintText}>
                  {tasks.length} task{tasks.length === 1 ? '' : 's'} in {currentProject?.name || 'this project'}
                </Text>
                <Button title="Run task" onPress={() => navigation.navigate('runTask')} style={S.runButton} />
              </View>

              {loadingTasks ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 12 }} />
              ) : tasks.length === 0 ? (
                <View style={S.emptyState}>
                  <Ionicons name="cube-outline" size={40} color={colors.textMuted} />
                  <Text style={S.emptyText}>No tasks yet. Run a container to get started.</Text>
                </View>
              ) : (
                tasks.map((task) => (
                  <TouchableOpacity
                    key={task.id}
                    style={S.taskRow}
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate('taskDetails', { taskId: task.id })}
                  >
                    <View style={S.taskMain}>
                      <View style={S.taskTitleRow}>
                        <Text style={S.taskName} numberOfLines={1}>{task.name}</Text>
                        <View style={[S.statusBadge, { backgroundColor: statusColor(task.status) + '20' }]}>
                          <View style={[S.statusDot, { backgroundColor: statusColor(task.status) }]} />
                          <Text style={[S.statusText, { color: statusColor(task.status) }]}>{task.status}</Text>
                        </View>
                      </View>
                      <Text style={S.taskSub} numberOfLines={1}>{task.image}</Text>
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
            Enable Container Hosting above to deploy it to a worker. Once running you can launch
            containers (tasks) from any image available on that worker.
          </Text>
        </Box>
      )}
    </ScrollView>
  );
};
