import React, { useState, useEffect } from 'react';
import { View, Text, RefreshControl, ScrollView } from 'react-native';
import { deviceService, deviceLabel, hostPartLabel } from '../../services/deviceService';
import websocketService from '../../services/websocketService';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import {
  AnimusPage,
  AnimusPanel,
  AnimusListRow,
  AnimusState,
  AnimusNextSteps,
  AnimusMeter,
} from '../../components/Animus';

export const Devices = ({ navigation }) => {
  const { isAuthenticated, getToken } = useAuth();
  const { status: statusTokens, animus, colors } = useTheme();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDevices();
    const poll = setInterval(() => { loadDevices(); }, 5000);

    if (isAuthenticated) {
      getToken().then((token) => {
        if (token) websocketService.connect(token);
      });

      const unsubscribeOnline = websocketService.on('worker:online', () => loadDevices());
      const unsubscribeOffline = websocketService.on('worker:offline', (data) => {
        setDevices((prev) => prev.map((d) => (
          d.id === data.workerId ? { ...d, status: 'offline' } : d
        )));
      });
      const unsubscribeResources = websocketService.on('worker:resources:updated', (data) => {
        setDevices((prev) => prev.map((d) => (
          d.id === data.workerId
            ? { ...d, resources: { ...d.resources, ...data.resources }, last_seen: data.timestamp || d.last_seen }
            : d
        )));
      });

      return () => {
        clearInterval(poll);
        unsubscribeOnline();
        unsubscribeOffline();
        unsubscribeResources();
      };
    }

    return () => clearInterval(poll);
  }, [isAuthenticated, getToken]);

  const loadDevices = async () => {
    try {
      const devicesList = await deviceService.getDevices();
      setDevices(devicesList);
      setError(null);
    } catch (e) {
      setError(e.message || 'Failed to load fleet');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return 'Never';
    const diffMins = Math.floor((Date.now() - new Date(lastSeen)) / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const statusColor = (status) => {
    switch (status) {
      case 'online': return statusTokens.running;
      case 'offline': return statusTokens.alarm;
      case 'degraded': return statusTokens.degraded;
      default: return statusTokens.unknown;
    }
  };

  const cpuPct = (d) => {
    const n = d?.resources?.cpu?.usagePercent;
    return n != null ? Number(n) : null;
  };

  let bodyState = 'ready';
  if (loading) bodyState = 'loading';
  else if (error) bodyState = 'error';
  else if (!devices.length) bodyState = 'empty';

  return (
    <AnimusPage
      title="Devices"
      job="Pick a world to enter orbit — live CPU, memory, and host status across your fleet."
      metaphor="planet"
      scroll={false}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 48 }}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadDevices(); }}
            tintColor={animus.gold}
          />
        )}
      >
        <AnimusNextSteps navigation={navigation} />

        <AnimusState
          state={bodyState}
          metaphor="planet"
          error={error}
          onRetry={loadDevices}
          emptyTitle="No worlds online"
          emptyHint="Register a worker device to bring a planet into the system."
          emptyCta="Open settings token"
          onEmptyPress={() => navigation?.navigate?.('settings')}
          loadingLabel="Scanning fleet…"
        >
          <AnimusPanel title={`${devices.length} world${devices.length === 1 ? '' : 's'}`}>
            {devices.map((device) => {
              const cpu = cpuPct(device);
              const meta = [
                device.ip_address,
                device.version ? `v${device.version}` : null,
                formatLastSeen(device.last_seen),
              ].filter(Boolean).join(' · ');
              return (
                <View key={device.id} style={{ borderBottomWidth: 1, borderBottomColor: colors.divider }}>
                  <AnimusListRow
                    title={deviceLabel(device)}
                    meta={meta}
                    status={device.outdated ? 'outdated' : (device.status || 'unknown')}
                    statusColor={device.outdated ? statusTokens.degraded : statusColor(device.status)}
                    icon="planet-outline"
                    onPress={() => navigation.navigate('deviceDetails', { deviceId: device.id })}
                  />
                  {cpu != null ? (
                    <View style={{ paddingHorizontal: 12, paddingBottom: 10 }}>
                      <AnimusMeter label="CPU" value={cpu} />
                      {device.resources?.host ? (
                        <Text style={{
                          fontSize: 11,
                          color: colors.textMuted,
                          fontFamily: animus.mono,
                        }}
                        >
                          OS {hostPartLabel(device.resources.host.os) || '—'}
                          {' · '}
                          Docker {hostPartLabel(device.resources.host.docker) || '—'}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </AnimusPanel>
        </AnimusState>
      </ScrollView>
    </AnimusPage>
  );
};

export default Devices;
