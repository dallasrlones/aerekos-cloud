import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Box } from '../../components/Box/Box';
import { ServiceStatus } from '../../components/ServiceStatus/ServiceStatus';
import { ServiceToggle } from '../../components/ServiceToggle/ServiceToggle';
import { colors } from '../../styles/theme';
import { getServiceMeta, getServiceLabel } from '../../services/serviceCatalog';
import { managerService } from '../../services/managerService';
import { ManagerConsoleStyles as S } from './ManagerConsole.styles';

/**
 * Generic, metadata-driven console for ANY manager that doesn't have a bespoke
 * screen. Mirrors the existing KeyManager/StorageManager hub pattern (status,
 * enable/disable toggle, health, metrics) but is driven entirely by the
 * conductor's generic /api/services/:name/* endpoints, so a new manager gets a
 * working console with zero extra code.
 */
export const ManagerConsole = ({ navigation, route }) => {
  const serviceName = route?.params?.serviceName;
  const meta = getServiceMeta(serviceName);
  const label = meta?.label || getServiceLabel(serviceName);

  const [status, setStatus] = useState(null);
  const [health, setHealth] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [toggling, setToggling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadAll = useCallback(async () => {
    try {
      const st = await managerService.getStatus(serviceName);
      setStatus(st);
      setError(null);
      if (st?.enabled) {
        const [h, m] = await Promise.all([
          managerService.getHealth(serviceName),
          managerService.getMetrics(serviceName),
        ]);
        setHealth(h);
        setMetrics(m);
      } else {
        setHealth(null);
        setMetrics(null);
      }
    } catch (err) {
      console.error('Error loading service:', err);
      setError(err.response?.data?.error?.message || err.message || 'Failed to load service');
    }
  }, [serviceName]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleToggle = async (enabled) => {
    setToggling(true);
    setError(null);
    try {
      if (enabled) {
        await managerService.enable(serviceName);
      } else {
        await managerService.disable(serviceName);
      }
      await loadAll();
    } catch (err) {
      console.error('Error toggling service:', err);
      setError(err.response?.data?.error?.message || err.message || 'Failed to toggle service');
    } finally {
      setToggling(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const renderMetrics = () => {
    if (!metrics) return null;
    if (typeof metrics === 'string') {
      const lines = metrics.split('\n').filter((l) => l && !l.startsWith('#')).slice(0, 40);
      if (lines.length === 0) return <Text style={S.hintText}>No metrics reported.</Text>;
      return (
        <View style={S.codeBlock}>
          {lines.map((line, i) => (
            <Text key={i} style={S.codeLine} numberOfLines={1}>{line}</Text>
          ))}
        </View>
      );
    }
    const entries = Object.entries(metrics).filter(([, v]) => typeof v !== 'object');
    if (entries.length === 0) return <Text style={S.hintText}>No metrics reported.</Text>;
    return (
      <View style={S.metricsGrid}>
        {entries.map(([k, v]) => (
          <View key={k} style={S.metricItem}>
            <Text style={S.metricValue}>{String(v)}</Text>
            <Text style={S.metricLabel}>{k.replace(/_/g, ' ')}</Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <ScrollView
      style={S.container}
      contentContainerStyle={S.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <TouchableOpacity style={S.breadcrumb} onPress={() => navigation.navigate('dashboard')} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={16} color={colors.textMuted} />
        <Text style={S.breadcrumbText}>All services</Text>
      </TouchableOpacity>

      <View style={S.titleRow}>
        {meta?.icon && (
          <View style={S.iconWrap}>
            <Ionicons name={meta.icon} size={24} color={colors.primary} />
          </View>
        )}
        <View style={S.titleTextWrap}>
          <Text style={S.title}>{label}</Text>
          {meta?.description ? <Text style={S.subtitle}>{meta.description}</Text> : null}
        </View>
      </View>

      {error && (
        <Box style={S.errorBox}>
          <Text style={S.errorText}>{error}</Text>
        </Box>
      )}

      {/* Service Status + control */}
      <Box title="Service status">
        {status ? (
          <>
            <ServiceToggle enabled={status.enabled} onToggle={handleToggle} loading={toggling} />
            <ServiceStatus
              status={status.enabled ? 'enabled' : 'disabled'}
              lastChecked={new Date().toISOString()}
              onRefresh={loadAll}
            />
            {status.deployed && (
              <View style={S.infoRow}>
                <Text style={S.infoLabel}>Deployed on</Text>
                <Text style={S.infoValue}>Worker {status.worker_id || 'unknown'}</Text>
              </View>
            )}
            {status.health && (
              <View style={S.infoRow}>
                <Text style={S.infoLabel}>Health</Text>
                <Text style={S.infoValue}>{status.health.status || 'unknown'}</Text>
              </View>
            )}
          </>
        ) : (
          <ActivityIndicator size="small" color={colors.primary} />
        )}
      </Box>

      {/* Health detail */}
      {status?.enabled && (
        <Box title="Health">
          {health ? (
            <>
              <View style={S.infoRow}>
                <Text style={S.infoLabel}>Status</Text>
                <Text style={S.infoValue}>{health.status || 'ok'}</Text>
              </View>
              {health.version ? (
                <View style={S.infoRow}>
                  <Text style={S.infoLabel}>Version</Text>
                  <Text style={S.infoValue}>{health.version}</Text>
                </View>
              ) : null}
              {health.uptime ? (
                <View style={S.infoRow}>
                  <Text style={S.infoLabel}>Uptime</Text>
                  <Text style={S.infoValue}>{health.uptime}</Text>
                </View>
              ) : null}
            </>
          ) : (
            <Text style={S.hintText}>No health endpoint reported by this service yet.</Text>
          )}
        </Box>
      )}

      {/* Metrics */}
      {status?.enabled && (
        <Box title="Metrics">{renderMetrics() || <Text style={S.hintText}>No metrics reported.</Text>}</Box>
      )}

      {/* Getting started / not enabled hint */}
      {status && !status.enabled && (
        <Box title="Getting started">
          <Text style={S.hintText}>
            Enable {label} above to deploy it to a worker. Once running, this console shows live
            health and metrics. A dedicated management UI for {label} can be added on top of this
            console.
          </Text>
        </Box>
      )}
    </ScrollView>
  );
};
