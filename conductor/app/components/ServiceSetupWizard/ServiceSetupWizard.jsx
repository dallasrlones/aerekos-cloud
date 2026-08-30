import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Box } from '../Box/Box';
import { Button } from '../Button/Button';
import { setupService } from '../../services/setupService';
import { edgeService } from '../../services/edgeService';
import { managerService } from '../../services/managerService';
import { useProject } from '../../contexts/ProjectContext';
import { getServiceMeta, getServiceLabel } from '../../services/serviceCatalog';
import { colors } from '../../styles/theme';
import { ServiceSetupWizardStyles as S } from './ServiceSetupWizard.styles';
import { NextSteps } from '../NextSteps/NextSteps';
import { useToast } from '../Toast/ToastProvider';
import { useJobs } from '../JobStatus/JobStatus';

const STATUS_ICON = {
  connected: '✅',
  misconfigured: '⚠️',
  missing: '❌',
  deferred: '○',
};

const EDGE_SERVICES = new Set(['tunnel_manager', 'domain_manager', 'cdn_manager']);

export const ServiceSetupWizard = ({ serviceName, onEnabled, onNavigateToSecrets, navigation }) => {
  const { currentProject } = useProject();
  const { showToast } = useToast();
  const { createJob } = useJobs();
  const projectId = currentProject?.id;
  const [setup, setSetup] = useState(null);
  const [loading, setLoading] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [probing, setProbing] = useState(false);
  const [probeMsg, setProbeMsg] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState(null);


  const load = useCallback(async () => {
    if (!serviceName) return;
    setLoading(true);
    setError(null);
    try {
      setSetup(await setupService.getServiceSetup(serviceName, projectId));
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load setup');
      setSetup(null);
    } finally {
      setLoading(false);
    }
  }, [serviceName, projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleEnable = async () => {
    if (!projectId) return;
    setEnabling(true);
    try {
      await setupService.enable(projectId, serviceName);
      await createJob({ kind: 'enable-service', summary: `Enabled ${serviceName} (with dependencies)`, status: 'succeeded' });
      showToast(`Enabled ${getServiceLabel(serviceName)} and required dependencies`);
      await load();
      onEnabled?.();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Enable failed');
    } finally {
      setEnabling(false);
    }
  };

  if (!projectId) {
    return (
      <Box title="Setup">
        <Text style={S.hint}>Select a project to run the setup wizard.</Text>
      </Box>
    );
  }

  if (loading && !setup) {
    return <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />;
  }

  if (!setup) {
    return (
      <Box title="Setup">
        {error ? <Text style={S.error}>{error}</Text> : null}
        <Button title="Retry" variant="secondary" onPress={load} />
      </Box>
    );
  }

  const pct = setup.progress?.percent ?? 0;

  const openService = (name) => {
    if (!navigation || !name) return;
    const meta = getServiceMeta(name);
    if (meta?.route) navigation.navigate(meta.route);
    else navigation.navigate('managerConsole', { serviceName: name });
  };

  const steps = setup.wizardSteps && setup.wizardSteps.length ? setup.wizardSteps : ['overview', 'enable'];
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const firstResource = setup.firstResource;

  const openFirstResource = () => {
    openService(serviceName);
    showToast(firstResource?.label || 'Open console to create the first resource');
  };

  return (
    <>
      <NextSteps navigation={navigation} />
      <Box title={`Set up ${getServiceLabel(serviceName)}`}>
        <Text style={S.summary}>{setup.summary}</Text>
        <View style={S.progressRow}>
          <Text style={S.progressLabel}>Setup progress</Text>
          <Text style={S.progressPct}>{pct}%</Text>
        </View>
        <View style={S.progressBar}>
          <View style={[S.progressFill, { width: `${pct}%` }]} />
        </View>
        <Text style={S.hint}>Step {stepIndex + 1} of {steps.length}: {step}</Text>
        {error ? <Text style={S.error}>{error}</Text> : null}
      </Box>

      {(step === 'overview' || step === 'dependencies') && (
      <Box title="Dependencies">
        {(setup.dependencies || []).length === 0 ? (
          <Text style={S.hint}>No dependencies required.</Text>
        ) : (
          setup.dependencies.map((d) => (
            <View key={d.service} style={S.depRow}>
              <TouchableOpacity
                onPress={() => openService(d.service)}
                disabled={!navigation}
                activeOpacity={navigation ? 0.7 : 1}
                style={{ flex: 1 }}
              >
                <Text style={S.depText}>
                  {STATUS_ICON[d.status] || '•'} {getServiceLabel(d.service)} — {d.message}
                  {navigation ? ' ›' : ''}
                </Text>
              </TouchableOpacity>
              {d.required && d.status === 'missing' ? (
                <Button
                  title="Enable"
                  onPress={async () => {
                    setEnabling(true);
                    try {
                      await setupService.enable(projectId, d.service);
                      showToast(`Enabled ${getServiceLabel(d.service)}`);
                      await load();
                    } catch (err) {
                      setError(err.response?.data?.error?.message || err.message || 'Enable failed');
                    } finally {
                      setEnabling(false);
                    }
                  }}
                  loading={enabling}
                />
              ) : null}
            </View>
          ))
        )}
      </Box>
      )}

      {step === 'secrets' && (setup.secrets || []).length > 0 ? (
        <Box title="Secrets">
          {setup.secrets.map((s) => (
            <Text key={s.name} style={S.hint}>
              {STATUS_ICON[s.status] || (s.required ? '•' : '○')} {s.name}: {s.desc}
              {s.message ? ` — ${s.message}` : ''}
            </Text>
          ))}
          {onNavigateToSecrets ? (
            <Button title="Add secrets" variant="secondary" onPress={onNavigateToSecrets} />
          ) : null}
        </Box>
      ) : null}

      {step === 'test' && EDGE_SERVICES.has(serviceName) && setup.enabled ? (
        <Box title="Test Cloudflare">
          <Button
            title="Probe connection"
            variant="secondary"
            loading={probing}
            onPress={async () => {
              if (!projectId) return;
              setProbing(true);
              setProbeMsg(null);
              try {
                const p = await edgeService.probeCloudflare(projectId);
                setProbeMsg(p?.message || (p?.ready ? 'Connected' : 'Not ready'));
              } catch (err) {
                setProbeMsg(err.response?.data?.error?.message || err.message || 'Probe failed');
              } finally {
                setProbing(false);
              }
            }}
          />
          {probeMsg ? <Text style={S.hint}>{probeMsg}</Text> : null}
        </Box>
      ) : null}

      {(step === 'enable' || step === 'overview') && (
      <Box title="Enable">
        <Text style={S.hint}>
          {setup.enabled
            ? (setup.health ? 'Service is enabled and healthy.' : 'Enabled — waiting for health check.')
            : 'Enable this service for the current project to deploy it to a worker.'}
        </Text>
        {!setup.enabled ? (
          <Button title="Enable with dependencies" onPress={handleEnable} loading={enabling} />
        ) : (
          <Button title="Refresh status" variant="secondary" onPress={load} />
        )}
      </Box>
      )}

      {step === 'first-resource' && firstResource ? (
        <Box title="First resource">
          <Text style={S.hint}>{firstResource.label || 'Create the first resource for this service.'}</Text>
          <Button title={firstResource.label || 'Create'} onPress={openFirstResource} />
        </Box>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        <Button title="Back" variant="secondary" onPress={() => setStepIndex((i) => Math.max(0, i - 1))} />
        <Button title="Next" onPress={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))} />
      </View>
    </>
  );
};
