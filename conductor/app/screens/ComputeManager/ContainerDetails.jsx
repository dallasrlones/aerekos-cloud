import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, Alert, TextInput, Linking } from 'react-native';
import { Box } from '../../components/Box/Box';
import { Button } from '../../components/Button/Button';
import { computeManagerService } from '../../services/computeManagerService';
import { useProject } from '../../contexts/ProjectContext';
import { colors } from '../../styles/theme';
import { TaskDetailsStyles as S } from './TaskDetails.styles';
import { stackService } from '../../services/stackService';
import { edgeService } from '../../services/edgeService';
import { secretsManagerService } from '../../services/secretsManagerService';
import {
  formatPortMapping,
  publishedHostPort,
  resolveTaskDevice,
  stripDockerLogMux,
} from '../../utils/tunnelAttachments';
import websocketService from '../../services/websocketService';
import { applyLogAppend } from '../../utils/liveEvents';
import { Chart } from '../../components/Chart/Chart';
import { formatBytes, formatCpu } from '../../utils/formatBytes';
import { ScreenTabs } from '../../components/ScreenTabs/ScreenTabs';

const HIDDEN_ENV = new Set(['AEREKOS_ADOPTED']);
const SECRET_ENV_RE = /password|secret|token|key|credential|auth|private|jwt/i;
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
  const [liveStats, setLiveStats] = useState(null);
  const [statsError, setStatsError] = useState(null);
  const [spark, setSpark] = useState([]);
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
  const [namedTunnels, setNamedTunnels] = useState([]);
  const [showCfPaste, setShowCfPaste] = useState(false);
  const [tab, setTab] = useState('overview');
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
      const ordered = [...rows].reverse().map((r) => (
        r?.message ? { ...r, message: stripDockerLogMux(r.message) } : r
      ));
      if (ordered.length) lastSince.current = ordered[ordered.length - 1].created_at;
      if (append && mode === 'live') {
        setLogRows((prev) => [...prev, ...ordered].slice(-400));
      } else {
        setLogRows(ordered);
      }
      if (!rows.length && mode === 'live' && !append) {
        const text = await computeManagerService.getLogs(projectId, taskId, 200);
        if (text) setLogRows([{ id: 'docker', message: stripDockerLogMux(text), created_at: '', level: 'info' }]);
      }
    } catch (_) {
      if (!append) {
        try {
          const text = await computeManagerService.getLogs(projectId, taskId, 200);
          setLogRows(text ? [{ id: 'docker', message: stripDockerLogMux(text), created_at: '', level: 'info' }] : []);
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
      const [h, hosts, pipes, cpu, mem, named] = await Promise.all([
        computeManagerService.getHealth(projectId, taskId).catch(() => null),
        computeManagerService.listHostnames(projectId).catch(() => []),
        computeManagerService.listPipelines(projectId).catch(() => []),
        computeManagerService.queryMetrics(projectId, { metric_name: 'compute.cpu_percent', task_id: taskId, limit: 40 }).catch((e) => {
          console.warn('[container] cpu series', e.message);
          return [];
        }),
        computeManagerService.queryMetrics(projectId, { metric_name: 'compute.memory_bytes', task_id: taskId, limit: 40 }).catch((e) => {
          console.warn('[container] mem series', e.message);
          return [];
        }),
        edgeService.namedTunnels(projectId).catch(() => []),
      ]);
      setHealth(h);
      setNamedTunnels(named || []);
      await edgeService.importTaskHostnames(projectId, taskId).catch(() => null);
      const hostsAfter = await computeManagerService.listHostnames(projectId).catch(() => hosts);
      setHostnames((hostsAfter || hosts || []).filter((x) => String(x.target_id || '') === String(taskId)));
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

  const refreshStats = useCallback(async () => {
    if (!projectId || !taskId) return;
    try {
      const s = await computeManagerService.getTaskStats(projectId, taskId);
      setLiveStats(s);
      setStatsError(s?.error || null);
      if (s && Number.isFinite(Number(s.cpu_percent))) {
        setSpark((prev) => [...prev, {
          timestamp: Date.now(),
          usagePercent: Number(s.cpu_percent),
          memoryMb: Number(s.memory_bytes) / (1024 * 1024),
        }].slice(-40));
      }
    } catch (e) {
      setStatsError(e.response?.data?.error?.message || e.message || 'stats failed');
    }
  }, [projectId, taskId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    refreshStats();
    if (task?.status !== 'running') return undefined;
    const t = setInterval(refreshStats, 5000);
    return () => clearInterval(t);
  }, [refreshStats, task?.status]);

  useEffect(() => {
    if (logMode !== 'live' || !projectId || !taskId) return undefined;
    const room = `logs:compute.${taskId}`;
    websocketService.subscribeRoom(room);
    const off = websocketService.on('log:appended', (payload) => {
      const incoming = applyLogAppend([], payload, { source: `compute.${taskId}`, projectId });
      if (!incoming.length) return;
      const cleaned = incoming.map((r) => (
        r?.message ? { ...r, message: stripDockerLogMux(r.message) } : r
      ));
      if (cleaned.length) lastSince.current = cleaned[cleaned.length - 1].created_at || lastSince.current;
      setLogRows((prev) => [...prev, ...cleaned].slice(-400));
    });
    const offReconnect = websocketService.on('console:reconnected', () => {
      loadLogs('live', true);
    });
    return () => {
      off();
      offReconnect();
      websocketService.unsubscribeRoom(room);
    };
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

  const envEntries = Object.entries(task.env || {}).filter(([k]) => (
    !HIDDEN_ENV.has(k) && !String(k).startsWith('AEREKOS_') && !SECRET_ENV_RE.test(k)
  ));
  const portEntries = Object.entries(task.port_bindings || {});
  const lastCpu = liveStats?.cpu_percent != null ? liveStats.cpu_percent : metrics.cpu[0]?.value;
  const lastMem = liveStats?.memory_bytes != null ? liveStats.memory_bytes : metrics.mem[0]?.value;
  const cpuLabel = lastCpu != null && lastCpu !== '' ? formatCpu(lastCpu) : (statsError || (task.status === 'running' ? 'waiting…' : 'not running'));
  const memLabel = lastMem != null && lastMem !== '' ? formatBytes(lastMem) : (statsError || (task.status === 'running' ? 'waiting…' : 'not running'));
  const adopted = isAdopted(task);
  const { deviceLabel, defaultTunnel } = resolveTaskDevice(task, hostnames, namedTunnels);
  const tunnelLabel = (h) => {
    const t = namedTunnels.find((n) => n.cf_tunnel_id === h.tunnel_id || n.id === h.tunnel_id);
    return t?.display_name || h.tunnel_id || 'tunnel';
  };
  const openPublic = (hostname) => {
    const url = /^https?:\/\//i.test(hostname) ? hostname : `https://${hostname}`;
    Linking.openURL(url).catch(() => {});
  };

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
        {adopted ? (
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
      {task.error_message ? (
        <Box title="Host status">
          <Text style={{ color: '#F44336' }}>{task.error_message}</Text>
          <Text style={{ color: colors.textMuted, marginTop: 8 }}>
            The Cloud record is still here, but Docker no longer has this container. Start recreates it from the saved image and spec.
          </Text>
        </Box>
      ) : null}

      <Box title="Actions">
        <View style={S.actions}>
          {task.status === 'running' ? (
            <Button title="Stop" onPress={() => runAction(() => computeManagerService.stopTask(projectId, taskId), 'Stop')} loading={actionLoading} variant="secondary" style={S.actionButton} />
          ) : (
            <Button title="Start" onPress={() => runAction(() => computeManagerService.startTask(projectId, taskId), 'Start')} loading={actionLoading} variant="secondary" style={S.actionButton} />
          )}
          <Button title="Restart" onPress={() => runAction(() => computeManagerService.restartTask(projectId, taskId), 'Restart')} loading={actionLoading} variant="secondary" style={S.actionButton} />
          <Button title="Refresh" onPress={load} variant="secondary" style={S.actionButton} />
          {adopted ? null : (
            <Button
              title={`Scale (${task.desired == null ? 1 : task.desired})`}
              onPress={() => runAction(() => computeManagerService.scaleTask(projectId, taskId, task.desired === 0 ? 1 : 0, { balancer_id: task.balancer_id }), 'Scale')}
              variant="secondary"
              style={S.actionButton}
            />
          )}
          <Button title="Delete" onPress={handleDelete} variant="secondary" style={S.actionButton} />
        </View>
      </Box>
      <ScreenTabs
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'network', label: 'Network' },
          { id: 'metrics', label: 'Metrics' },
          { id: 'logs', label: 'Logs' },
          { id: 'ci', label: 'CI' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'overview' && adopted ? (
        <Box title="Adopted">
          <Text style={{ color: colors.textMuted }}>
            This container was already running on the host — the console tracks it instead of launching a new one.
            Start, stop, and restart still work. Delete only unregisters it; the live container keeps running.
            Image rebuild is blocked so we do not replace someone else’s process.
          </Text>
        </Box>
      ) : null}

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
        <Row label="Device" value={deviceLabel} />
        <Row label="Environment" value={task.environment || 'prod'} />
      </Box>

      {tab === 'network' ? <Box title="Public URL">
        <Row
          label="Device tunnel"
          value={defaultTunnel
            ? `${defaultTunnel.display_name} · ${defaultTunnel.status || 'unknown'}`
            : 'None — attach a tunnel on Device Details if you need a public hostname'}
        />
        {hostnames.map((h) => (
          <View key={h.id || h.hostname} style={{ marginBottom: 8 }}>
            <Row label={h.hostname} value={`:${h.port || ''} · ${tunnelLabel(h)}`} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Button title="Open" variant="secondary" onPress={() => openPublic(h.hostname)} />
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
          </View>
        ))}
        {!hostnames.length && portEntries.length ? (
          <Text style={{ color: colors.textMuted, marginBottom: 8 }}>Not attached — bind a published port below.</Text>
        ) : null}
        <Text style={{ color: colors.textMuted, marginBottom: 8 }}>
          {defaultTunnel
            ? `Bind merges onto ${defaultTunnel.display_name}. This does not create a tunnel.`
            : 'This device has no Cloudflare tunnel. Open Device Details to attach one only if you need a public URL.'}
        </Text>
        {portEntries.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            {portEntries.map(([container, host]) => {
              const hostPort = publishedHostPort(host);
              return (
                <Button
                  key={container}
                  title={hostPort ? `:${hostPort}` : String(container)}
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
          title={!defaultTunnel ? 'Attach a tunnel first' : (bindBusy ? 'Binding…' : 'Bind')}
          loading={bindBusy}
          disabled={!defaultTunnel}
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
              const port = bindPort || publishedHostPort(portEntries[0]?.[1]);
              if (!hostname || !port) {
                setBindError('Hostname and port are required.');
                return;
              }
              await edgeService.attachHostname(projectId, {
                task_id: taskId,
                port,
                hostname,
                tunnel_id: defaultTunnel.cf_tunnel_id || defaultTunnel.id,
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
        <Button
          title={showCfPaste ? 'Hide Cloudflare paste' : 'Paste Cloudflare secrets (only if missing)'}
          variant="secondary"
          onPress={() => setShowCfPaste((v) => !v)}
          style={{ marginTop: 12 }}
        />
        {showCfPaste ? (
          <>
            <Text style={{ color: colors.textMuted, marginTop: 12, marginBottom: 6 }}>
              Saved to this environment’s secrets, then Bind again.
            </Text>
            <TextInput value={cfToken} onChangeText={setCfToken} placeholder="API token" placeholderTextColor={colors.textMuted} secureTextEntry style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 8, color: colors.textPrimary, marginBottom: 8 }} />
            <TextInput value={cfAccount} onChangeText={setCfAccount} placeholder="Account ID" placeholderTextColor={colors.textMuted} autoCapitalize="none" style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 8, color: colors.textPrimary, marginBottom: 8 }} />
            <TextInput value={cfZone} onChangeText={setCfZone} placeholder="Zone ID" placeholderTextColor={colors.textMuted} autoCapitalize="none" style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 8, color: colors.textPrimary, marginBottom: 8 }} />
          </>
        ) : null}
      </Box> : null}

      {tab === 'overview' && portEntries.length > 0 && (
        <Box title="Port mappings">
          {portEntries.map(([container, host]) => (
            <Row key={container} label={`Container ${String(container).split('/')[0]}`} value={formatPortMapping(container, host)} />
          ))}
        </Box>
      )}

      {tab === 'overview' && envEntries.length > 0 && (
        <Box title="Environment">
          {envEntries.map(([k, v]) => (
            <Row key={k} label={k} value={String(v)} />
          ))}
        </Box>
      )}

      {tab === 'overview' && task.error_message ? (
        <Box title="Error">
          <Text style={S.errorText}>{task.error_message}</Text>
        </Box>
      ) : null}

      {tab === 'metrics' ? <Box title="Metrics">
        <Row label="CPU" value={cpuLabel} />
        <Row label="Memory" value={memLabel} />
        {statsError && lastCpu != null ? (
          <Text style={{ color: colors.textMuted, marginTop: 4 }}>{statsError}</Text>
        ) : null}
        {spark.length >= 2 ? (
          <View style={{ marginTop: 12 }}>
            <Chart title="CPU" data={spark} dataKey="usagePercent" color="#4CAF50" height={160} unit="%" />
          </View>
        ) : null}
        <Button title="Open in Metrics" onPress={() => navigation.navigate('managerConsole', { serviceName: 'metrics_manager' })} variant="secondary" style={{ marginTop: 8 }} />
      </Box> : null}

      {tab === 'ci' ? <Box title="CI / CD">
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
      </Box> : null}

      {tab === 'logs' ? <Box title="Logs">
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
      </Box> : null}
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
