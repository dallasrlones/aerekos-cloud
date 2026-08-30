import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, Alert, TextInput } from 'react-native';
import { Box } from '../../components/Box/Box';
import { Button } from '../../components/Button/Button';
import { computeManagerService } from '../../services/computeManagerService';
import { useProject } from '../../contexts/ProjectContext';
import { colors } from '../../styles/theme';
import { TaskDetailsStyles as S } from './TaskDetails.styles';
import { stackService } from '../../services/stackService';
import { edgeService } from '../../services/edgeService';
import { secretsManagerService } from '../../services/secretsManagerService';

const HIDDEN_ENV = new Set(['AEREKOS_ADOPTED']);
const statusColor = (status) => {
  switch (status) {
    case 'running': return '#4CAF50';
    case 'stopped': return '#FF9800';
    case 'pending': return '#2196F3';
    case 'failed': return '#F44336';
    case 'unhealthy': return '#F44336';
    default: return colors.textMuted;
  }
};

function isAdopted(task) {
  const env = task?.env || {};
  return env.AEREKOS_ADOPTED === '1' || env.AEREKOS_ADOPTED === 1;
}

export const ContainerDetails = ({ navigation, route }) => {
  const taskId = route.params?.containerId || route.params?.taskId;
  const { currentProject } = useProject();
  const projectId = currentProject?.id;

  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [logMode, setLogMode] = useState('live');
  const [logRows, setLogRows] = useState([]);
  const [logQuery, setLogQuery] = useState('');
  const [logLevel, setLogLevel] = useState('');
  const [metrics, setMetrics] = useState({ cpu: [], mem: [] });
  const [health, setHealth] = useState(null);
  const [hostnames, setHostnames] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [buildLogs, setBuildLogs] = useState([]);
  const [bindHost, setBindHost] = useState('');
  const [bindPort, setBindPort] = useState('');
  const [bindBusy, setBindBusy] = useState(false);
  const [bindError, setBindError] = useState('');
  const [cfToken, setCfToken] = useState('');
  const [cfAccount, setCfAccount] = useState('');
  const [cfZone, setCfZone] = useState('');
  const lastSince = useRef('');

  const loadLogs = useCallback(async (mode, append) => {
    if (!projectId || !taskId) return;
    const source = `compute.${taskId}`;
    try {
      const rows = await computeManagerService.queryLogs(projectId, {
        source,
        q: mode === 'historical' ? logQuery : undefined,
        level: mode === 'historical' && logLevel ? logLevel : undefined,
        since: mode === 'live' && lastSince.current ? lastSince.current : undefined,
        limit: 200,
      });
      const ordered = [...rows].reverse();
      if (ordered.length) lastSince.current = ordered[ordered.length - 1].created_at;
      if (append && mode === 'live') {
        setLogRows((prev) => [...prev, ...ordered].slice(-400));
      } else {
        setLogRows(ordered);
      }
      if (!rows.length && mode === 'live' && !append) {
        const text = await computeManagerService.getLogs(projectId, taskId, 200);
        if (text) setLogRows([{ id: 'docker', message: text, created_at: '', level: 'info' }]);
      }
    } catch (_) {
      if (!append) {
        try {
          const text = await computeManagerService.getLogs(projectId, taskId, 200);
          setLogRows(text ? [{ id: 'docker', message: text, created_at: '', level: 'info' }] : []);
        } catch (__) {
          setLogRows([]);
        }
      }
    }
  }, [projectId, taskId, logQuery, logLevel]);

  const load = useCallback(async () => {
    if (!projectId || !taskId) return;
    try {
      setError(null);
      const t = await computeManagerService.getTask(projectId, taskId, true);
      setTask(t);
      const [h, hosts, pipes, cpu, mem] = await Promise.all([
        computeManagerService.getHealth(projectId, taskId).catch(() => null),
        computeManagerService.listHostnames(projectId).catch(() => []),
        computeManagerService.listPipelines(projectId).catch(() => []),
        computeManagerService.queryMetrics(projectId, { metric_name: 'compute.cpu_percent', task_id: taskId, limit: 40 }).catch(() => []),
        computeManagerService.queryMetrics(projectId, { metric_name: 'compute.memory_bytes', task_id: taskId, limit: 40 }).catch(() => []),
      ]);
      setHealth(h);
      setHostnames((hosts || []).filter((x) => String(x.target_id || '') === String(taskId)));
      const linked = (pipes || []).filter((p) => String(p.target_container_id || p.task_id || '') === String(taskId));
      setPipelines(linked);
      setMetrics({ cpu: cpu || [], mem: mem || [] });
      if (linked[0]?.id) {
        const built = await computeManagerService.queryLogs(projectId, {
          source: `cicd.${linked[0].id}`,
          limit: 100,
        }).catch(() => []);
        setBuildLogs(built || []);
      } else {
        setBuildLogs([]);
      }
      await loadLogs(logMode, false);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load container');
    } finally {
      setLoading(false);
    }
  }, [projectId, taskId, loadLogs, logMode]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (logMode !== 'live' || !projectId || !taskId) return undefined;
    const id = setInterval(() => { loadLogs('live', true); }, 2000);
    return () => clearInterval(id);
  }, [logMode, projectId, taskId, loadLogs]);

  const runAction = async (fn, label) => {
    setActionLoading(true);
    try {
      await fn();
      await load();
    } catch (err) {
      Alert.alert(label, err.response?.data?.error?.message || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = () => {
    const adopted = isAdopted(task);
    Alert.alert(
      'Delete container',
      adopted
        ? `Unregister "${task?.name}"? The live container will keep running.`
        : `Delete "${task?.name}"? This stops and removes the container.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await computeManagerService.deleteTask(projectId, taskId);
              await stackService.unrecord(projectId, { service: 'compute_manager', name: task?.name });
              navigation.goBack();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error?.message || err.message || 'Failed to delete');
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
          <Text style={S.errorText}>{error || 'Container not found'}</Text>
          <Button title="Go back" onPress={() => navigation.goBack()} style={{ marginTop: 16 }} />
        </Box>
      </ScrollView>
    );
  }

  const envEntries = Object.entries(task.env || {}).filter(([k]) => !HIDDEN_ENV.has(k) && !String(k).startsWith('AEREKOS_'));
  const portEntries = Object.entries(task.port_bindings || {});
  const lastCpu = metrics.cpu[0];
  const lastMem = metrics.mem[0];

  return (
    <ScrollView
      style={S.container}
      contentContainerStyle={S.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
    >
      <Text style={S.title}>{task.name}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        <View style={[S.statusBadge, { backgroundColor: statusColor(task.status) + '20', marginTop: 0 }]}>
          <View style={[S.statusDot, { backgroundColor: statusColor(task.status) }]} />
          <Text style={[S.statusText, { color: statusColor(task.status) }]}>{task.status}</Text>
        </View>
        {isAdopted(task) ? (
          <View style={[S.statusBadge, { backgroundColor: colors.textMuted + '20', marginTop: 0 }]}>
            <Text style={[S.statusText, { color: colors.textMuted }]}>Adopted</Text>
          </View>
        ) : null}
        {health ? (
          <View style={[S.statusBadge, { backgroundColor: statusColor(health.status) + '20', marginTop: 0 }]}>
            <Text style={[S.statusText, { color: statusColor(health.status) }]}>
              {health.running ? 'healthy' : (health.status || 'unhealthy')}
            </Text>
          </View>
        ) : null}
      </View>

      <Box title="Actions">
        <View style={S.actions}>
          {task.status === 'running' ? (
            <Button title="Stop" onPress={() => runAction(() => computeManagerService.stopTask(projectId, taskId), 'Stop')} loading={actionLoading} variant="secondary" style={S.actionButton} />
          ) : (
            <Button title="Start" onPress={() => runAction(() => computeManagerService.startTask(projectId, taskId), 'Start')} loading={actionLoading} variant="secondary" style={S.actionButton} />
          )}
          <Button title="Restart" onPress={() => runAction(() => computeManagerService.restartTask(projectId, taskId), 'Restart')} loading={actionLoading} variant="secondary" style={S.actionButton} />
          <Button title="Refresh" onPress={load} variant="secondary" style={S.actionButton} />
          <Button
            title={`Scale (${task.desired == null ? 1 : task.desired})`}
            onPress={() => runAction(() => computeManagerService.scaleTask(projectId, taskId, task.desired === 0 ? 1 : 0, { balancer_id: task.balancer_id }), 'Scale')}
            variant="secondary"
            style={S.actionButton}
          />
          <Button title="Delete" onPress={handleDelete} variant="secondary" style={S.actionButton} />
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
        <Row label="Device" value={task.worker_hostname || task.worker_id || 'unknown'} />
        <Row label="Environment" value={task.environment || 'prod'} />
      </Box>

      <Box title="Public URL">
        {hostnames.map((h) => (
          <View key={h.id || h.hostname} style={{ marginBottom: 8 }}>
            <Row label={h.hostname} value={`port ${h.port || ''}`} />
            <Button
              title="Unbind"
              variant="secondary"
              onPress={async () => {
                try {
                  await edgeService.unbind(projectId, h.id);
                  await load();
                } catch (err) {
                  Alert.alert('Unbind', err.response?.data?.error?.message || err.message);
                }
              }}
            />
          </View>
        ))}
        <Text style={{ color: colors.textMuted, marginBottom: 8 }}>
          Bind a published host port to a hostname on this device’s tunnel.
        </Text>
        {portEntries.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            {portEntries.map(([container, host]) => {
              const hostPort = Array.isArray(host) ? (host[0]?.HostPort || host[0]) : host;
              return (
                <Button
                  key={container}
                  title={`:${hostPort}`}
                  variant={String(bindPort) === String(hostPort) ? 'primary' : 'secondary'}
                  onPress={() => setBindPort(String(hostPort))}
                />
              );
            })}
          </View>
        ) : (
          <Text style={{ color: colors.textMuted, marginBottom: 8 }}>No host-published port on this container.</Text>
        )}
        <TextInput
          value={bindHost}
          onChangeText={setBindHost}
          placeholder="app.aerekos.com or subdomain"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 8, color: colors.textPrimary, marginBottom: 8 }}
        />
        {bindError ? <Text style={S.errorText}>{bindError}</Text> : null}
        <Button
          title={bindBusy ? 'Binding…' : 'Bind'}
          loading={bindBusy}
          onPress={async () => {
            setBindBusy(true);
            setBindError('');
            try {
              if (cfToken.trim()) {
                await secretsManagerService.createSecret(projectId, {
                  name: 'cloudflare_api_token',
                  value: cfToken.trim(),
                  environment: task.environment || 'prod',
                });
              }
              if (cfAccount.trim()) {
                await secretsManagerService.createSecret(projectId, {
                  name: 'cloudflare_account_id',
                  value: cfAccount.trim(),
                  environment: task.environment || 'prod',
                });
              }
              if (cfZone.trim()) {
                await secretsManagerService.createSecret(projectId, {
                  name: 'cloudflare_zone_id',
                  value: cfZone.trim(),
                  environment: task.environment || 'prod',
                });
              }
              let hostname = bindHost.trim().toLowerCase();
              if (hostname && !hostname.includes('.')) hostname = `${hostname}.aerekos.com`;
              await edgeService.bind(projectId, {
                task_id: taskId,
                port: bindPort,
                hostname,
                environment: task.environment || 'prod',
              });
              setBindHost('');
              await load();
            } catch (err) {
              setBindError(err.response?.data?.error?.message || err.message || 'Bind failed');
            } finally {
              setBindBusy(false);
            }
          }}
        />
        <Text style={{ color: colors.textMuted, marginTop: 12, marginBottom: 6 }}>
          Missing Cloudflare token? Paste it here (saved to this environment’s secrets), then Bind again.
        </Text>
        <TextInput value={cfToken} onChangeText={setCfToken} placeholder="API token" placeholderTextColor={colors.textMuted} secureTextEntry style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 8, color: colors.textPrimary, marginBottom: 8 }} />
        <TextInput value={cfAccount} onChangeText={setCfAccount} placeholder="Account ID" placeholderTextColor={colors.textMuted} autoCapitalize="none" style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 8, color: colors.textPrimary, marginBottom: 8 }} />
        <TextInput value={cfZone} onChangeText={setCfZone} placeholder="Zone ID" placeholderTextColor={colors.textMuted} autoCapitalize="none" style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 8, color: colors.textPrimary, marginBottom: 8 }} />
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

      <Box title="Metrics">
        <Row label="CPU" value={lastCpu ? `${lastCpu.value}%` : 'no samples yet'} />
        <Row label="Memory" value={lastMem ? `${lastMem.value} bytes` : 'no samples yet'} />
        <Button title="Open in Metrics" onPress={() => navigation.navigate('managerConsole', { serviceName: 'metrics_manager' })} variant="secondary" style={{ marginTop: 8 }} />
      </Box>

      <Box title="CI / CD">
        {pipelines.length ? pipelines.map((p) => (
          <View key={p.id} style={{ marginBottom: 8 }}>
            <Row label={p.name} value={p.state || 'idle'} />
            <Button title="Open pipeline" onPress={() => navigation.navigate('cicdManager')} variant="secondary" />
          </View>
        )) : (
          <Text style={{ color: colors.textMuted }}>No pipeline targets this container.</Text>
        )}
        {buildLogs.length ? (
          <Text style={{ fontFamily: 'monospace', fontSize: 12, color: colors.textMuted, marginTop: 8 }} selectable>
            {buildLogs.map((r) => r.message).join('\n')}
          </Text>
        ) : null}
      </Box>

      <Box title="Logs">
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <Button title="Live" onPress={() => { lastSince.current = ''; setLogMode('live'); loadLogs('live', false); }} variant={logMode === 'live' ? 'primary' : 'secondary'} />
          <Button title="Historical" onPress={() => { setLogMode('historical'); loadLogs('historical', false); }} variant={logMode === 'historical' ? 'primary' : 'secondary'} />
        </View>
        {logMode === 'historical' ? (
          <View style={{ marginBottom: 8 }}>
            <TextInput
              value={logQuery}
              onChangeText={setLogQuery}
              placeholder="Search messages"
              placeholderTextColor={colors.textMuted}
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 8, color: colors.textPrimary, marginBottom: 8 }}
              autoCapitalize="none"
            />
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              {['', 'info', 'warn', 'error'].map((lv) => (
                <Button key={lv || 'all'} title={lv || 'all'} onPress={() => setLogLevel(lv)} variant={logLevel === lv ? 'primary' : 'secondary'} />
              ))}
            </View>
            <Button title="Search" onPress={() => loadLogs('historical', false)} variant="secondary" />
          </View>
        ) : null}
        <Text style={{ fontFamily: 'monospace', fontSize: 12, color: colors.textMuted, minHeight: 160 }} selectable>
          {logRows.length
            ? logRows.map((r) => `${r.created_at ? r.created_at.slice(11, 19) + ' ' : ''}${r.level ? `[${r.level}] ` : ''}${r.message}`).join('\n')
            : '(no logs yet)'}
        </Text>
        <Button
          title="Open in Logs"
          onPress={() => navigation.navigate('managerConsole', { serviceName: 'logs_manager' })}
          variant="secondary"
          style={{ marginTop: 8 }}
        />
      </Box>
    </ScrollView>
  );
};

export const TaskDetails = ContainerDetails;

const Row = ({ label, value, valueColor }) => (
  <View style={S.infoRow}>
    <Text style={S.infoLabel}>{label}</Text>
    <Text style={[S.infoValue, valueColor && { color: valueColor }]} numberOfLines={2}>{value}</Text>
  </View>
);
