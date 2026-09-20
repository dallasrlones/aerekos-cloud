import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Box } from '../../components/Box/Box';
import { Button } from '../../components/Button/Button';
import { aiManagerService } from '../../services/aiManagerService';
import { useProject } from '../../contexts/ProjectContext';
import { colors } from '../../styles/theme';
import { AiProviderFormStyles as S } from './AiProviderForm.styles';

export const LoraAdapterForm = ({ navigation, route }) => {
  const loraId = route?.params?.loraId;
  const isEdit = !!loraId;
  const { currentProject } = useProject();
  const projectId = currentProject?.id;

  const [name, setName] = useState('coach');
  const [examplesText, setExamplesText] = useState('');
  const [adapter, setAdapter] = useState(null);
  const [job, setJob] = useState(null);
  const [intelligence, setIntelligence] = useState([]);
  const [attachName, setAttachName] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!projectId) { setFetching(false); return; }
    try {
      const intel = await aiManagerService.listIntelligence(projectId).catch(() => []);
      setIntelligence(intel);
      if (!isEdit) { setFetching(false); return; }
      const data = await aiManagerService.getLora(projectId, loraId);
      const a = data?.adapter || data;
      setAdapter(a);
      setJob(data?.job || null);
      setName(a?.name || '');
      setAttachName(a?.attached_intelligence || '');
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setFetching(false);
    }
  }, [projectId, isEdit, loraId]);

  useEffect(() => { load(); }, [load]);

  const parseExamples = () => {
    const raw = examplesText.trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return raw.split('\n').filter(Boolean).map((line) => {
        try { return JSON.parse(line); } catch { return { text: line }; }
      });
    }
  };

  const handleTrain = async () => {
    if (!projectId || !name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await aiManagerService.trainLora(projectId, { name: name.trim(), examples: parseExamples() });
      const id = res?.adapter?.id || res?.job_id;
      if (id) navigation.navigate('aiLoraForm', { loraId: id });
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAttach = async () => {
    if (!projectId || !loraId || !attachName.trim()) {
      Alert.alert('Attach', 'Pick an intelligence endpoint first.');
      return;
    }
    setLoading(true);
    try {
      await aiManagerService.attachLora(projectId, { adapter_id: loraId, intelligence: attachName.trim() });
      const hit = intelligence.find((i) => i.name === attachName.trim());
      if (hit) {
        await aiManagerService.attachIntelligence(projectId, hit.id, { kind: 'lora', target_name: adapter?.name || name }).catch(() => {});
      }
      await load();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <View style={[S.container, S.center]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const attachedIntel = intelligence.find((i) => i.name === (adapter?.attached_intelligence || attachName));

  return (
    <ScrollView style={S.container} contentContainerStyle={S.content}>
      <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }} onPress={() => navigation.navigate('aiManager')} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={16} color={colors.textMuted} />
        <Text style={S.help}> AI Manager</Text>
      </TouchableOpacity>
      <Text style={S.title}>{isEdit ? (adapter?.name || 'LoRA adapter') : 'Train LoRA adapter'}</Text>
      <Text style={S.subtitle}>PEFT adapter against a base LLM. Never overwrites production Ollama tags.</Text>
      {error ? <Box><Text style={S.errorText}>{error}</Text></Box> : null}

      <Box title="Adapter">
        <View style={S.field}>
          <Text style={S.label}>Name</Text>
          <TextInput
            style={S.input}
            value={name}
            onChangeText={setName}
            placeholder="coach"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            editable={!isEdit}
          />
        </View>
        {adapter ? (
          <>
            <Text style={S.help}>Status: {adapter.status || job?.status || '—'}</Text>
            <Text style={S.help}>Base: {adapter.base || '—'}</Text>
            <Text style={S.help}>Derived model: {adapter.derived_model || '—'}</Text>
            {adapter.weights ? <Text style={S.help}>Weights: {adapter.weights}</Text> : null}
            {adapter.loss != null ? <Text style={S.help}>Loss: {adapter.loss}</Text> : null}
            {adapter.error || job?.error ? <Text style={S.errorText}>{adapter.error || job.error}</Text> : null}
            {adapter.examples != null ? <Text style={S.help}>Examples: {adapter.examples}</Text> : null}
          </>
        ) : (
          <View style={S.field}>
            <Text style={S.label}>Examples (JSON array or JSONL)</Text>
            <TextInput
              style={[S.input, S.multiline]}
              value={examplesText}
              onChangeText={setExamplesText}
              placeholder='[{"prompt":"hi","completion":"hello"}]'
              placeholderTextColor={colors.textMuted}
              multiline
            />
          </View>
        )}
      </Box>

      {isEdit ? (
        <Box title="Attach to intelligence">
          <View style={S.chips}>
            {intelligence.map((i) => (
              <Button
                key={i.id}
                title={i.name}
                variant={attachName === i.name ? 'primary' : 'secondary'}
                onPress={() => setAttachName(i.name)}
                style={S.chip}
              />
            ))}
          </View>
          <Button title="Attach" onPress={handleAttach} loading={loading} style={{ marginTop: 8, alignSelf: 'flex-start' }} />
          {attachedIntel ? (
            <TouchableOpacity style={S.row} onPress={() => navigation.navigate('aiIntelligenceForm', { intelligenceId: attachedIntel.id })}>
              <View style={S.rowMain}>
                <Text style={S.rowName}>{attachedIntel.name}</Text>
                <Text style={S.rowSub}>Open intelligence</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </Box>
      ) : null}

      <View style={S.buttons}>
        {isEdit ? (
          <Button title="Refresh" onPress={load} variant="secondary" />
        ) : (
          <Button title="Train" onPress={handleTrain} loading={loading} />
        )}
        <Button title="Cancel" onPress={() => navigation.goBack()} variant="secondary" style={S.cancel} />
      </View>
    </ScrollView>
  );
};
