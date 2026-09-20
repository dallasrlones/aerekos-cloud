import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Box } from '../../components/Box/Box';
import { Button } from '../../components/Button/Button';
import { aiManagerService } from '../../services/aiManagerService';
import { useProject } from '../../contexts/ProjectContext';
import { colors } from '../../styles/theme';
import { AiProviderFormStyles as S } from './AiProviderForm.styles';

export const MemoryStoreForm = ({ navigation, route }) => {
  const memoryId = route?.params?.memoryId;
  const isEdit = !!memoryId;
  const { currentProject } = useProject();
  const projectId = currentProject?.id;

  const [form, setForm] = useState({
    name: '',
    embeddings_integration: '',
    extractor_integration: '',
    window_size: '200',
    importance_threshold: '0.6',
    ingest_rpm_per_session: '120',
    ingest_rpm_per_user: '300',
    data_worker_id: 'local',
    status: 'draft',
    arn: '',
  });
  const [embeds, setEmbeds] = useState([]);
  const [llms, setLlms] = useState([]);
  const [attached, setAttached] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [fetching, setFetching] = useState(isEdit);

  const loadLists = useCallback(async () => {
    if (!projectId) return;
    try {
      const [emb, llm, intel] = await Promise.all([
        aiManagerService.listIntegrations(projectId, 'embeddings').catch(() => []),
        aiManagerService.listIntegrations(projectId, 'llm').catch(() => []),
        aiManagerService.listIntelligence(projectId).catch(() => []),
      ]);
      setEmbeds(emb);
      setLlms(llm);
      setAttached(intel.filter((i) => (i.memory || []).some((m) => m.name === form.name)));
    } catch (_) { /* ignore */ }
  }, [projectId, form.name]);

  const load = useCallback(async () => {
    if (!isEdit || !projectId) { setFetching(false); return; }
    try {
      const p = await aiManagerService.getMemoryStore(projectId, memoryId);
      setForm({
        name: p.name || '',
        embeddings_integration: p.embeddings_integration || '',
        extractor_integration: p.extractor_integration || '',
        window_size: String(p.window_size || '200'),
        importance_threshold: String(p.importance_threshold ?? '0.6'),
        ingest_rpm_per_session: String(p.ingest_rpm_per_session || '120'),
        ingest_rpm_per_user: String(p.ingest_rpm_per_user || '300'),
        data_worker_id: p.data_worker_id || 'local',
        status: p.status || 'draft',
        arn: p.arn || '',
      });
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error?.message || err.message);
    } finally {
      setFetching(false);
    }
  }, [isEdit, projectId, memoryId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadLists(); }, [loadLists]);

  const handleSubmit = async () => {
    if (!projectId) return;
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    setErrors(e);
    if (Object.keys(e).length) return;
    setLoading(true);
    try {
      const data = {
        ...form,
        name: form.name.trim().toLowerCase(),
      };
      const saved = await aiManagerService.createMemoryStore(projectId, data);
      if (!isEdit && saved?.id) {
        navigation.navigate('aiMemoryForm', { memoryId: saved.id });
        return;
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleProvision = async () => {
    if (!projectId || !form.name) return;
    setProvisioning(true);
    try {
      await aiManagerService.setupMemoryStore(projectId, {
        name: form.name,
        config: {
          name: form.name,
          data_worker_id: form.data_worker_id || 'local',
          embeddings_integration: form.embeddings_integration,
          extractor_integration: form.extractor_integration,
        },
      });
      await load();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error?.message || err.message);
    } finally {
      setProvisioning(false);
    }
  };

  if (fetching) {
    return (
      <View style={[S.container, S.center]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const embedHit = embeds.find((x) => x.name === form.embeddings_integration);
  const extractHit = llms.find((x) => x.name === form.extractor_integration);

  return (
    <ScrollView style={S.container} contentContainerStyle={S.content}>
      <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }} onPress={() => navigation.navigate('aiManager')} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={16} color={colors.textMuted} />
        <Text style={S.help}> AI Manager</Text>
      </TouchableOpacity>
      <Text style={S.title}>{isEdit ? 'Memory store' : 'Create memory store'}</Text>
      <Text style={S.subtitle}>Short-term + long-term conversational memory. Attach to any intelligence endpoint.</Text>

      <Box title="Store">
        <View style={S.field}>
          <Text style={S.label}>Name *</Text>
          <TextInput
            style={[S.input, errors.name && S.inputError]}
            value={form.name}
            onChangeText={(v) => setForm((p) => ({ ...p, name: v }))}
            placeholder="icarus"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            editable={!isEdit}
          />
          {errors.name ? <Text style={S.errorText}>{errors.name}</Text> : null}
        </View>
        <View style={S.statusGrid || S.field}>
          <Text style={S.help}>Status: {form.status || 'draft'}</Text>
          {form.arn ? <Text style={S.help}>{form.arn}</Text> : null}
        </View>
        <View style={S.field}>
          <Text style={S.label}>Embeddings endpoint</Text>
          <View style={S.chips}>
            <Button title="Hash fallback" variant={!form.embeddings_integration ? 'primary' : 'secondary'} onPress={() => setForm((p) => ({ ...p, embeddings_integration: '' }))} style={S.chip} />
            {embeds.map((e) => (
              <Button key={e.id} title={e.name} variant={form.embeddings_integration === e.name ? 'primary' : 'secondary'} onPress={() => setForm((p) => ({ ...p, embeddings_integration: e.name }))} style={S.chip} />
            ))}
          </View>
          {embedHit ? (
            <Button title={`Open ${embedHit.name}`} variant="secondary" onPress={() => navigation.navigate('aiProviderForm', { providerId: embedHit.id })} style={{ marginTop: 8, alignSelf: 'flex-start' }} />
          ) : null}
        </View>
        <View style={S.field}>
          <Text style={S.label}>Extractor LLM</Text>
          <View style={S.chips}>
            <Button title="Default LLM" variant={!form.extractor_integration ? 'primary' : 'secondary'} onPress={() => setForm((p) => ({ ...p, extractor_integration: '' }))} style={S.chip} />
            {llms.map((e) => (
              <Button key={e.id} title={e.name} variant={form.extractor_integration === e.name ? 'primary' : 'secondary'} onPress={() => setForm((p) => ({ ...p, extractor_integration: e.name }))} style={S.chip} />
            ))}
          </View>
          {extractHit ? (
            <Button title={`Open ${extractHit.name}`} variant="secondary" onPress={() => navigation.navigate('aiProviderForm', { providerId: extractHit.id })} style={{ marginTop: 8, alignSelf: 'flex-start' }} />
          ) : null}
        </View>
        <View style={S.field}>
          <Text style={S.label}>Window size</Text>
          <TextInput style={S.input} value={form.window_size} onChangeText={(v) => setForm((p) => ({ ...p, window_size: v }))} keyboardType="numeric" />
        </View>
        <View style={S.field}>
          <Text style={S.label}>Importance threshold</Text>
          <TextInput style={S.input} value={form.importance_threshold} onChangeText={(v) => setForm((p) => ({ ...p, importance_threshold: v }))} keyboardType="numeric" />
        </View>
        <View style={S.field}>
          <Text style={S.label}>Ingest RPM / session</Text>
          <TextInput style={S.input} value={form.ingest_rpm_per_session} onChangeText={(v) => setForm((p) => ({ ...p, ingest_rpm_per_session: v }))} keyboardType="numeric" />
        </View>
        <View style={S.field}>
          <Text style={S.label}>Ingest RPM / user</Text>
          <TextInput style={S.input} value={form.ingest_rpm_per_user} onChangeText={(v) => setForm((p) => ({ ...p, ingest_rpm_per_user: v }))} keyboardType="numeric" />
        </View>
      </Box>

      {attached.length ? (
        <Box title="Attached intelligence">
          {attached.map((i) => (
            <TouchableOpacity key={i.id} style={S.row} onPress={() => navigation.navigate('aiIntelligenceForm', { intelligenceId: i.id })}>
              <View style={S.rowMain}>
                <Text style={S.rowName}>{i.name}</Text>
                <Text style={S.rowSub}>{i.arn}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </Box>
      ) : null}

      <View style={S.buttons}>
        <Button title={isEdit ? 'Save changes' : 'Create store'} onPress={handleSubmit} loading={loading} />
        <Button title="Provision" variant="secondary" onPress={handleProvision} loading={provisioning} style={S.cancel} />
        <Button title="Cancel" onPress={() => navigation.goBack()} variant="secondary" style={S.cancel} />
      </View>
    </ScrollView>
  );
};
