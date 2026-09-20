import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { deviceService, deviceLabel, hostPartLabel } from '../../services/deviceService';
import websocketService from '../../services/websocketService';
import { useAuth } from '../../contexts/AuthContext';
import { Box } from '../../components/Box/Box';
import { DevicesStyles } from './Devices.styles';

export const Devices = ({ navigation }) => {
  const { isAuthenticated, getToken } = useAuth();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDevices();
    const poll = setInterval(() => { loadDevices(); }, 5000);

    if (isAuthenticated) {
      getToken().then(token => {
        if (token) {
          websocketService.connect(token);
        }
      });

      const unsubscribeOnline = websocketService.on('worker:online', (data) => {
        console.log('[Devices] Worker online:', data);
        loadDevices();
      });

      const unsubscribeOffline = websocketService.on('worker:offline', (data) => {
        console.log('[Devices] Worker offline:', data);
        setDevices(prevDevices => 
          prevDevices.map(device => 
            device.id === data.workerId 
              ? { ...device, status: 'offline' }
              : device
          )
        );
      });

      const unsubscribeResources = websocketService.on('worker:resources:updated', (data) => {
        setDevices(prevDevices => 
          prevDevices.map(device => 
            device.id === data.workerId 
              ? { ...device, resources: { ...device.resources, ...data.resources }, last_seen: data.timestamp || device.last_seen }
              : device
          )
        );
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
    } catch (error) {
      console.error('Failed to load devices:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDevices();
  };

  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return 'Never';
    const date = new Date(lastSeen);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'online':
        return '#4CAF50';
      case 'offline':
        return '#F44336';
      case 'degraded':
        return '#FF9800';
      default:
        return '#9E9E9E';
    }
  };

  if (loading) {
    return (
      <View style={DevicesStyles.container}>
        <ActivityIndicator size="large" color="#D4AF37" />
      </View>
    );
  }

  return (
    <ScrollView
      style={DevicesStyles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Box title="Registered Devices">
        {devices.length === 0 ? (
          <Text style={DevicesStyles.emptyText}>No devices registered yet</Text>
        ) : (
          devices.map((device) => (
            <TouchableOpacity
              key={device.id}
              style={DevicesStyles.deviceCard}
              onPress={() => navigation.navigate('deviceDetails', { deviceId: device.id })}
            >
              <View style={DevicesStyles.deviceHeader}>
                <View style={DevicesStyles.deviceInfo}>
                  <Text style={DevicesStyles.deviceName}>{deviceLabel(device)}</Text>
                  <Text style={DevicesStyles.deviceIp}>{device.ip_address}</Text>
                  <Text style={DevicesStyles.lastSeenText}>
                    VPC {device.vpc_id || 'fleet'}
                    {device.overlay_dns ? ` · ${device.overlay_dns}` : ''}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {device.outdated && (
                    <View style={[DevicesStyles.statusBadge, { backgroundColor: '#FF9800' }]}>
                      <Text style={DevicesStyles.statusText}>outdated</Text>
                    </View>
                  )}
                  <View style={[DevicesStyles.statusBadge, { backgroundColor: getStatusColor(device.status) }]}>
                    <Text style={DevicesStyles.statusText}>{device.status || 'unknown'}</Text>
                  </View>
                </View>
              </View>
              <View style={DevicesStyles.deviceDetails}>
                {device.resources && (
                  <Text style={DevicesStyles.resourceText}>
                    {device.resources.cpu?.usagePercent != null
                      ? `${Number(device.resources.cpu.usagePercent).toFixed(0)}% CPU`
                      : `${device.resources.cpu_cores || 0} CPU`}
                    {' • '}
                    {device.resources.ram?.used_gb != null
                      ? `${Number(device.resources.ram.used_gb).toFixed(1)} / ${device.resources.ram.total_gb || device.resources.ram_gb || 0} GB RAM`
                      : `${device.resources.ram_gb || 0} GB RAM`}
                    {' • '}
                    {device.resources.disk_gb || 0} GB Disk
                  </Text>
                )}
                {device.version && (
                  <Text style={DevicesStyles.lastSeenText}>
                    Version: {device.version}
                    {device.outdated && device.current_version ? `  →  latest ${device.current_version}` : ''}
                  </Text>
                )}
                {device.resources?.host && (
                  <Text style={DevicesStyles.lastSeenText}>
                    OS: {hostPartLabel(device.resources.host.os) || '—'}
                    {' · '}
                    Docker: {hostPartLabel(device.resources.host.docker) || '—'}
                  </Text>
                )}
                <Text style={DevicesStyles.lastSeenText}>
                  Last seen: {formatLastSeen(device.last_seen)}
                </Text>
                {(!device.last_seen || (Date.now() - new Date(device.last_seen).getTime()) > 10 * 60 * 1000) ? (
                  <Text style={DevicesStyles.lastSeenText}>
                    {deviceLabel(device)} has not checked in — updater is not polling.
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          ))
        )}
      </Box>
    </ScrollView>
  );
};

