import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { Box } from '../../components/Box/Box';
import { Button } from '../../components/Button/Button';
import { computeManagerService } from '../../services/computeManagerService';
import { useProject } from '../../contexts/ProjectContext';
import { colors } from '../../styles/theme';
import { TaskDetailsStyles as S } from './TaskDetails.styles';

const statusColor = (status) => {
  switch (status) {
    case 'running': return '#4CAF50';
    case 'stopped': return '#FF9800';
    case 'pending': return '#2196F3';
    case 'failed': return '#F44336';
    default: return colors.textMuted;
  }
};

export const TaskDetails = ({ navigation, route }) => {
  const { taskId } = route.params || {};
  const { currentProject } = useProject();
  const projectId = currentProject?.id;

  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!projectId || !taskId) return;
    try {
      setError(null);
      const t = await computeManagerService.getTask(projectId, taskId, true);
      setTask(t);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load task');
    } finally {
      setLoading(false);
    }
  }, [projectId, taskId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStop = async () => {
    setActionLoading(true);
    try {
      await computeManagerService.stopTask(projectId, taskId);
      await load();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error?.message || err.message || 'Failed to stop task');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete task',
      `Delete "${task?.name}"? This stops and removes the container.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await computeManagerService.deleteTask(projectId, taskId);
              navigation.goBack();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error?.message || err.message || 'Failed to delete task');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[S.container, S.center]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (error || !task) {
    return (
      <ScrollView style={S.container} contentContainerStyle={S.content}>
        <Box style={S.errorBox}>
          <Text style={S.errorText}>{error || 'Task not found'}</Text>
          <Button title="Go back" onPress={() => navigation.goBack()} style={{ marginTop: 16 }} />
        </Box>
      </ScrollView>
    );
  }

  const envEntries = Object.entries(task.env || {});
  const portEntries = Object.entries(task.port_bindings || {});

  return (
    <ScrollView
      style={S.container}
      contentContainerStyle={S.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
    >
      <Text style={S.title}>{task.name}</Text>
      <View style={[S.statusBadge, { backgroundColor: statusColor(task.status) + '20' }]}>
        <View style={[S.statusDot, { backgroundColor: statusColor(task.status) }]} />
        <Text style={[S.statusText, { color: statusColor(task.status) }]}>{task.status}</Text>
      </View>

      <Box title="Actions">
        <View style={S.actions}>
          {task.status === 'running' && (
            <Button title="Stop" onPress={handleStop} loading={actionLoading} variant="secondary" style={S.actionButton} />
          )}
          <Button title="Refresh" onPress={load} variant="secondary" style={S.actionButton} />
          <Button title="Delete" onPress={handleDelete} variant="danger" style={S.actionButton} />
        </View>
      </Box>

      <Box title="Container">
        <Row label="Image" value={task.image} />
        <Row label="Run mode" value={task.run_mode} />
        <Row label="Status" value={task.status} valueColor={statusColor(task.status)} />
        {task.exit_code !== null && task.exit_code !== undefined && (
          <Row label="Exit code" value={String(task.exit_code)} />
        )}
        {task.container_id ? <Row label="Container" value={task.container_id.slice(0, 12)} /> : null}
        {task.command && task.command.length ? <Row label="Command" value={task.command.join(' ')} /> : null}
        {task.created_at && <Row label="Created" value={new Date(task.created_at).toLocaleString()} />}
      </Box>

      {portEntries.length > 0 && (
        <Box title="Port mappings">
          {portEntries.map(([container, host]) => (
            <Row key={container} label={`Container ${container}`} value={`Host ${host}`} />
          ))}
        </Box>
      )}

      {envEntries.length > 0 && (
        <Box title="Environment">
          {envEntries.map(([k, v]) => (
            <Row key={k} label={k} value={String(v)} />
          ))}
        </Box>
      )}

      {task.error_message ? (
        <Box title="Error">
          <Text style={S.errorText}>{task.error_message}</Text>
        </Box>
      ) : null}
    </ScrollView>
  );
};

const Row = ({ label, value, valueColor }) => (
  <View style={S.infoRow}>
    <Text style={S.infoLabel}>{label}</Text>
    <Text style={[S.infoValue, valueColor && { color: valueColor }]} numberOfLines={2}>{value}</Text>
  </View>
);
