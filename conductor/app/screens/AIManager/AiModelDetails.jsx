import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Box } from '../../components/Box/Box';
import { Button } from '../../components/Button/Button';
import { aiManagerService } from '../../services/aiManagerService';
import { managerService } from '../../services/managerService';
import { deviceService } from '../../services/deviceService';
import { useProject } from '../../contexts/ProjectContext';
import { colors } from '../../styles/theme';
import { AIManagerStyles as S } from './AIManager.styles';

function formatBytes(n) {
  if (!n || n <= 0) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0; let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
}

export const AiModelDetails = ({ navigation, route }) => {
  const modelName = route?.params?.modelName;
  const { currentProject } = useProject();
  const projectId = currentProject?.id;

  const [model, setModel] = useState(null);
  const [llmStatus, setLlmStatus] = useState(null);
  const [instances, setInstances] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!modelName) return;
    setLoading(true);
    setError(null);
    try {
      const [models, status, inst, devices] = await Promise.all([
        aiManagerService.listModels({ projectId }),
        aiManagerService.llmStatus({ projectId }).catch(() => null),
        projectId ? managerService.listInstances('ai_manager', projectId) : managerService.listInstances('ai_manager'),
        deviceService.getDevices().catch(() => []),
      ]);
      setModel(models.find((m) => m.name === modelName) || { name: modelName });
      setLlmStatus(status);
      setInstances(inst.filter((i) => i.status === 'deployed'));
      setWorkers(devices);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load model');
    } finally {
      setLoading(false);
    }
  }, [modelName, projectId]);

  useEffect(() => { load(); }, [load]);

  const workerLabel = (workerId) => {
    const w = workers.find((d) => d.id === workerId);
    if (!w) return workerId?.slice(0, 8) || 'unknown';
    return w.hostname || w.name || w.id?.slice(0, 8);
  };

  const caps = model?.capabilities || model?.details?.family === 'nomic-bert' ? ['embedding'] : ['completion'];
  const d = model?.details || {};

  return (
    <ScrollView style={S.container} contentContainerStyle={S.content}>
      <TouchableOpacity style={S.breadcrumb} onPress={() => navigation.navigate('aiManager')} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={16} color={colors.textMuted} />
        <Text style={S.hintText}>AI Manager</Text>
      </TouchableOpacity>

      <Text style={S.title}>{modelName || 'Model'}</Text>
      <Text style={S.subtitle}>Ollama model on the GPU fleet</Text>

      {error && <Box style={S.errorBox}><Text style={S.errorText}>{error}</Text></Box>}

      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <>
          <Box title="Model">
            <View style={S.statusGrid}>
              <View style={S.statusCell}>
                <Text style={S.statusLabel}>Size</Text>
                <Text style={S.statusValue}>{formatBytes(model?.size)}</Text>
              </View>
              <View style={S.statusCell}>
                <Text style={S.statusLabel}>Family</Text>
                <Text style={S.statusValue}>{d.family || '—'}</Text>
              </View>
              <View style={S.statusCell}>
                <Text style={S.statusLabel}>Parameters</Text>
                <Text style={S.statusValue}>{d.parameter_size || '—'}</Text>
              </View>
              <View style={S.statusCell}>
                <Text style={S.statusLabel}>Quantization</Text>
                <Text style={S.statusValue}>{d.quantization_level || '—'}</Text>
              </View>
              <View style={S.statusCell}>
                <Text style={S.statusLabel}>Context</Text>
                <Text style={S.statusValue}>{d.context_length ? `${Math.round(d.context_length / 1024)}k` : '—'}</Text>
              </View>
              <View style={S.statusCell}>
                <Text style={S.statusLabel}>Capabilities</Text>
                <Text style={S.statusValue}>{(model?.capabilities || caps).join(', ')}</Text>
              </View>
            </View>
            {model?.digest ? (
              <Text style={[S.hintText, { marginTop: 8 }]} numberOfLines={2}>Digest: {model.digest}</Text>
            ) : null}
          </Box>

          <Box title="Backend">
            <View style={S.statusGrid}>
              <View style={S.statusCell}>
                <Text style={S.statusLabel}>Ollama</Text>
                <Text style={S.statusValue}>{llmStatus?.reachable ? 'Reachable' : 'Unreachable'}</Text>
              </View>
              <View style={S.statusCell}>
                <Text style={S.statusLabel}>URL</Text>
                <Text style={S.statusValue} numberOfLines={2}>{llmStatus?.base_url || '—'}</Text>
              </View>
              <View style={S.statusCell}>
                <Text style={S.statusLabel}>Version</Text>
                <Text style={S.statusValue}>{llmStatus?.version || '—'}</Text>
              </View>
            </View>
          </Box>

          <Box title={`Deployed instances (${instances.length})`}>
            {instances.length === 0 ? (
              <Text style={S.hintText}>No active ai_manager deployment for this project.</Text>
            ) : (
              instances.map((inst) => (
                <TouchableOpacity
                  key={inst.deployment_id || inst.worker_id}
                  style={S.row}
                  onPress={() => navigation.navigate('deviceDetails', { deviceId: inst.worker_id })}
                  activeOpacity={0.8}
                >
                  <View style={S.rowMain}>
                    <Text style={S.rowName}>{workerLabel(inst.worker_id)}</Text>
                    <Text style={S.rowSub}>
                      {inst.worker_ip || '—'} · {inst.worker_status || 'unknown'}
                      {inst.worker_resources?.gpu ? ` · GPU` : ''}
                      {inst.deployed_at ? ` · deployed ${new Date(inst.deployed_at).toLocaleDateString()}` : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              ))
            )}
            <Button
              title="View all deployments"
              variant="secondary"
              onPress={() => navigation.navigate('aiDeploymentDetails')}
              style={{ marginTop: 12 }}
            />
          </Box>

          <Button
            title="Open in chat playground"
            onPress={() => navigation.navigate('aiManager')}
          />
        </>
      )}
    </ScrollView>
  );
};
