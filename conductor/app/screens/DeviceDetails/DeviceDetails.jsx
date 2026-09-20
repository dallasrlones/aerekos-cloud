import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, Platform, StyleSheet, TouchableOpacity, Alert, TextInput } from 'react-native';
import { deviceService, deviceLabel, hostPartLabel } from '../../services/deviceService';
import websocketService from '../../services/websocketService';
import { useAuth } from '../../contexts/AuthContext';
import { useProject } from '../../contexts/ProjectContext';
import { edgeService } from '../../services/edgeService';
import { Box } from '../../components/Box/Box';
import { Chart } from '../../components/Chart/Chart';
import { NetworkChart } from '../../components/Chart/NetworkChart';
import { ServerVisual } from '../../components/ServerVisual/ServerVisual';
import { AnimusVisual } from '../../components/AnimusVisual/AnimusVisual';
import { AnimusBackground, AnimusPanel, AnimusStat, AnimusToggle } from '../../components/Animus';
import { DeviceDetailsStyles as S } from './DeviceDetails.styles';
import { DeviceContainers } from './DeviceContainers';
import { ScreenTabs } from '../../components/ScreenTabs/ScreenTabs';
import { colors, animus } from '../../styles/theme';

const MAX_HISTORY = 60;
const VIEWS = [{ key: 'animus', label: 'Preview' }, { key: 'data', label: 'Data' }];

const num = (v, d = 0) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : d;
};

const fmtBytes = (bytes) => {
  const b = num(bytes);
  if (b <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(b) / Math.log(k)));
  return `${parseFloat((b / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * Math.max(0, Math.min(1, t))));

// Usage 0..1 -> colour. grey -> gold up to 80%, then gold -> red, deep red at 100%.
// Mirrors the 3D scene's danger thresholds so the Data tab reads the same.
const GREY = [189, 189, 189];
const GOLD = [212, 175, 55];
const RED = [229, 72, 77];
const RED_DEEP = [176, 22, 11];
const usageColor = (u) => {
  const x = Math.max(0, Math.min(1, u));
  if (x < 0.8) return `rgb(${mix(GREY, GOLD, x / 0.8).join(', ')})`;
  if (x < 1) return `rgb(${mix(GOLD, RED, (x - 0.8) / 0.2).join(', ')})`;
  return `rgb(${RED_DEEP.join(', ')})`;
};
const coreColor = usageColor;

export const DeviceDetails = ({ route, navigation }) => {
  const { deviceId } = route?.params || {};
  const { isAuthenticated, getToken } = useAuth();
  const { currentProject } = useProject();
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [liveData, setLiveData] = useState(null);
  const [lastHeartbeat, setLastHeartbeat] = useState(null);
  const [view, setView] = useState('animus');
  const [dataTab, setDataTab] = useState('telemetry');
  const [dataHistory, setDataHistory] = useState({ cpu: [], ram: [], disk: [], network: [] });
  const dataHistoryRef = useRef({ cpu: [], ram: [], disk: [], network: [] });
  const [updating, setUpdating] = useState(false);
  const [updateMsg, setUpdateMsg] = useState(null);
  const [hostBusy, setHostBusy] = useState(null);
  const [hostMsg, setHostMsg] = useState(null);
  const [vpcs, setVpcs] = useState([]);
  const [networkInfo, setNetworkInfo] = useState(null);
  const [meshKey, setMeshKey] = useState(null);
  const [meshBusy, setMeshBusy] = useState(false);
  const [newTunnelName, setNewTunnelName] = useState('');
  const [newTunnelToken, setNewTunnelToken] = useState(null);
  const [tunnelBusy, setTunnelBusy] = useState(false);

  const confirmHostUpdate = (target, onYes) => {
    const label = target === 'os' ? 'OS' : 'Docker';
    const msg = `Update host ${label} on this device? This runs apt on the host. No automatic reboot.`;
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.confirm) {
      if (window.confirm(msg)) onYes();
      return;
    }
    Alert.alert(`Update ${label}`, msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: `Update ${label}`, onPress: onYes },
    ]);
  };

  const applyHostResult = (result) => {
    const host = result?.os || result?.docker
      ? {
          os: result.os,
          docker: result.docker,
          platform: result.platform,
          probed_at: result.probed_at,
        }
      : result?.after || null;
    if (host) {
      setDevice((prev) => (prev ? { ...prev, resources: { ...prev.resources, host } } : prev));
    }
    if (result?.reboot_required) {
      setHostMsg('Update finished. Reboot required (not performed).');
    } else if (result?.message) {
      setHostMsg(result.message);
    }
  };

  const handleHostCheck = async () => {
    try {
      setHostBusy('check');
      setHostMsg(null);
      const result = await deviceService.checkHost(deviceId);
      applyHostResult(result);
    } catch (e) {
      const status = e?.response?.status;
      setHostMsg(status === 503 ? 'Device is offline.' : 'Failed to check host updates.');
    } finally {
      setHostBusy(null);
    }
  };

  const handleHostUpdate = (target) => {
    confirmHostUpdate(target, async () => {
      try {
        setHostBusy(target);
        setHostMsg(null);
        const result = await deviceService.updateHost(deviceId, target);
        applyHostResult(result);
        if (!result?.ok && result?.error) {
          setHostMsg(result.error);
        }
      } catch (e) {
        const status = e?.response?.status;
        const msg = e?.response?.data?.error?.message;
        setHostMsg(status === 503 ? 'Device is offline.' : (msg || `Failed to update ${target}.`));
      } finally {
        setHostBusy(null);
      }
    });
  };

  const handleUpdate = async () => {
    try {
      setUpdating(true);
      setUpdateMsg(null);
      const res = await deviceService.requestUpdate(deviceId);
      setUpdateMsg(`Update requested → ${res?.target_version || 'latest'}. The device is pulling from the conductor and redeploying…`);
    } catch (_e) {
      setUpdateMsg('Failed to request update. Try again.');
    } finally {
      setUpdating(false);
    }
  };

  const applyLive = useCallback((resources, timestamp, workerId) => {
    if (!resources) return;
    if (workerId && deviceId && workerId !== deviceId) return;
    setLiveData(resources);
    setLastHeartbeat(timestamp || resources.timestamp || new Date().toISOString());
    if (resources.host) {
      setDevice((prev) => (prev ? { ...prev, resources: { ...prev.resources, host: resources.host } } : prev));
    }

    const ts = new Date(timestamp || resources.timestamp || Date.now()).getTime();
    const h = { ...dataHistoryRef.current };
    const push = (key, point) => {
      const last = h[key][h[key].length - 1];
      if (last && Math.abs(last.timestamp - point.timestamp) < 400) return;
      h[key] = [...h[key], point];
      if (h[key].length > MAX_HISTORY) h[key] = h[key].slice(-MAX_HISTORY);
    };
    if (resources.cpu) {
      push('cpu', { timestamp: ts, usagePercent: num(resources.cpu.usagePercent || resources.cpu.usage || resources.cpu.usage_percent) });
    }
    if (resources.ram) push('ram', { timestamp: ts, usagePercent: num(resources.ram.usagePercent || resources.ram.usage_percent) });
    if (resources.disk) push('disk', { timestamp: ts, usagePercent: num(resources.disk.usagePercent || resources.disk.usage_percent) });
    if (resources.network) {
      push('network', {
        timestamp: ts,
        rx_bytes_per_sec: num(resources.network.rx_bytes_per_sec),
        tx_bytes_per_sec: num(resources.network.tx_bytes_per_sec),
      });
    }
    dataHistoryRef.current = h;
    setDataHistory(h);
  }, [deviceId]);

  useEffect(() => {
    if (!deviceId) {
      setLoading(false);
      return undefined;
    }
    loadDevice();

    let cancelled = false;
    const unsubs = [];
    if (isAuthenticated) {
      getToken().then((token) => {
        if (cancelled || !token) return;
        websocketService.connect(token);
        const subscribe = () => websocketService.subscribeToWorker(deviceId);
        unsubs.push(websocketService.on('connected', subscribe));
        if (websocketService.isConnected || websocketService.socket?.connected) subscribe();
        const onLive = (data) => applyLive(data?.resources, data?.timestamp, data?.workerId);
        unsubs.push(websocketService.on('worker:live:update', onLive));
        unsubs.push(websocketService.on('worker:resources:updated', onLive));
        if (cancelled) unsubs.forEach((u) => u && u());
      });
    }

    const poll = setInterval(() => {
      deviceService.getDevice(deviceId).then((row) => {
        if (!row) return;
        setDevice(row);
        if (row.resources && (row.resources.cpu || row.resources.ram)) {
          applyLive(row.resources, row.resources.timestamp || row.last_seen, row.id);
        }
      }).catch(() => {});
    }, 3000);

    return () => {
      cancelled = true;
      unsubs.forEach((u) => u && u());
      websocketService.unsubscribeFromWorker(deviceId);
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, isAuthenticated, applyLive]);

  const loadDevice = async () => {
    if (!deviceId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const [deviceData, vpcList, net] = await Promise.all([
        deviceService.getDevice(deviceId),
        deviceService.listVpcs().catch(() => []),
        deviceService.getNetwork(deviceId).catch(() => null),
      ]);
      setDevice(deviceData);
      setVpcs(vpcList);
      setNetworkInfo(net);
    } catch (error) {
      console.error('Failed to load device:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDevice();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const formatTime = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleTimeString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return '#4CAF50';
      case 'offline': return '#F44336';
      case 'degraded': return '#FF9800';
      default: return '#9E9E9E';
    }
  };

  if (!deviceId) {
    return (
      <View style={S.root}><AnimusBackground /><Text style={S.errorText}>Device ID is missing</Text></View>
    );
  }
  if (loading) {
    return (
      <View style={[S.root, { justifyContent: 'center' }]}>
        <AnimusBackground />
        <ActivityIndicator size="large" color={animus.gold} />
      </View>
    );
  }
  if (!device) {
    return (
      <View style={S.root}><AnimusBackground /><Text style={S.errorText}>Device not found</Text></View>
    );
  }

  // Live metrics (fall back to last stored resources so the scene is never empty).
  const m = liveData || device.resources || {};
  const cpu = m.cpu || {};
  const ram = m.ram || {};
  const disk = m.disk || {};
  const net = m.network || {};
  const procInfo = m.processes || {};
  const procList = Array.isArray(procInfo.list) ? procInfo.list : [];
  const perCore = Array.isArray(cpu.perCore) ? cpu.perCore : [];
  const cores = perCore.length || num(device.resources?.cpu_cores, 8);

  const cpuPct = num(cpu.usagePercent || cpu.usage);
  const ramTotal = num(ram.total_gb || device.resources?.ram_gb);
  const ramUsed = num(ram.used_gb);
  const ramAvail = num(ram.available_gb, Math.max(0, ramTotal - ramUsed));
  const ramPct = num(ram.usagePercent, ramTotal ? (ramUsed / ramTotal) * 100 : 0);
  const diskTotal = num(disk.total_gb || device.resources?.disk_gb);
  const diskUsed = num(disk.used_gb);
  const diskAvail = num(disk.available_gb, Math.max(0, diskTotal - diskUsed));
  const diskPct = num(disk.usagePercent, diskTotal ? (diskUsed / diskTotal) * 100 : 0);
  const diskRead = num(disk.read_bytes_per_sec);
  const diskWrite = num(disk.write_bytes_per_sec);
  const linkMbps = num(device.resources?.network_mbps);
  const isOnline = device.status === 'online';
  const host = device.resources?.host || liveData?.host || null;
  const osLabel = hostPartLabel(host?.os) || '—';
  const dockerLabel = hostPartLabel(host?.docker) || '—';
  const osSupported = host?.os?.supported !== false;
  const dockerSupported = host?.docker?.supported !== false;

  const hostPanel = (
    <AnimusPanel title="Host OS / Docker" style={S.panelGap}>
      <Text style={[S.detailValue, { marginBottom: 8 }]}>
        OS: {osLabel}
        {host?.os?.pretty_name ? ` · ${host.os.pretty_name}` : ''}
      </Text>
      <Text style={[S.detailValue, { marginBottom: 8 }]}>
        Docker: {dockerLabel}
        {host?.docker?.version ? ` · ${host.docker.version}` : ''}
      </Text>
      {host?.os?.reboot_required ? (
        <Text style={[S.detailLabel, { marginBottom: 8, color: '#FF9800' }]}>Reboot required (not performed)</Text>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <TouchableOpacity
          onPress={handleHostCheck}
          disabled={!!hostBusy}
          activeOpacity={0.8}
          style={{
            backgroundColor: hostBusy ? '#7a5c12' : '#3d4654',
            paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>
            {hostBusy === 'check' ? 'Checking…' : 'Check host'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleHostUpdate('os')}
          disabled={!!hostBusy || !osSupported || !isOnline}
          activeOpacity={0.8}
          style={{
            backgroundColor: hostBusy === 'os' ? '#7a5c12' : '#D4AF37',
            opacity: !osSupported || !isOnline ? 0.45 : 1,
            paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8,
          }}
        >
          <Text style={{ color: '#10131a', fontWeight: '700' }}>
            {hostBusy === 'os' ? 'Updating OS…' : 'Update OS'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleHostUpdate('docker')}
          disabled={!!hostBusy || !dockerSupported || !isOnline}
          activeOpacity={0.8}
          style={{
            backgroundColor: hostBusy === 'docker' ? '#7a5c12' : '#D4AF37',
            opacity: !dockerSupported || !isOnline ? 0.45 : 1,
            paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8,
          }}
        >
          <Text style={{ color: '#10131a', fontWeight: '700' }}>
            {hostBusy === 'docker' ? 'Updating Docker…' : 'Update Docker'}
          </Text>
        </TouchableOpacity>
      </View>
      {hostMsg && <Text style={[S.detailLabel, { marginTop: 12 }]}>{hostMsg}</Text>}
    </AnimusPanel>
  );

  const statusBadge = (
    <>
      {device.outdated && (
        <View style={[S.statusBadge, { backgroundColor: '#FF9800' }]}>
          <Text style={S.statusText}>outdated</Text>
        </View>
      )}
      <View style={[S.statusBadge, { backgroundColor: getStatusColor(device.status) }]}>
        <Text style={S.statusText}>{device.status || 'unknown'}</Text>
      </View>
    </>
  );

  // --- Fullscreen ANIMUS view (web) ------------------------------------------
  if (Platform.OS === 'web' && view === 'animus') {
    return (
      <View style={S.root}>
        <AnimusBackground />
        <View style={S.fullHero}>
          <AnimusVisual data={m} cores={cores} style={StyleSheet.absoluteFill} />
          <View pointerEvents="box-none" style={S.hudLayer}>
            <View pointerEvents="box-none" style={S.hudTopStrip}>
              <View>
                <TouchableOpacity onPress={() => navigation?.goBack?.()} activeOpacity={0.7}>
                  <Text style={S.hudCaption}>← Devices</Text>
                </TouchableOpacity>
                <Text style={S.hostname}>{deviceLabel(device) || 'UNKNOWN NODE'}</Text>
                <Text style={S.headerMeta}>{device.hostname ? `${device.hostname} · ` : ''}{device.ip_address || '—'} · {device.id}</Text>
              </View>
              <View style={S.controls}>
                {statusBadge}
                <AnimusToggle options={VIEWS} value={view} onChange={setView} />
              </View>
            </View>

            <View pointerEvents="box-none" style={S.hudMiddle}>
              <View pointerEvents="box-none" style={S.leftStack}>
                <AnimusPanel strong style={S.hudCard}>
                  <AnimusStat label="CPU" value={cpuPct.toFixed(0)} unit="%" sub={`${cores} cores`} />
                </AnimusPanel>
                <AnimusPanel strong style={S.hudCard}>
                  <AnimusStat label="Memory" value={ramUsed.toFixed(1)} unit="GB" sub={`of ${ramTotal} GB · ${ramPct.toFixed(0)}%`} />
                </AnimusPanel>
              </View>
              <View pointerEvents="box-none" style={S.rightStack}>
                <AnimusPanel strong style={S.hudCard}>
                  <AnimusStat align="right" label="Network" value={`↓${fmtBytes(net.rx_bytes_per_sec)}`} unit="/s" sub={`↑${fmtBytes(net.tx_bytes_per_sec)}/s · ${linkMbps || '—'} Mbps`} />
                </AnimusPanel>
                <AnimusPanel strong style={S.hudCard}>
                  <AnimusStat align="right" label="Storage" value={diskUsed.toFixed(0)} unit="GB" sub={`${diskAvail.toFixed(0)} GB free · ${diskPct.toFixed(0)}%`} />
                </AnimusPanel>
                <AnimusPanel strong style={S.hudCard}>
                  <AnimusStat align="right" label="Disk I/O" value={`↓${fmtBytes(diskRead)}`} unit="/s" sub={`↑${fmtBytes(diskWrite)}/s read · write`} />
                </AnimusPanel>
              </View>
            </View>

            <View pointerEvents="box-none" style={S.hudBottom}>
              <Text style={S.hudCaption}>Node Telemetry · Active</Text>
              <View style={S.liveRow}>
                <View style={[S.liveDot, { backgroundColor: isOnline ? '#4CAF50' : colors.textMuted }]} />
                <Text style={S.liveText}>{liveData ? `Live · ${formatTime(lastHeartbeat)}` : 'Awaiting signal'}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  }

  // --- DATA screen (and native fallback) -------------------------------------
  return (
    <View style={S.root}>
      <AnimusBackground />
      <ScrollView
        style={S.container}
        contentContainerStyle={S.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={S.headerRow}>
          <View>
            <TouchableOpacity onPress={() => navigation?.goBack?.()} activeOpacity={0.7}>
              <Text style={S.hudCaption}>← Devices</Text>
            </TouchableOpacity>
            <Text style={S.hostname}>{deviceLabel(device) || 'UNKNOWN NODE'}</Text>
            <Text style={S.headerMeta}>{device.hostname ? `${device.hostname} · ` : ''}{device.ip_address || '—'} · {device.id}</Text>
          </View>
          <View style={S.headerRight}>
            {statusBadge}
            <AnimusToggle options={VIEWS} value={view} onChange={setView} />
          </View>
        </View>

        {/* Native fallback visual */}
        {Platform.OS !== 'web' && (
          <Box title="" style={{ marginBottom: 16 }}>
            <ServerVisual
              hostname={device.hostname}
              status={device.status}
              cpuCores={cores}
              ramGB={ramTotal}
              diskGB={diskTotal}
              networkMbps={linkMbps}
              lastSeen={device.last_seen}
              deviceId={device.id}
            />
          </Box>
        )}

        <ScreenTabs
          tabs={[
            { id: 'telemetry', label: 'Telemetry' },
            { id: 'containers', label: 'Containers' },
            { id: 'network', label: 'Network' },
            { id: 'host', label: 'Host' },
          ]}
          active={dataTab}
          onChange={setDataTab}
        />

        <>
            {dataTab === 'telemetry' ? <>
            {perCore.length > 0 && (
              <AnimusPanel title="Per-core load" style={S.panelGap}>
                <View style={S.coreGrid}>
                  {perCore.map((c, idx) => {
                    const u = num(c.usagePercent || c.usage) / 100;
                    return (
                      <View key={idx} style={S.coreCell}>
                        <View style={S.coreBarTrack}>
                          <View style={[S.coreBarFill, { height: `${Math.max(3, u * 100)}%`, backgroundColor: coreColor(u) }]} />
                        </View>
                        <Text style={S.coreCellLabel}>C{idx}</Text>
                        <Text style={S.coreCellValue}>{(u * 100).toFixed(0)}%</Text>
                      </View>
                    );
                  })}
                </View>
              </AnimusPanel>
            )}

            {procList.length > 0 && (
              <AnimusPanel
                title={`Activity Monitor${procInfo.all ? ` · ${procInfo.all} processes` : ''}`}
                style={S.panelGap}
              >
                <View style={S.procHeaderRow}>
                  <Text style={[S.procHead, S.procName]}>PROCESS</Text>
                  <Text style={[S.procHead, S.procPid]}>PID</Text>
                  <Text style={[S.procHead, S.procNum]}>CPU</Text>
                  <Text style={[S.procHead, S.procNum]}>MEM</Text>
                </View>
                {procList.map((p, idx) => {
                  const cpuU = num(p.cpu);
                  const memU = num(p.mem);
                  return (
                    <View key={`${p.pid}-${idx}`} style={[S.procRow, idx % 2 === 1 && S.procRowAlt]}>
                      <Text style={[S.procCell, S.procName]} numberOfLines={1}>{p.name}</Text>
                      <Text style={[S.procCell, S.procPid]}>{p.pid}</Text>
                      <Text style={[S.procCell, S.procNum, cpuU >= 80 && S.procHot]}>{cpuU.toFixed(1)}%</Text>
                      <Text style={[S.procCell, S.procNum, memU >= 80 && S.procHot]}>
                        {p.memBytes ? fmtBytes(p.memBytes) : `${memU.toFixed(1)}%`}
                      </Text>
                    </View>
                  );
                })}
              </AnimusPanel>
            )}

            {m.gpu ? (
              <AnimusPanel title={m.gpu.unified ? 'GPU (unified memory)' : 'GPU'} style={S.panelGap}>
                <Text style={S.meterValue}>
                  {m.gpu.name || 'gpu'}
                  {m.gpu.total_mb ? ` · ${m.gpu.used_mb || 0}/${m.gpu.total_mb} MB` : ''}
                  {m.gpu.util_percent != null ? ` · ${m.gpu.util_percent}%` : ''}
                </Text>
              </AnimusPanel>
            ) : null}
            <AnimusPanel title="Memory" style={S.panelGap}>
              <View style={S.meterHeader}>
                <Text style={S.meterValue}>{ramUsed.toFixed(1)} GB used · {ramAvail.toFixed(1)} GB free</Text>
                <Text style={[S.meterPct, ramPct >= 80 && { color: usageColor(ramPct / 100) }]}>{ramPct.toFixed(0)}%</Text>
              </View>
              <View style={S.progressBar}>
                <View style={[S.progressFill, { width: `${Math.min(100, ramPct)}%`, backgroundColor: usageColor(ramPct / 100) }]} />
              </View>
              <View style={S.legendRow}>
                <Text style={S.legendText}>0</Text>
                <Text style={S.legendText}>{ramTotal} GB total</Text>
              </View>
            </AnimusPanel>

            <AnimusPanel title="Storage" style={S.panelGap}>
              <View style={S.meterHeader}>
                <Text style={S.meterValue}>{diskUsed.toFixed(0)} GB used · {diskAvail.toFixed(0)} GB available</Text>
                <Text style={S.meterPct}>{diskPct.toFixed(0)}%</Text>
              </View>
              <View style={S.progressBar}>
                <View style={[S.progressFill, { width: `${Math.min(100, diskPct)}%` }]} />
              </View>
              <View style={S.legendRow}>
                <Text style={S.legendText}>0</Text>
                <Text style={S.legendText}>{diskTotal} GB total</Text>
              </View>
            </AnimusPanel>

            <AnimusPanel title="Disk Activity" style={S.panelGap}>
              <View style={S.ioRow}>
                <View style={S.ioCell}>
                  <Text style={S.ioLabel}>READ</Text>
                  <Text style={S.ioValue}>{fmtBytes(diskRead)}<Text style={S.ioUnit}>/s</Text></Text>
                </View>
                <View style={S.ioCell}>
                  <Text style={S.ioLabel}>WRITE</Text>
                  <Text style={S.ioValue}>{fmtBytes(diskWrite)}<Text style={S.ioUnit}>/s</Text></Text>
                </View>
              </View>
            </AnimusPanel>

            {Platform.OS === 'web' && dataHistory.cpu.length > 1 && (
              <AnimusPanel title="CPU usage over time" style={S.panelGap}>
                <Chart title="" data={dataHistory.cpu} dataKey="usagePercent" color={animus.gold} height={180} unit="%" />
              </AnimusPanel>
            )}
            {Platform.OS === 'web' && dataHistory.ram.length > 1 && (
              <AnimusPanel title="Memory usage over time" style={S.panelGap}>
                <Chart title="" data={dataHistory.ram} dataKey="usagePercent" color="#8a7320" height={180} unit="%" />
              </AnimusPanel>
            )}
            {Platform.OS === 'web' && dataHistory.network.length > 1 && (
              <AnimusPanel title="Network I/O over time" style={S.panelGap}>
                <NetworkChart title="" data={dataHistory.network} height={180} />
              </AnimusPanel>
            )}
            </> : null}

            {dataTab === 'network' ? <AnimusPanel title="Network" style={S.panelGap}>
              <Text style={S.detailLabel}>
                {networkInfo?.network?.island === 'lan'
                  ? 'Same network as Prod-Mini — LAN'
                  : networkInfo?.network?.island === 'remote'
                    ? 'Different network — join fleet mesh to talk east-west'
                    : 'Reachability unknown'}
              </Text>
              {(networkInfo?.tunnels || []).length ? (
                (networkInfo.tunnels || []).map((t) => (
                  <Text key={t.cf_tunnel_id} style={[S.detailValue, { marginTop: 6 }]}>
                    CF {t.display_name} · {t.status || 'unknown'}{t.default_bind ? ' · default HTTP' : ''}
                  </Text>
                ))
              ) : (
                <Text style={[S.detailValue, { marginTop: 6 }]}>No public Cloudflare tunnel — that is fine if this device has no public hostname.</Text>
              )}
              {meshKey?.preauth_key ? (
                <Text style={[S.detailValue, { marginTop: 8 }]} selectable>
                  One-time mesh key: {meshKey.preauth_key}{'\n'}{meshKey.command || ''}
                </Text>
              ) : (
                <TouchableOpacity
                  disabled={meshBusy}
                  onPress={async () => {
                    try {
                      setMeshBusy(true);
                      const minted = await deviceService.joinMesh(deviceId);
                      setMeshKey(minted);
                    } catch (err) {
                      Alert.alert('Fleet mesh', err.response?.data?.error?.message || err.message);
                    } finally {
                      setMeshBusy(false);
                    }
                  }}
                  style={{ marginTop: 10 }}
                >
                  <Text style={{ color: colors.accent, fontWeight: '600' }}>
                    {meshBusy ? 'Minting…' : 'Join fleet mesh (Headscale)'}
                  </Text>
                </TouchableOpacity>
              )}
              <Text style={[S.detailLabel, { marginTop: 16 }]}>Need a public hostname on this device?</Text>
              <Text style={S.detailValue}>Default is no. If yes, attach an existing connector above or create a new empty tunnel (new cloudflared — do not rewrite the one already running).</Text>
              <TextInput
                value={newTunnelName}
                onChangeText={setNewTunnelName}
                placeholder="new tunnel name"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                style={{ borderWidth: 1, borderColor: colors.border || '#333', borderRadius: 8, padding: 8, color: colors.textPrimary, marginTop: 8 }}
              />
              <TouchableOpacity
                disabled={tunnelBusy || !newTunnelName.trim() || !currentProject?.id}
                onPress={async () => {
                  try {
                    setTunnelBusy(true);
                    const data = await edgeService.createTunnel(currentProject.id, newTunnelName.trim());
                    setNewTunnelToken(data.token || data.tunnel?.token || data.cloudflared?.token || JSON.stringify(data));
                  } catch (err) {
                    Alert.alert('Create tunnel', err.response?.data?.error?.message || err.message);
                  } finally {
                    setTunnelBusy(false);
                  }
                }}
                style={{ marginTop: 10 }}
              >
                <Text style={{ color: colors.accent, fontWeight: '600' }}>
                  {tunnelBusy ? 'Creating…' : 'Create new Cloudflare tunnel'}
                </Text>
              </TouchableOpacity>
              {newTunnelToken ? (
                <Text style={[S.detailValue, { marginTop: 8 }]} selectable>
                  One-time cloudflared token: {String(newTunnelToken)}
                </Text>
              ) : null}
            </AnimusPanel> : null}

            {dataTab === 'host' ? <>
            <View style={S.detailsGrid}>
              <AnimusPanel brackets={false} style={S.detailCard}>
                <Text style={S.detailLabel}>IP Address</Text>
                <Text style={S.detailValue}>{device.ip_address || 'Unknown'}</Text>
              </AnimusPanel>
              <AnimusPanel brackets={false} style={S.detailCard}>
                <Text style={S.detailLabel}>VPC</Text>
                <Text style={S.detailValue}>{device.vpc_id || 'fleet'}</Text>
                {device.overlay_dns ? (
                  <Text style={[S.detailLabel, { marginTop: 6 }]}>{device.overlay_dns}</Text>
                ) : null}
                {vpcs.filter((v) => v.id !== (device.vpc_id || 'fleet')).map((v) => (
                  <TouchableOpacity
                    key={v.id}
                    onPress={async () => {
                      try {
                        const updated = await deviceService.moveToVpc(deviceId, v.id);
                        setDevice(updated);
                      } catch (err) {
                        Alert.alert('Move VPC', err.response?.data?.error?.message || err.message);
                      }
                    }}
                    style={{ marginTop: 8 }}
                  >
                    <Text style={{ color: colors.accent, fontWeight: '600' }}>Move to {v.name}…</Text>
                  </TouchableOpacity>
                ))}
              </AnimusPanel>
              <AnimusPanel brackets={false} style={S.detailCard}>
                <Text style={S.detailLabel}>Last Heartbeat</Text>
                <Text style={S.detailValue}>{formatDate(lastHeartbeat || device.last_seen)}</Text>
              </AnimusPanel>
              {device.created_at && (
                <AnimusPanel brackets={false} style={S.detailCard}>
                  <Text style={S.detailLabel}>Registered</Text>
                  <Text style={S.detailValue}>{formatDate(device.created_at)}</Text>
                </AnimusPanel>
              )}
              <AnimusPanel brackets={false} style={S.detailCard}>
                <Text style={S.detailLabel}>Device ID</Text>
                <Text style={[S.detailValue, S.deviceId]} numberOfLines={1}>{device.id}</Text>
              </AnimusPanel>
              <AnimusPanel brackets={false} style={S.detailCard}>
                <Text style={S.detailLabel}>Version</Text>
                <Text style={[S.detailValue, device.outdated && { color: '#FF9800' }]} numberOfLines={1}>
                  {device.version || 'unknown'}
                  {device.outdated && device.current_version ? `  →  ${device.current_version}` : ''}
                </Text>
              </AnimusPanel>
            </View>

            {hostPanel}
            </> : null}

            {dataTab === 'containers' ? <>
            <AnimusPanel title="Containers" style={S.panelGap}>
              <DeviceContainers deviceId={deviceId} />
            </AnimusPanel>

            {device.outdated && (
              <AnimusPanel title="Update available" style={S.panelGap}>
                <Text style={[S.detailValue, { marginBottom: 12 }]}>
                  This device is on {device.version || 'an unknown version'}; the latest release is {device.current_version}.
                </Text>
                <TouchableOpacity
                  onPress={handleUpdate}
                  disabled={updating}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: updating ? '#7a5c12' : '#D4AF37',
                    paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, alignSelf: 'flex-start',
                  }}
                >
                  <Text style={{ color: '#10131a', fontWeight: '700' }}>
                    {updating ? 'Requesting…' : 'Update now'}
                  </Text>
                </TouchableOpacity>
                {updateMsg && <Text style={[S.detailLabel, { marginTop: 12 }]}>{updateMsg}</Text>}
              </AnimusPanel>
            )}
            </> : null}
          </>
      </ScrollView>
    </View>
  );
};
