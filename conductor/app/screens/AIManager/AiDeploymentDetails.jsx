import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Box } from '../../components/Box/Box';
import { managerService } from '../../services/managerService';
import { deviceService } from '../../services/deviceService';
import { aiManagerService } from '../../services/aiManagerService';
import { useProject } from '../../contexts/ProjectContext';
import { colors } from '../../styles/theme';
import { AIManagerStyles as S } from './AIManager.styles';

export const AiDeploymentDetails = ({ navigation }) => {
  const { currentProject } = useProject();
  const projectId = currentProject?.id;

  const [instances, setInstances] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [llmStatus, setLlmStatus] = useState(null);
  const [serviceStatus, setServiceStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [inst, devices, llm, st] = await Promise.all([
        projectId ? managerService.listInstances('ai_manager', projectId) : managerService.listInstances('ai_manager'),
        deviceService.getDevices().catch(() => []),
        aiManagerService.llmStatus().catch(() => null),
        managerService.getStatus('ai_manager').catch(() => null),
      ]);
      setInstances(inst);
      setWorkers(devices);
      setLlmStatus(llm);
      setServiceStatus(st);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load deployments');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const enrichWorker = (workerId) => workers.find((w) => w.id === workerId) || null;

  const deployed = instances.filter((i) => i.status === 'deployed');

  return (
    <ScrollView
      style={S.container}
      contentContainerStyle={S.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <TouchableOpacity style={S.breadcrumb} onPress={() => navigation.navigate('aiManager')} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={16} color={colors.textMuted} />
        <Text style={S.hintText}>AI Manager</Text>
      </TouchableOpacity>

      <Text style={S.title}>Deployments</Text>
      <Text style={S.subtitle}>Where ai_manager runs in your fleet</Text>

      {error && <Box style={S.errorBox}><Text style={S.errorText}>{error}</Text></Box>}

      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <>
          <Box title="Service">
            <View style={S.statusGrid}>
              <View style={S.statusCell}>
                <Text style={S.statusLabel}>Enabled</Text>
                <Text style={S.statusValue}>{serviceStatus?.enabled ? 'Yes' : 'No'}</Text>
              </View>
              <View style={S.statusCell}>
                <Text style={S.statusLabel}>Deployed</Text>
                <Text style={S.statusValue}>{serviceStatus?.deployed ? 'Yes' : 'No'}</Text>
              </View>
              <View style={S.statusCell}>
                <Text style={S.statusLabel}>Ollama</Text>
                <Text style={S.statusValue}>{llmStatus?.reachable ? 'Reachable' : 'Unreachable'}</Text>
              </View>
              <View style={S.statusCell}>
                <Text style={S.statusLabel}>Models on host</Text>
                <Text style={S.statusValue}>{llmStatus?.model_count ?? '—'}</Text>
              </View>
            </View>
          </Box>

          <Box title={`Instances (${deployed.length} active)`}>
            {!projectId ? (
              <Text style={S.hintText}>Select a project to scope deployments.</Text>
            ) : deployed.length === 0 ? (
              <Text style={S.hintText}>No deployed ai_manager instances for this project.</Text>
            ) : (
              deployed.map((inst) => {
                const device = enrichWorker(inst.worker_id);
                const res = inst.worker_resources || {};
                return (
                  <TouchableOpacity
                    key={inst.deployment_id || inst.worker_id}
                    style={S.row}
                    onPress={() => navigation.navigate('deviceDetails', { deviceId: inst.worker_id })}
                    activeOpacity={0.8}
                  >
                    <View style={S.rowMain}>
                      <Text style={S.rowName}>
                        {device?.hostname || inst.worker_hostname || inst.worker_id?.slice(0, 8)}
                      </Text>
                      <Text style={S.rowSub}>
                        {inst.worker_ip || device?.ip_address || '—'}
                        {' · '}{inst.worker_status || device?.status || 'unknown'}
                        {res.ram_gb ? ` · ${res.ram_gb} GB RAM` : ''}
                        {res.gpu ? ' · GPU' : ''}
                      </Text>
                      <Text style={S.rowSub}>
                        Deployed {inst.deployed_at ? new Date(inst.deployed_at).toLocaleString() : '—'}
                        {inst.project_id ? ` · project ${inst.project_id.slice(0, 8)}…` : ''}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                );
              })
            )}
          </Box>

          {instances.filter((i) => i.status !== 'deployed').length > 0 ? (
            <Box title="Inactive / stopped">
              {instances.filter((i) => i.status !== 'deployed').map((inst) => (
                <View key={inst.deployment_id || inst.worker_id} style={S.row}>
                  <View style={S.rowMain}>
                    <Text style={S.rowName}>{inst.worker_hostname || inst.worker_id?.slice(0, 8)}</Text>
                    <Text style={S.rowSub}>{inst.status} · {inst.worker_ip || '—'}</Text>
                  </View>
                </View>
              ))}
            </Box>
          ) : null}
        </>
      )}
    </ScrollView>
  );
};
