import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, Platform } from 'react-native';
import { deviceService } from '../../services/deviceService';
import websocketService from '../../services/websocketService';
import { useAuth } from '../../contexts/AuthContext';
import { Box } from '../../components/Box/Box';
import { Chart } from '../../components/Chart/Chart';
import { NetworkChart } from '../../components/Chart/NetworkChart';
import { ServerVisual } from '../../components/ServerVisual/ServerVisual';
import { DeviceDetailsStyles } from './DeviceDetails.styles';
import { colors, spacing } from '../../styles/theme';

export const DeviceDetails = ({ route, navigation }) => {
  const { deviceId } = route?.params || {};
  const { isAuthenticated, getToken } = useAuth();
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [liveData, setLiveData] = useState(null);
  const [lastHeartbeat, setLastHeartbeat] = useState(null);
  const [dataHistory, setDataHistory] = useState({ cpu: [], ram: [], disk: [], network: [] });
  const dataHistoryRef = useRef({ cpu: [], ram: [], disk: [], network: [] });
  const MAX_HISTORY = 60; // Keep last 60 data points (5 minutes at 5s intervals)

  useEffect(() => {
    if (!deviceId) {
      console.error('DeviceDetails: deviceId is missing');
      setLoading(false);
      return;
    }
    loadDevice();

    // Connect WebSocket and subscribe to live updates
    if (isAuthenticated) {
      getToken().then(token => {
        if (token) {
          websocketService.connect(token);
          
          // Wait for connection before subscribing
          const unsubscribeConnected = websocketService.on('connected', () => {
            console.log('[DeviceDetails] WebSocket connected, subscribing to worker:', deviceId);
            websocketService.subscribeToWorker(deviceId);
          });

          // Subscribe immediately if already connected
          if (websocketService.isConnected) {
            console.log('[DeviceDetails] WebSocket already connected, subscribing to worker:', deviceId);
            websocketService.subscribeToWorker(deviceId);
          }

          // Listen for live updates
          const unsubscribeLive = websocketService.on('worker:live:update', (data) => {
            console.log('[DeviceDetails] Received worker:live:update:', data);
            if (data.workerId === deviceId) {
              console.log('[DeviceDetails] Processing live update for device:', deviceId);
              setLiveData(data.resources);
              setLastHeartbeat(data.timestamp);
              
              // Add to history for graphs
              const timestamp = new Date(data.timestamp).getTime();
              const newHistory = { ...dataHistoryRef.current };
              
              if (data.resources.cpu) {
                newHistory.cpu.push({
                  timestamp,
                  usagePercent: parseFloat(data.resources.cpu.usagePercent || data.resources.cpu.usage || 0)
                });
                if (newHistory.cpu.length > MAX_HISTORY) {
                  newHistory.cpu.shift();
                }
              }
              if (data.resources.ram) {
                newHistory.ram.push({
                  timestamp,
                  usagePercent: parseFloat(data.resources.ram.usagePercent || 0)
                });
                if (newHistory.ram.length > MAX_HISTORY) {
                  newHistory.ram.shift();
                }
              }
              if (data.resources.disk) {
                newHistory.disk.push({
                  timestamp,
                  usagePercent: parseFloat(data.resources.disk.usagePercent || 0)
                });
                if (newHistory.disk.length > MAX_HISTORY) {
                  newHistory.disk.shift();
                }
              }
              if (data.resources.network) {
                newHistory.network.push({
                  timestamp,
                  rx_bytes_per_sec: data.resources.network.rx_bytes_per_sec || 0,
                  tx_bytes_per_sec: data.resources.network.tx_bytes_per_sec || 0
                });
                if (newHistory.network.length > MAX_HISTORY) {
                  newHistory.network.shift();
                }
              }
              
              // Update both ref and state to trigger re-render
              dataHistoryRef.current = newHistory;
              setDataHistory(newHistory);
            }
          });

          return () => {
            unsubscribeLive();
            unsubscribeConnected();
            websocketService.unsubscribeFromWorker(deviceId);
          };
        }
      });
    }
  }, [deviceId, isAuthenticated]);

  const loadDevice = async () => {
    if (!deviceId) {
      console.error('DeviceDetails: Cannot load device without deviceId');
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

  if (!deviceId) {
    return (
      <View style={DeviceDetailsStyles.container}>
        <Text style={DeviceDetailsStyles.errorText}>Device ID is missing</Text>
      </View>
    );
  }

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
      {/* Server Visualization with Details */}
      <Box title="" style={DeviceDetailsStyles.serverBox}>
        <ServerVisual
          hostname={device.hostname}
          status={device.status}
          cpuCores={device.resources?.cpu_cores || 0}
          ramGB={device.resources?.ram_gb || 0}
          diskGB={device.resources?.disk_gb || 0}
          networkMbps={device.resources?.network_mbps || 0}
          lastSeen={device.last_seen}
          deviceId={device.id}
        />

        {/* Additional Details Below Server */}
        <View style={DeviceDetailsStyles.detailsGrid}>
          <View style={DeviceDetailsStyles.detailCard}>
            <Text style={DeviceDetailsStyles.detailLabel}>IP Address</Text>
            <Text style={DeviceDetailsStyles.detailValue}>{device.ip_address || 'Unknown'}</Text>
          </View>

          <View style={DeviceDetailsStyles.detailCard}>
            <Text style={DeviceDetailsStyles.detailLabel}>Last Seen</Text>
            <Text style={DeviceDetailsStyles.detailValue}>{formatDate(device.last_seen)}</Text>
          </View>

          {device.created_at && (
            <View style={DeviceDetailsStyles.detailCard}>
              <Text style={DeviceDetailsStyles.detailLabel}>Registered</Text>
              <Text style={DeviceDetailsStyles.detailValue}>{formatDate(device.created_at)}</Text>
            </View>
          )}

          <View style={DeviceDetailsStyles.detailCard}>
            <Text style={DeviceDetailsStyles.detailLabel}>Device ID</Text>
            <Text style={[DeviceDetailsStyles.detailValue, DeviceDetailsStyles.deviceId]} numberOfLines={1}>
              {device.id}
            </Text>
          </View>
        </View>
      </Box>

      {liveData && (
        <>
          <Box title="Live Metrics">
            {lastHeartbeat && (
              <View style={DeviceDetailsStyles.section}>
                <Text style={DeviceDetailsStyles.label}>Last Heartbeat</Text>
                <Text style={DeviceDetailsStyles.value}>{formatDate(lastHeartbeat)}</Text>
              </View>
            )}

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
        </>
      )}

      {/* Live Charts */}
      {Platform.OS === 'web' && liveData && (
        <>
          {dataHistory.cpu.length > 0 && (
            <Box title="CPU Usage Over Time">
              <Chart
                title=""
                data={dataHistory.cpu}
                dataKey="usagePercent"
                color="#4CAF50"
                height={200}
                unit="%"
              />
            </Box>
          )}

          {dataHistory.ram.length > 0 && (
            <Box title="RAM Usage Over Time">
              <Chart
                title=""
                data={dataHistory.ram}
                dataKey="usagePercent"
                color="#2196F3"
                height={200}
                unit="%"
              />
            </Box>
          )}

          {dataHistory.disk.length > 0 && (
            <Box title="Disk Usage Over Time">
              <Chart
                title=""
                data={dataHistory.disk}
                dataKey="usagePercent"
                color="#FF9800"
                height={200}
                unit="%"
              />
            </Box>
          )}

          {dataHistory.network.length > 0 && (
            <Box title="Network I/O Over Time">
              <NetworkChart
                title=""
                data={dataHistory.network}
                height={200}
              />
            </Box>
          )}
        </>
      )}
    </ScrollView>
  );
};

