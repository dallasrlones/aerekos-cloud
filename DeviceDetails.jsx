import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, Platform, StyleSheet, TouchableOpacity } from 'react-native';
import { deviceService } from '../../services/deviceService';
import websocketService from '../../services/websocketService';
import { useAuth } from '../../contexts/AuthContext';
import { Box } from '../../components/Box/Box';
import { Chart } from '../../components/Chart/Chart';
import { NetworkChart } from '../../components/Chart/NetworkChart';
import { ServerVisual } from '../../components/ServerVisual/ServerVisual';
import { AnimusVisual } from '../../components/AnimusVisual/AnimusVisual';
import { AnimusBackground, AnimusPanel, AnimusStat, AnimusToggle } from '../../components/Animus';
import { DeviceDetailsStyles as S } from './DeviceDetails.styles';
import { DeviceContainers } from './DeviceContainers';
import { colors, animus } from '../../styles/theme';

const MAX_HISTORY = 60;
const VIEWS = [
  { key: 'animus', label: 'Preview' },
  { key: 'data', label: 'Data' },
  { key: 'containers', label: 'Containers' },
];

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

export const DeviceDetails = ({ route }) => {
  const { deviceId } = route?.params || {};
  const { isAuthenticated, getToken } = useAuth();
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [liveData, setLiveData] = useState(null);
  const [lastHeartbeat, setLastHeartbeat] = useState(null);
  const [view, setView] = useState('animus');
  const [dataHistory, setDataHistory] = useState({ cpu: [], ram: [], disk: [], network: [] });
  const dataHistoryRef = useRef({ cpu: [], ram: [], disk: [], network: [] });
  const [updating, setUpdating] = useState(false);
  const [updateMsg, setUpdateMsg] = useState(null);

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

  useEffect(() => {
    if (!deviceId) {
      setLoading(false);
      return undefined;
    }
    loadDevice();

    if (isAuthenticated) {
      getToken().then((token) => {
        if (!token) return;
        websocketService.connect(token);

        const subscribe = () => websocketService.subscribeToWorker(deviceId);
        const unsubscribeConnected = websocketService.on('connected', subscribe);
        if (websocketService.isConnected) subscribe();

        const unsubscribeLive = websocketService.on('worker:live:update', (data) => {
          if (data.workerId !== deviceId) return;
          setLiveData(data.resources);
          setLastHeartbeat(data.timestamp);

          const timestamp = new Date(data.timestamp).getTime();
          const h = { ...dataHistoryRef.current };
          const push = (key, point) => {
            h[key] = [...h[key], point];
            if (h[key].length > MAX_HISTORY) h[key] = h[key].slice(-MAX_HISTORY);
          };
          if (data.resources.cpu) {
            push('cpu', { timestamp, usagePercent: num(data.resources.cpu.usagePercent || data.resources.cpu.usage) });
          }
          if (data.resources.ram) push('ram', { timestamp, usagePercent: num(data.resources.ram.usagePercent) });
          if (data.resources.disk) push('disk', { timestamp, usagePercent: num(data.resources.disk.usagePercent) });
          if (data.resources.network) {
            push('network', {
              timestamp,
              rx_bytes_per_sec: num(data.resources.network.rx_bytes_per_sec),
              tx_bytes_per_sec: num(data.resources.network.tx_bytes_per_sec),
            });
          }
          dataHistoryRef.current = h;
          setDataHistory(h);
        });

        // eslint-disable-next-line consistent-return
        return () => {
          unsubscribeLive();
          unsubscribeConnected();
          websocketService.unsubscribeFromWorker(deviceId);
        };
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, isAuthenticated]);

  const loadDevice = async () => {
    if (!deviceId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const deviceData = await deviceService.getDevice(deviceId);
      setDevice(deviceData);
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
                <Text style={S.hostname}>{device.hostname || 'UNKNOWN NODE'}</Text>
                <Text style={S.headerMeta}>{device.ip_address || '—'} · {device.id}</Text>
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
            <Text style={S.hostname}>{device.hostname || 'UNKNOWN NODE'}</Text>
            <Text style={S.headerMeta}>{device.ip_address || '—'} · {device.id}</Text>
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

        {view === 'containers' ? (
          <Box title="Containers on this device" style={{ marginBottom: 16 }}>
            <DeviceContainers deviceId={deviceId} />
          </Box>
        ) : null}

        {/* Detailed telemetry */}
        {view === 'data' ? (
        <>
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

            <View style={S.detailsGrid}>
              <AnimusPanel brackets={false} style={S.detailCard}>
                <Text style={S.detailLabel}>IP Address</Text>
                <Text style={S.detailValue}>{device.ip_address || 'Unknown'}</Text>
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
          </>
        ) : null}
      </ScrollView>
    </View>
  );
};
