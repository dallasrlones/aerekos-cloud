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
  llm: ['ollama'],
  embeddings: ['ollama'],
  tts: ['cache', 'kokoro', 'xtts'],
  stt: ['whisper'],
};

const LOCAL_ENDPOINTS = {
  ollama: 'http://192.168.0.221:11434',
  cache: 'http://192.168.0.221:8015',
  kokoro: 'http://192.168.0.221:8013',
  xtts: 'http://192.168.0.221:8002',
  whisper: 'http://192.168.0.221:8001',
};

const MODEL_HINTS = {
  llm: 'llama3.2:3b',
  embeddings: 'mxbai-embed-large',
  tts: 'af_heart',
  stt: '',
};

export const AiProviderForm = ({ navigation, route }) => {
  const providerId = route?.params?.providerId;
  const isEdit = !!providerId;
  const { currentProject } = useProject();
  const projectId = currentProject?.id;

  const [form, setForm] = useState({
    name: '',
    capability: 'llm',
    provider: 'ollama',
    endpoint: LOCAL_ENDPOINTS.ollama,
    model: '',
    is_default: false,
    enabled: true,
    options: '',
  });
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
        options: p.options || '',
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
    if (form.options.trim()) {
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
        options: form.options.trim(),
      };
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
    Alert.alert('Delete integration', `Delete "${form.name}"?`, [
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
      <Text style={S.title}>{isEdit ? 'Edit integration' : 'Add local integration'}</Text>
      <Text style={S.subtitle}>
        Register a named endpoint on your fleet — Ollama, dictionary TTS, Kokoro, XTTS, or faster-whisper.
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
          <Text style={S.label}>Default model / voice</Text>
          <TextInput
            style={S.input}
            value={form.model}
            onChangeText={(v) => update('model', v)}
            placeholder={MODEL_HINTS[form.capability]}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
          />
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

      <View style={S.buttons}>
        <Button title={isEdit ? 'Save changes' : 'Add integration'} onPress={handleSubmit} loading={loading} />
        {isEdit && <Button title="Delete integration" onPress={handleDelete} variant="danger" style={S.cancel} />}
        <Button title="Cancel" onPress={() => navigation.goBack()} variant="secondary" style={S.cancel} />
      </View>
    </ScrollView>
  );
};
