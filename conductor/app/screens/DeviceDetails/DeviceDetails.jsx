import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { deviceService } from '../../services/deviceService';
import websocketService from '../../services/websocketService';
import { useAuth } from '../../contexts/AuthContext';
import { Box } from '../../components/Box/Box';
import { DeviceDetailsStyles } from './DeviceDetails.styles';

export const DeviceDetails = ({ route, navigation }) => {
  const { deviceId } = route.params;
  const { isAuthenticated, getToken } = useAuth();
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [liveData, setLiveData] = useState(null);
  const dataHistoryRef = useRef({ cpu: [], ram: [], disk: [], network: [] });
  const MAX_HISTORY = 60; // Keep last 60 data points (5 minutes at 5s intervals)

  useEffect(() => {
    loadDevice();

    // Connect WebSocket and subscribe to live updates
    if (isAuthenticated) {
      getToken().then(token => {
        if (token) {
          websocketService.connect(token);
          
          // Subscribe to live updates for this worker
          websocketService.subscribeToWorker(deviceId);

          // Listen for live updates
          const unsubscribeLive = websocketService.on('worker:live:update', (data) => {
            if (data.workerId === deviceId) {
              setLiveData(data.resources);
              
              // Add to history for graphs
              const timestamp = new Date(data.timestamp).getTime();
              if (data.resources.cpu) {
                dataHistoryRef.current.cpu.push({
                  timestamp,
                  usage: data.resources.cpu.usage || 0
                });
                if (dataHistoryRef.current.cpu.length > MAX_HISTORY) {
                  dataHistoryRef.current.cpu.shift();
                }
              }
              if (data.resources.ram) {
                dataHistoryRef.current.ram.push({
                  timestamp,
                  usagePercent: data.resources.ram.usagePercent || 0
                });
                if (dataHistoryRef.current.ram.length > MAX_HISTORY) {
                  dataHistoryRef.current.ram.shift();
                }
              }
              if (data.resources.disk) {
                dataHistoryRef.current.disk.push({
                  timestamp,
                  usagePercent: data.resources.disk.usagePercent || 0
                });
                if (dataHistoryRef.current.disk.length > MAX_HISTORY) {
                  dataHistoryRef.current.disk.shift();
                }
              }
              if (data.resources.network) {
                dataHistoryRef.current.network.push({
                  timestamp,
                  rx_bytes_per_sec: data.resources.network.rx_bytes_per_sec || 0,
                  tx_bytes_per_sec: data.resources.network.tx_bytes_per_sec || 0
                });
                if (dataHistoryRef.current.network.length > MAX_HISTORY) {
                  dataHistoryRef.current.network.shift();
                }
              }
            }
          });

          return () => {
            unsubscribeLive();
            websocketService.unsubscribeFromWorker(deviceId);
          };
        }
      });
    }
  }, [deviceId, isAuthenticated]);

  const loadDevice = async () => {
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
    const date = new Date(dateString);
    return date.toLocaleString();
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

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <View style={DeviceDetailsStyles.container}>
        <ActivityIndicator size="large" color="#D4AF37" />
      </View>
    );
  }

  if (!device) {
    return (
      <View style={DeviceDetailsStyles.container}>
        <Text style={DeviceDetailsStyles.errorText}>Device not found</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={DeviceDetailsStyles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Box title="Device Information">
        <View style={DeviceDetailsStyles.section}>
          <Text style={DeviceDetailsStyles.label}>Hostname</Text>
          <Text style={DeviceDetailsStyles.value}>{device.hostname || 'Unknown'}</Text>
        </View>

        <View style={DeviceDetailsStyles.section}>
          <Text style={DeviceDetailsStyles.label}>IP Address</Text>
          <Text style={DeviceDetailsStyles.value}>{device.ip_address || 'Unknown'}</Text>
        </View>

        <View style={DeviceDetailsStyles.section}>
          <Text style={DeviceDetailsStyles.label}>Status</Text>
          <View style={[DeviceDetailsStyles.statusBadge, { backgroundColor: getStatusColor(device.status) }]}>
            <Text style={DeviceDetailsStyles.statusText}>{device.status || 'unknown'}</Text>
          </View>
        </View>

        <View style={DeviceDetailsStyles.section}>
          <Text style={DeviceDetailsStyles.label}>Last Seen</Text>
          <Text style={DeviceDetailsStyles.value}>{formatDate(device.last_seen)}</Text>
        </View>

        <View style={DeviceDetailsStyles.section}>
          <Text style={DeviceDetailsStyles.label}>Device ID</Text>
          <Text style={DeviceDetailsStyles.value}>{device.id}</Text>
        </View>

        {device.created_at && (
          <View style={DeviceDetailsStyles.section}>
            <Text style={DeviceDetailsStyles.label}>Registered</Text>
            <Text style={DeviceDetailsStyles.value}>{formatDate(device.created_at)}</Text>
          </View>
        )}
      </Box>

      {device.resources && (
        <Box title="Resources">
          <View style={DeviceDetailsStyles.section}>
            <Text style={DeviceDetailsStyles.label}>CPU Cores</Text>
            <Text style={DeviceDetailsStyles.value}>{device.resources.cpu_cores || 0}</Text>
          </View>

          <View style={DeviceDetailsStyles.section}>
            <Text style={DeviceDetailsStyles.label}>RAM</Text>
            <Text style={DeviceDetailsStyles.value}>{device.resources.ram_gb || 0} GB</Text>
          </View>

          <View style={DeviceDetailsStyles.section}>
            <Text style={DeviceDetailsStyles.label}>Disk</Text>
            <Text style={DeviceDetailsStyles.value}>{device.resources.disk_gb || 0} GB</Text>
          </View>

          {device.resources.network_mbps && (
            <View style={DeviceDetailsStyles.section}>
              <Text style={DeviceDetailsStyles.label}>Network</Text>
              <Text style={DeviceDetailsStyles.value}>{device.resources.network_mbps} Mbps</Text>
            </View>
          )}
        </Box>
      )}

      {liveData && (
        <Box title="Live Metrics">
          {/* CPU Usage */}
          {liveData.cpu && (
            <View style={DeviceDetailsStyles.section}>
              <View style={DeviceDetailsStyles.metricRow}>
                <Text style={DeviceDetailsStyles.label}>CPU Usage</Text>
                <Text style={DeviceDetailsStyles.value}>{liveData.cpu.usagePercent || 0}%</Text>
              </View>
              <View style={DeviceDetailsStyles.progressBar}>
                <View 
                  style={[
                    DeviceDetailsStyles.progressFill, 
                    { width: `${liveData.cpu.usagePercent || 0}%`, backgroundColor: '#4CAF50' }
                  ]} 
                />
              </View>
            </View>
          )}

          {/* RAM Usage */}
          {liveData.ram && (
            <View style={DeviceDetailsStyles.section}>
              <View style={DeviceDetailsStyles.metricRow}>
                <Text style={DeviceDetailsStyles.label}>RAM Usage</Text>
                <Text style={DeviceDetailsStyles.value}>
                  {liveData.ram.used_gb?.toFixed(2) || 0} GB / {liveData.ram.total_gb || 0} GB ({liveData.ram.usagePercent?.toFixed(1) || 0}%)
                </Text>
              </View>
              <View style={DeviceDetailsStyles.progressBar}>
                <View 
                  style={[
                    DeviceDetailsStyles.progressFill, 
                    { width: `${liveData.ram.usagePercent || 0}%`, backgroundColor: '#2196F3' }
                  ]} 
                />
              </View>
            </View>
          )}

          {/* Disk Usage */}
          {liveData.disk && (
            <View style={DeviceDetailsStyles.section}>
              <View style={DeviceDetailsStyles.metricRow}>
                <Text style={DeviceDetailsStyles.label}>Disk Usage</Text>
                <Text style={DeviceDetailsStyles.value}>
                  {liveData.disk.used_gb?.toFixed(2) || 0} GB / {liveData.disk.total_gb || 0} GB ({liveData.disk.usagePercent?.toFixed(1) || 0}%)
                </Text>
              </View>
              <View style={DeviceDetailsStyles.progressBar}>
                <View 
                  style={[
                    DeviceDetailsStyles.progressFill, 
                    { width: `${liveData.disk.usagePercent || 0}%`, backgroundColor: '#FF9800' }
                  ]} 
                />
              </View>
            </View>
          )}

          {/* Network I/O */}
          {liveData.network && (
            <View style={DeviceDetailsStyles.section}>
              <Text style={DeviceDetailsStyles.label}>Network I/O</Text>
              <Text style={DeviceDetailsStyles.value}>
                ↓ {formatBytes(liveData.network.rx_bytes_per_sec || 0)}/s ↑ {formatBytes(liveData.network.tx_bytes_per_sec || 0)}/s
              </Text>
            </View>
          )}

          {/* Per-Core CPU Usage */}
          {liveData.cpu?.perCore && liveData.cpu.perCore.length > 0 && (
            <View style={DeviceDetailsStyles.section}>
              <Text style={DeviceDetailsStyles.label}>Per-Core CPU Usage</Text>
              {liveData.cpu.perCore.slice(0, 8).map((core, idx) => (
                <View key={idx} style={DeviceDetailsStyles.coreRow}>
                  <Text style={DeviceDetailsStyles.coreLabel}>Core {core.core}:</Text>
                  <View style={[DeviceDetailsStyles.progressBar, { flex: 1, marginHorizontal: 8 }]}>
                    <View 
                      style={[
                        DeviceDetailsStyles.progressFill, 
                        { width: `${core.usagePercent || 0}%`, backgroundColor: '#4CAF50' }
                      ]} 
                    />
                  </View>
                  <Text style={DeviceDetailsStyles.coreValue}>{core.usagePercent || 0}%</Text>
                </View>
              ))}
            </View>
          )}
        </Box>
      )}
    </ScrollView>
  );
};

