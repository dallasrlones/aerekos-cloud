import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Box } from '../../components/Box/Box';
import { Button } from '../../components/Button/Button';
import { ServiceStatus } from '../../components/ServiceStatus/ServiceStatus';
import { AnimusPage, AnimusState, AnimusNextSteps } from '../../components/Animus';
import { useTheme } from '../../contexts/ThemeContext';
import { ServiceSetupWizard } from '../../components/ServiceSetupWizard';
import { ManagerAppAccessSection } from '../../components/ManagerAppAccessSection';
import { ResourceCrud } from '../../components/ResourceCrud';
import { getServiceMeta, getServiceLabel } from '../../services/serviceCatalog';
import { managerService } from '../../services/managerService';
import { backupService } from '../../services/backupService';
import { ManagerConsoleStyles as S } from './ManagerConsole.styles';
import { ServiceInstancesPanel } from '../../components/ServiceInstancesPanel/ServiceInstancesPanel';
import { useProject } from '../../contexts/ProjectContext';
import { useToast } from '../../components/Toast/ToastProvider';
import { ScreenTabs } from '../../components/ScreenTabs/ScreenTabs';
import { ObservabilityPanel } from '../../components/ObservabilityPanel/ObservabilityPanel';
import { ServiceGuide } from '../../components/ServiceGuide/ServiceGuide';
import { useServiceGuideDeps } from '../../hooks/useServiceGuideDeps';

const ALWAYS_ON = new Set(['code_as_infra', 'system_manager']);

/** ServiceGuide copy for managers without dedicated screen folders (managerConsole route). */
const CONSOLE_GUIDES = {
  logs_manager: {
    title: 'Logs guide',
    analogue: 'Amazon CloudWatch Logs',
    blurb: 'Centralized log ingestion, search, and retention for manager and worker output — query by level, source, or free text.',
    whenToUse: [
      'Debug compute_manager and function_manager rollouts',
      'Tail ai_manager and cicd_manager pipeline output',
      'Audit retention before shipping to object storage',
    ],
    prerequisites: [
      'Select a project for scoped search',
      'Enable logs_manager on a worker',
    ],
    examples: [
      {
        label: 'Search logs',
        code: 'GET /api/services/logs_manager/api/v1/logs?project_id={projectId}&q=error&level=error',
      },
      {
        label: 'Ingest batch',
        code: 'POST /api/services/logs_manager/api/v1/logs/batch\n{ "project_id": "{projectId}", "entries": […] }',
      },
    ],
  },
  metrics_manager: {
    title: 'Metrics guide',
    analogue: 'Amazon CloudWatch Metrics',
    blurb: 'Time-series metrics and scrape targets for SLO dashboards — filter series by name and chart recent samples in the Monitoring tab.',
    whenToUse: [
      'CPU and memory signals from compute_manager containers',
      'Queue depth and handler latency alarms',
      'GA SLO targets wired in docs/slo',
    ],
    prerequisites: [
      'Select a project when series are project-scoped',
      'Enable metrics_manager on a worker',
    ],
    examples: [
      {
        label: 'List series',
        code: 'GET /api/services/metrics_manager/api/v1/series?project_id={projectId}&metric_name=cpu',
      },
      {
        label: 'Prometheus scrape',
        code: 'GET /api/services/metrics_manager/metrics',
      },
    ],
  },
  iam_manager: {
    title: 'Identity & access guide',
    analogue: 'AWS IAM',
    blurb: 'Roles, policies, and evaluate API for human JWT access at the conductor edge — complements app credentials from auth_manager.',
    whenToUse: [
      'Fine-grained Allow/Deny on manager proxy routes',
      'Role attachments for project operators',
      'Break-glass admin policies (audited separately)',
    ],
    prerequisites: [
      'Select a project — policies are project-scoped',
      'Enable auth_manager before iam_manager',
    ],
    examples: [
      {
        label: 'Create policy',
        code: 'POST /api/services/iam_manager/api/v1/policies\n{ "project_id": "{projectId}", "document": { … } }',
      },
      {
        label: 'Evaluate',
        code: 'POST /api/services/iam_manager/api/v1/evaluate\n{ "project_id": "{projectId}", "action": "storage:GetObject", "resource": "arn:…" }',
      },
    ],
  },
};

export const ManagerConsole = ({ navigation, route }) => {
  const serviceName = route?.params?.serviceName;
  const meta = getServiceMeta(serviceName);
  const label = meta?.label || getServiceLabel(serviceName);
  const metaphor = meta?.metaphor || 'station';
  const { currentProject } = useProject();
  const { showToast } = useToast();
  const { colors, animus } = useTheme();

  const [status, setStatus] = useState(null);
  const [health, setHealth] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [backingUp, setBackingUp] = useState(false);
  const [tab, setTab] = useState('overview');
  const guideSpec = CONSOLE_GUIDES[serviceName];
  const { guideDeps, openDep, enableAllDeps, onSetup } = useServiceGuideDeps(
    serviceName,
    navigation,
    status?.enabled,
  );

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

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const runBackup = async () => {
    if (!currentProject?.id) return;
    setBackingUp(true);
    try {
      const job = await backupService.run(currentProject.id, { source: serviceName, resource: 'default' });
      showToast(`Backup queued · ${job?.storage_key || job?.id || 'job created'}`);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Backup failed');
    } finally {
      setBackingUp(false);
    }
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

  const alwaysOn = ALWAYS_ON.has(serviceName);

  const serviceDisabled = status && !(status.enabled || alwaysOn);

  return (
    <AnimusPage
      title={label}
      job={meta?.description || 'Mission station for this service.'}
      metaphor={metaphor}
      right={meta?.icon ? (
        <View style={S.iconWrap}>
          <Ionicons name={meta.icon} size={24} color={animus.gold} />
        </View>
      ) : null}
      primaryAction={serviceDisabled ? (
        <Button title="Enable / set up" onPress={() => setTab('settings')} />
      ) : (
        <Button title="Refresh" variant="secondary" onPress={onRefresh} loading={refreshing} />
      )}
    >
      <AnimusNextSteps navigation={navigation} />

      {guideSpec ? (
        <ServiceGuide
          title={guideSpec.title}
          analogue={guideSpec.analogue}
          blurb={guideSpec.blurb}
          whenToUse={guideSpec.whenToUse}
          prerequisites={guideSpec.prerequisites}
          examples={guideSpec.examples}
          deps={guideDeps}
          onSetupDep={openDep}
          onEnableAllDeps={enableAllDeps}
          onSetup={onSetup}
        />
      ) : null}

      {error ? (
        <AnimusState state="error" error={error} onRetry={loadAll} />
      ) : null}

      {serviceDisabled ? (
        <AnimusState
          state="disabled"
          onEnable={() => setTab('settings')}
        />
      ) : null}

      <ScreenTabs
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'resources', label: 'Resources' },
          { id: 'monitoring', label: 'Monitoring' },
          { id: 'access', label: 'Access' },
          { id: 'settings', label: 'Settings' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'overview' ? <Box title="Service status">
        {status ? (
          <>
            <ServiceStatus
              status={status.enabled || alwaysOn ? 'enabled' : 'disabled'}
              lastChecked={new Date().toISOString()}
              onRefresh={loadAll}
            />
            {alwaysOn ? (
              <Text style={S.hintText}>Always on for this project. Use the setup wizard if it is not deployed yet.</Text>
            ) : null}
            {status.deployed ? (
              <View style={S.infoRow}>
                <Text style={S.infoLabel}>Deployed on</Text>
                <Text style={S.infoValue}>Worker {status.worker_id || 'unknown'}</Text>
              </View>
            ) : null}
            <ServiceInstancesPanel
              instances={status.deployed ? [{ service: serviceName, status: status.health?.status || 'running', hostname: status.worker_id }] : []}
            />
          </>
        ) : (
          <ActivityIndicator size="small" color={colors.primary} />
        )}
      </Box> : null}

      {tab === 'settings' ? <>
      <ServiceSetupWizard serviceName={serviceName} navigation={navigation} onEnabled={loadAll} />
      <Box title="Backup">
        <Button title="Backup" variant="secondary" onPress={runBackup} loading={backingUp} />
      </Box>
      </> : null}

      {tab === 'resources' ? (
      <ResourceCrud serviceName={serviceName} enabled={!!status?.enabled || alwaysOn} />
      ) : null}

      {tab === 'access' && status?.enabled ? (
        <Box title="App access">
          <ManagerAppAccessSection serviceName={serviceName} />
        </Box>
      ) : null}

      {tab === 'monitoring' && status?.enabled ? (
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
            </>
          ) : (
            <Text style={S.hintText}>No health endpoint reported by this service yet.</Text>
          )}
        </Box>
      ) : null}

      {tab === 'monitoring' && status?.enabled ? (
        <Box title="Metrics">{renderMetrics() || <Text style={S.hintText}>No metrics reported.</Text>}</Box>
      ) : null}

      {tab === 'monitoring' ? <ObservabilityPanel serviceName={serviceName} /> : null}
    </AnimusPage>
  );
};
