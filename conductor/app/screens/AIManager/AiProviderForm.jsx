import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, Alert, ActivityIndicator, Switch } from 'react-native';
import { Box } from '../../components/Box/Box';
import { Button } from '../../components/Button/Button';
import { aiManagerService } from '../../services/aiManagerService';
import { managerService } from '../../services/managerService';
import { useProject } from '../../contexts/ProjectContext';
import { colors } from '../../styles/theme';
import { AiProviderFormStyles as S } from './AiProviderForm.styles';

const CAPABILITIES = [
  { id: 'llm', label: 'LLM' },
  { id: 'embeddings', label: 'Embeddings' },
  { id: 'tts', label: 'TTS' },
  { id: 'stt', label: 'STT' },
];

const PROVIDER_TYPES = {
  llm: ['ollama', 'vllm'],
  embeddings: ['ollama'],
  tts: ['cache', 'kokoro', 'xtts'],
  stt: ['whisper'],
};

const LOCAL_ENDPOINTS = {
  ollama: 'http://host.docker.internal:11434',
  vllm: 'http://host.docker.internal:8000',
  cache: 'http://host.docker.internal:8015',
  kokoro: 'http://host.docker.internal:8013',
  xtts: 'http://host.docker.internal:8002',
  whisper: 'http://host.docker.internal:8001',
};

const MODEL_HINTS = {
  llm: 'llama3.2:3b or cyankiwi/Qwen3.6-35B-A3B-AWQ-4bit',
  embeddings: 'mxbai-embed-large',
  tts: 'af_heart',
  stt: '',
};

const VLLM_QUANT = ['awq', 'gptq', 'bitsandbytes', 'fp8', 'none'];
const VLLM_DTYPE = ['half', 'float16', 'bfloat16', 'auto'];

const EMPTY_VLLM = {
  quantization: 'awq',
  dtype: 'half',
  gpu_memory_utilization: '0.5',
  max_model_len: '8192',
  max_num_seqs: '8',
  enable_prefix_caching: true,
  enforce_eager: true,
  reasoning_parser: 'qwen3',
};

function parseOpts(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch (_) { return {}; }
}

export const AiProviderForm = ({ navigation, route }) => {
  const providerId = route?.params?.providerId;
  const isEdit = !!providerId;
  const { currentProject } = useProject();
  const projectId = currentProject?.id;
  const presetCapability = route?.params?.capability;
  const presetProvider = route?.params?.provider;

  const [form, setForm] = useState({
    name: '',
    capability: presetCapability || 'llm',
    provider: presetProvider || 'ollama',
    endpoint: LOCAL_ENDPOINTS[presetProvider] || LOCAL_ENDPOINTS.ollama,
    model: presetProvider === 'vllm' ? 'cyankiwi/Qwen3.6-35B-A3B-AWQ-4bit' : '',
    is_default: false,
    enabled: true,
    options: '',
  });
  const [vllm, setVllm] = useState({ ...EMPTY_VLLM });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [fetching, setFetching] = useState(isEdit);
  const [instances, setInstances] = useState([]);

  const types = PROVIDER_TYPES[form.capability] || PROVIDER_TYPES.llm;

  const loadProvider = useCallback(async () => {
    if (!isEdit || !projectId) return;
    try {
      const p = await aiManagerService.getIntegration(projectId, providerId);
      setForm({
        name: p.name || '',
        capability: p.capability || 'llm',
        provider: p.provider || 'ollama',
        endpoint: p.endpoint || LOCAL_ENDPOINTS.ollama,
        model: p.model || '',
        is_default: p.is_default === 'true' || p.is_default === true,
        enabled: p.enabled !== 'false',
        options: typeof p.options === 'string' ? p.options : (p.options ? JSON.stringify(p.options, null, 2) : ''),
      });
      const opts = parseOpts(p.options);
      setVllm({
        quantization: opts.quantization || EMPTY_VLLM.quantization,
        dtype: opts.dtype || EMPTY_VLLM.dtype,
        gpu_memory_utilization: String(opts.gpu_memory_utilization ?? EMPTY_VLLM.gpu_memory_utilization),
        max_model_len: String(opts.max_model_len ?? EMPTY_VLLM.max_model_len),
        max_num_seqs: String(opts.max_num_seqs ?? EMPTY_VLLM.max_num_seqs),
        enable_prefix_caching: opts.enable_prefix_caching !== false,
        enforce_eager: opts.enforce_eager !== false,
        reasoning_parser: opts.reasoning_parser || EMPTY_VLLM.reasoning_parser,
      });
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error?.message || err.message || 'Failed to load integration');
    } finally {
      setFetching(false);
    }
  }, [isEdit, projectId, providerId]);

  useEffect(() => { loadProvider(); }, [loadProvider]);

  useEffect(() => {
    if (!projectId) { setInstances([]); return undefined; }
    let cancelled = false;
    managerService.listInstances('ai_manager', projectId)
      .then((list) => { if (!cancelled) setInstances(list); })
      .catch(() => { if (!cancelled) setInstances([]); });
    return () => { cancelled = true; };
  }, [projectId]);

  const update = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'capability') {
        const allowed = PROVIDER_TYPES[value] || PROVIDER_TYPES.llm;
        next.provider = allowed[0];
        next.endpoint = LOCAL_ENDPOINTS[allowed[0]] || '';
        next.model = '';
      }
      if (field === 'provider') {
        next.endpoint = LOCAL_ENDPOINTS[value] || next.endpoint;
        if (value === 'vllm' && !next.model) next.model = 'cyankiwi/Qwen3.6-35B-A3B-AWQ-4bit';
        if (value === 'ollama' && next.model.includes('/')) next.model = '';
      }
      return next;
    });
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
    setTestResult(null);
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.endpoint.trim()) e.endpoint = 'Endpoint URL is required';
    if (form.provider === 'vllm' && !form.model.trim()) e.model = 'Hugging Face model id is required for vLLM';
    if (form.provider !== 'vllm' && form.options.trim()) {
      try { JSON.parse(form.options); } catch (_) { e.options = 'Must be valid JSON'; }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleTest = async () => {
    if (!isEdit || !projectId) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await aiManagerService.testIntegration(projectId, providerId);
      setTestResult(result);
    } catch (err) {
      setTestResult({ reachable: false, error: err.response?.data?.error?.message || err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async () => {
    if (!projectId) {
      Alert.alert('No project', 'Select a project before adding an integration.');
      return;
    }
    if (!validate()) return;

    setLoading(true);
    try {
      const data = {
        name: form.name.trim(),
        capability: form.capability,
        provider: form.provider,
        endpoint: form.endpoint.trim(),
        model: form.model.trim(),
        is_default: form.is_default,
        enabled: form.enabled,
      };
      if (form.provider === 'vllm') {
        data.options = {
          quantization: vllm.quantization === 'none' ? null : vllm.quantization,
          dtype: vllm.dtype,
          gpu_memory_utilization: parseFloat(vllm.gpu_memory_utilization) || 0.5,
          max_model_len: parseInt(vllm.max_model_len, 10) || 8192,
          max_num_seqs: parseInt(vllm.max_num_seqs, 10) || 8,
          enable_prefix_caching: !!vllm.enable_prefix_caching,
          enforce_eager: !!vllm.enforce_eager,
          reasoning_parser: vllm.reasoning_parser || undefined,
        };
      } else if (form.options.trim()) {
        data.options = form.options.trim();
      }
      if (isEdit) {
        await aiManagerService.updateIntegration(projectId, providerId, data);
      } else {
        await aiManagerService.createIntegration(projectId, data);
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error?.message || error.message || 'Failed to save integration');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete endpoint', `Delete "${form.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await aiManagerService.deleteIntegration(projectId, providerId);
            navigation.goBack();
          } catch (err) {
            Alert.alert('Error', err.response?.data?.error?.message || err.message || 'Failed to delete');
          }
        },
      },
    ]);
  };

  if (fetching) {
    return (
      <View style={[S.container, S.center]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={S.container} contentContainerStyle={S.content}>
      <Text style={S.title}>{isEdit ? 'Edit endpoint' : 'Create endpoint'}</Text>
      <Text style={S.subtitle}>
        Register a named inference endpoint — Ollama, vLLM, TTS, or speech-to-text — then invoke it by name from apps.
      </Text>

      <Box title="Integration">
        <View style={S.field}>
          <Text style={S.label}>Name *</Text>
          <TextInput
            style={[S.input, errors.name && S.inputError]}
            value={form.name}
            onChangeText={(v) => update('name', v)}
            placeholder="orin-ollama"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
          />
          {errors.name && <Text style={S.errorText}>{errors.name}</Text>}
          <Text style={S.help}>Used as the `integration` field in API calls.</Text>
        </View>

        <View style={S.field}>
          <Text style={S.label}>Capability</Text>
          <View style={S.chips}>
            {CAPABILITIES.map((c) => (
              <Button
                key={c.id}
                title={c.label}
                onPress={() => update('capability', c.id)}
                variant={form.capability === c.id ? 'primary' : 'secondary'}
                style={S.chip}
              />
            ))}
          </View>
        </View>

        <View style={S.field}>
          <Text style={S.label}>Local service</Text>
          <View style={S.chips}>
            {types.map((t) => (
              <Button
                key={t}
                title={t}
                onPress={() => update('provider', t)}
                variant={form.provider === t ? 'primary' : 'secondary'}
                style={S.chip}
              />
            ))}
          </View>
        </View>
      </Box>

      {instances.filter((i) => i.status === 'deployed').length > 0 ? (
        <Box title="Deployed on">
          {instances.filter((i) => i.status === 'deployed').map((inst) => (
            <Text key={inst.worker_id} style={S.help}>
              {inst.worker_hostname || inst.worker_id?.slice(0, 8)}
              {inst.worker_ip ? ` · ${inst.worker_ip}` : ''}
              {inst.worker_status ? ` · ${inst.worker_status}` : ''}
            </Text>
          ))}
          <Button
            title="View device details"
            variant="secondary"
            onPress={() => navigation.navigate('deviceDetails', { deviceId: instances[0].worker_id })}
            style={{ marginTop: 8 }}
          />
        </Box>
      ) : null}

      <Box title="Connection">
        <View style={S.field}>
          <Text style={S.label}>Endpoint URL *</Text>
          <TextInput
            style={[S.input, errors.endpoint && S.inputError]}
            value={form.endpoint}
            onChangeText={(v) => update('endpoint', v)}
            placeholder={LOCAL_ENDPOINTS[form.provider]}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
          />
          {errors.endpoint && <Text style={S.errorText}>{errors.endpoint}</Text>}
        </View>

        <View style={S.field}>
          <Text style={S.label}>Default model / voice {form.provider === 'vllm' ? '*' : ''}</Text>
          <TextInput
            style={[S.input, errors.model && S.inputError]}
            value={form.model}
            onChangeText={(v) => update('model', v)}
            placeholder={form.provider === 'vllm' ? 'cyankiwi/Qwen3.6-35B-A3B-AWQ-4bit' : MODEL_HINTS[form.capability]}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
          />
          {errors.model && <Text style={S.errorText}>{errors.model}</Text>}
          {form.provider === 'vllm' ? (
            <Text style={S.help}>Hugging Face model id served by vLLM. Changing it here does not restart the GPU process.</Text>
          ) : null}
        </View>

        {(form.capability === 'tts') && (
          <View style={S.field}>
            <Text style={S.label}>Options (JSON)</Text>
            <TextInput
              style={[S.input, S.multiline, errors.options && S.inputError]}
              value={form.options}
              onChangeText={(v) => update('options', v)}
              placeholder={'{\n  "language": "en"\n}'}
              placeholderTextColor={colors.textMuted}
              multiline
              autoCapitalize="none"
            />
            {errors.options && <Text style={S.errorText}>{errors.options}</Text>}
          </View>
        )}

        <View style={S.switchRow}>
          <Text style={S.label}>Default for this capability</Text>
          <Switch value={form.is_default} onValueChange={(v) => update('is_default', v)} />
        </View>
        <View style={S.switchRow}>
          <Text style={S.label}>Enabled</Text>
          <Switch value={form.enabled} onValueChange={(v) => update('enabled', v)} />
        </View>

        {isEdit && (
          <View style={{ marginTop: 12 }}>
            <Button title="Test connection" onPress={handleTest} loading={testing} variant="secondary" />
            {testResult && (
              <Text style={[S.help, { marginTop: 8, color: testResult.reachable ? colors.success : colors.error }]}>
                {testResult.reachable ? 'Reachable' : 'Unreachable'}
                {testResult.error ? ` — ${testResult.error}` : ''}
                {testResult.version ? ` · ${testResult.version}` : ''}
                {testResult.backend ? ` · ${testResult.backend}` : ''}
              </Text>
            )}
          </View>
        )}
      </Box>

      {form.provider === 'vllm' && (
        <Box title="vLLM serving">
          <Text style={S.help}>
            Stored on this endpoint. Applying them requires restarting the vLLM container on the GPU host with matching flags — this form does not start or stop the process.
          </Text>
          <View style={[S.field, { marginTop: 12 }]}>
            <Text style={S.label}>Quantization</Text>
            <View style={S.chips}>
              {VLLM_QUANT.map((q) => (
                <Button
                  key={q}
                  title={q}
                  onPress={() => setVllm((p) => ({ ...p, quantization: q }))}
                  variant={vllm.quantization === q ? 'primary' : 'secondary'}
                  style={S.chip}
                />
              ))}
            </View>
          </View>
          <View style={S.field}>
            <Text style={S.label}>dtype</Text>
            <View style={S.chips}>
              {VLLM_DTYPE.map((d) => (
                <Button
                  key={d}
                  title={d}
                  onPress={() => setVllm((p) => ({ ...p, dtype: d }))}
                  variant={vllm.dtype === d ? 'primary' : 'secondary'}
                  style={S.chip}
                />
              ))}
            </View>
          </View>
          <View style={S.field}>
            <Text style={S.label}>GPU memory utilization (0–1)</Text>
            <TextInput
              style={S.input}
              value={vllm.gpu_memory_utilization}
              onChangeText={(v) => setVllm((p) => ({ ...p, gpu_memory_utilization: v }))}
              placeholder="0.5"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="decimal-pad"
            />
          </View>
          <View style={S.field}>
            <Text style={S.label}>Max model length</Text>
            <TextInput
              style={S.input}
              value={vllm.max_model_len}
              onChangeText={(v) => setVllm((p) => ({ ...p, max_model_len: v }))}
              placeholder="8192"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="number-pad"
            />
          </View>
          <View style={S.field}>
            <Text style={S.label}>Max concurrent sequences</Text>
            <TextInput
              style={S.input}
              value={vllm.max_num_seqs}
              onChangeText={(v) => setVllm((p) => ({ ...p, max_num_seqs: v }))}
              placeholder="8"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="number-pad"
            />
          </View>
          <View style={S.field}>
            <Text style={S.label}>Reasoning parser</Text>
            <TextInput
              style={S.input}
              value={vllm.reasoning_parser}
              onChangeText={(v) => setVllm((p) => ({ ...p, reasoning_parser: v }))}
              placeholder="qwen3"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
            />
          </View>
          <View style={S.switchRow}>
            <Text style={S.label}>Prefix caching</Text>
            <Switch
              value={!!vllm.enable_prefix_caching}
              onValueChange={(v) => setVllm((p) => ({ ...p, enable_prefix_caching: v }))}
            />
          </View>
          <View style={S.switchRow}>
            <Text style={S.label}>Enforce eager (lower memory, no CUDA graphs)</Text>
            <Switch
              value={!!vllm.enforce_eager}
              onValueChange={(v) => setVllm((p) => ({ ...p, enforce_eager: v }))}
            />
          </View>
        </Box>
      )}

      <View style={S.buttons}>
        <Button title={isEdit ? 'Save changes' : 'Create endpoint'} onPress={handleSubmit} loading={loading} />
        {isEdit && <Button title="Delete endpoint" onPress={handleDelete} variant="danger" style={S.cancel} />}
        <Button title="Cancel" onPress={() => navigation.goBack()} variant="secondary" style={S.cancel} />
      </View>
    </ScrollView>
  );
};
