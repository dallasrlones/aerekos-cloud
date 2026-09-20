import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TextInput, Alert, ActivityIndicator, Switch, TouchableOpacity, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Box } from '../../components/Box/Box';
import { Button } from '../../components/Button/Button';
import { aiManagerService } from '../../services/aiManagerService';
import { useProject } from '../../contexts/ProjectContext';
import { colors } from '../../styles/theme';
import { AiProviderFormStyles as S } from './AiProviderForm.styles';
import { ModelSelect } from '../../components/ModelSelect/ModelSelect';
import { ScreenTabs } from '../../components/ScreenTabs/ScreenTabs';

function isEnabled(p) {
  return p && p.enabled !== 'false' && p.enabled !== false;
}

function isSmoke(p) {
  return /icarus-c0-/i.test(String(p?.name || ''));
}

function preferredSort(a, b) {
  const rank = (n) => (/^orin-(vllm|ollama)$/i.test(n) ? 0 : 1);
  return rank(a.name) - rank(b.name) || String(a.name).localeCompare(String(b.name));
}

function providerKind(p) {
  return String(p?.provider || p?.provider_type || 'ollama').toLowerCase() === 'vllm' ? 'vllm' : 'ollama';
}

function RouteSelect({ items, value, onChange, placeholder }) {
  if (Platform.OS === 'web') {
    return (
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 8,
          padding: 8,
          fontSize: 14,
          color: colors.textPrimary,
          backgroundColor: colors.cardBackground,
          width: '100%',
        }}
      >
        <option value="">{placeholder}</option>
        {items.map((l) => (
          <option key={l.id || l.name} value={l.name}>
            {l.name}
            {l.model ? ` · ${l.model}` : ''}
          </option>
        ))}
      </select>
    );
  }
  return (
    <View style={[S.chips, { marginTop: 8 }]}>
      {items.map((l) => (
        <Button
          key={l.id || l.name}
          title={l.name}
          variant={value === l.name ? 'primary' : 'secondary'}
          onPress={() => onChange(l.name)}
          style={S.chip}
        />
      ))}
    </View>
  );
}

function AttachedRow({ title, subtitle, onPress }) {
  return (
    <TouchableOpacity style={S.row} onPress={onPress} activeOpacity={0.8} disabled={!onPress}>
      <View style={S.rowMain}>
        <Text style={S.rowName}>{title}</Text>
        {subtitle ? <Text style={S.rowSub}>{subtitle}</Text> : null}
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null}
    </TouchableOpacity>
  );
}

export const IntelligenceForm = ({ navigation, route }) => {
  const intelligenceId = route?.params?.intelligenceId;
  const isEdit = !!intelligenceId;
  const { currentProject } = useProject();
  const projectId = currentProject?.id;

  const [form, setForm] = useState({
    name: '',
    description: '',
    llm_integration: '',
    model: '',
    inject_memory: true,
    inject_rag: true,
    ingest_on_chat: true,
    is_default: false,
    enabled: true,
    balancer_id: '',
    execution: 'sync',
    queue_name: '',
  });
  const [formTab, setFormTab] = useState('endpoint');
  const [backend, setBackend] = useState('vllm');
  const [ragNames, setRagNames] = useState([]);
  const [memoryNames, setMemoryNames] = useState([]);
  const [rags, setRags] = useState([]);
  const [memories, setMemories] = useState([]);
  const [llms, setLlms] = useState([]);
  const [loraNames, setLoraNames] = useState([]);
  const [adapters, setAdapters] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [chatInput, setChatInput] = useState('What do you know?');
  const [chatOut, setChatOut] = useState('');
  const [chatting, setChatting] = useState(false);
  const [chatModels, setChatModels] = useState([]);
  const [modelsUnreachable, setModelsUnreachable] = useState(false);
  const [showAddModel, setShowAddModel] = useState(false);
  const [addModel, setAddModel] = useState('');
  const [addingModel, setAddingModel] = useState(false);
  const [applyNote, setApplyNote] = useState('');

  const loadLists = useCallback(async () => {
    if (!projectId) return;
    try {
      const [providers, rag, mem, lora] = await Promise.all([
        aiManagerService.listIntegrations(projectId, 'llm'),
        aiManagerService.listRag(projectId),
        aiManagerService.listMemoryStores(projectId).catch(() => []),
        aiManagerService.listLora(projectId).catch(() => []),
      ]);
      setLlms(providers);
      setRags(rag);
      setMemories(mem);
      setAdapters(lora);
    } catch (_) { /* ignore */ }
  }, [projectId]);

  const load = useCallback(async () => {
    if (!isEdit || !projectId) { setFetching(false); return; }
    try {
      const p = await aiManagerService.getIntelligence(projectId, intelligenceId);
      setForm({
        name: p.name || '',
        description: p.description || '',
        llm_integration: p.llm_integration || '',
        model: p.model || '',
        inject_memory: p.inject_memory !== false,
        inject_rag: p.inject_rag !== false,
        ingest_on_chat: p.ingest_on_chat !== false,
        is_default: p.is_default === 'true' || p.is_default === true,
        enabled: p.enabled !== 'false',
        balancer_id: p.balancer_id || '',
        execution: p.execution || 'sync',
        queue_name: p.queue_name || '',
      });
      setRagNames((p.rag || []).map((x) => x.name || x).filter(Boolean));
      setMemoryNames((p.memory || []).map((x) => x.name || x).filter(Boolean));
      setLoraNames((p.lora || []).map((x) => x.name || x).filter(Boolean));
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error?.message || err.message);
    } finally {
      setFetching(false);
    }
  }, [isEdit, projectId, intelligenceId]);

  useEffect(() => { loadLists(); }, [loadLists]);
  useEffect(() => { load(); }, [load]);

  const enabledLlms = useMemo(
    () => (llms || []).filter((l) => isEnabled(l) && !isSmoke(l)).sort(preferredSort),
    [llms],
  );
  const backendLlms = useMemo(
    () => enabledLlms.filter((l) => providerKind(l) === backend),
    [enabledLlms, backend],
  );
  const selectedLlm = useMemo(
    () => llms.find((l) => l.name === form.llm_integration) || null,
    [llms, form.llm_integration],
  );

  useEffect(() => {
    if (!form.llm_integration || !selectedLlm) return;
    const kind = providerKind(selectedLlm);
    if (kind !== backend) setBackend(kind);
  }, [form.llm_integration, selectedLlm, backend]);

  useEffect(() => {
    if (!projectId || !form.llm_integration) {
      setChatModels([]);
      setModelsUnreachable(false);
      return undefined;
    }
    let cancelled = false;
    aiManagerService.listModels({ projectId, integration: form.llm_integration })
      .then((list) => {
        if (cancelled) return;
        setModelsUnreachable(false);
        setChatModels(list || []);
        const names = (list || []).map((m) => m.name).filter(Boolean);
        setForm((prev) => {
          if (prev.model && names.includes(prev.model)) return prev;
          const next = names[0] || selectedLlm?.model || prev.model || '';
          if (next === prev.model) return prev;
          return { ...prev, model: next };
        });
      })
      .catch(() => {
        if (cancelled) return;
        setChatModels([]);
        setModelsUnreachable(true);
      });
    return () => { cancelled = true; };
  }, [projectId, form.llm_integration, selectedLlm?.model]);

  const boundSubtitle = [
    form.llm_integration || 'unbound',
    form.model || selectedLlm?.model,
  ].filter(Boolean).join(' · ');

  const toggle = (list, setList, name) => {
    setList((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  };

  const switchBackend = (next) => {
    setBackend(next);
    setForm((p) => {
      const keep = enabledLlms.find((l) => l.name === p.llm_integration && providerKind(l) === next);
      return { ...p, llm_integration: keep ? keep.name : '', model: keep ? p.model : '' };
    });
    setChatModels([]);
    setShowAddModel(false);
    setApplyNote('');
  };

  const handleAddModel = async () => {
    const id = addModel.trim();
    if (!id || !projectId || !form.llm_integration) return;
    setAddingModel(true);
    setApplyNote('');
    try {
      if (backend === 'vllm') {
        setForm((p) => ({ ...p, model: id }));
        setShowAddModel(false);
        setApplyNote('Save will load this Hugging Face id on vLLM (GPU restart, minutes). Exit 1/137 leaves it stopped.');
      } else {
        await aiManagerService.pullModel(id, { projectId, integration: form.llm_integration });
        setForm((p) => ({ ...p, model: id }));
        const list = await aiManagerService.listModels({ projectId, integration: form.llm_integration }).catch(() => []);
        setChatModels(list || []);
        setShowAddModel(false);
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error?.message || err.message);
    } finally {
      setAddingModel(false);
    }
  };

  const handleSubmit = async () => {
    if (!projectId) return;
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    setErrors(e);
    if (Object.keys(e).length) return;
    setLoading(true);
    setApplyNote('');
    try {
      const model = String(form.model || '').trim();
      if (backend === 'ollama' && model && form.llm_integration) {
        const names = chatModels.map((m) => m.name);
        if (names.length && !names.includes(model)) {
          await aiManagerService.pullModel(model, { projectId, integration: form.llm_integration });
        }
      }
      const data = {
        ...form,
        name: form.name.trim().toLowerCase(),
        model,
        rag: ragNames,
        memory: memoryNames,
        lora: loraNames,
      };
      if (isEdit) await aiManagerService.updateIntelligence(projectId, intelligenceId, data);
      else await aiManagerService.createIntelligence(projectId, data);

      if (selectedLlm?.id && model) {
        const prev = String(selectedLlm.model || '').trim();
        await aiManagerService.updateIntegration(projectId, selectedLlm.id, { model }).catch(() => {});
        if (backend === 'vllm' && model && model !== prev) {
          const applied = await aiManagerService.applyVllm(projectId, selectedLlm.id, { model });
          if (applied?.left_stopped || applied?.ok === false) {
            setApplyNote(applied.message || 'vLLM apply failed');
            return;
          }
        }
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete intelligence endpoint', `Delete "${form.name}"? Apps using this ARN will break.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await aiManagerService.deleteIntelligence(projectId, intelligenceId);
            navigation.goBack();
          } catch (err) {
            Alert.alert('Error', err.response?.data?.error?.message || err.message);
          }
        },
      },
    ]);
  };

  const handleChat = async () => {
    if (!isEdit) return;
    setChatting(true);
    setChatOut('');
    try {
      const res = await aiManagerService.intelligenceChat(projectId, {
        intelligence: form.name,
        user_id: 'console',
        session_id: 'console',
        messages: [{ role: 'user', content: chatInput }],
      });
      if (res?.queued && res.job?.id) {
        setChatOut(`job ${res.job.id} ${res.job.status}`);
        let snap = res.job;
        for (let i = 0; i < 90; i += 1) {
          await new Promise((r) => setTimeout(r, 2000));
          snap = await aiManagerService.getIntelligenceJob(projectId, res.job.id);
          setChatOut(snap.partial || snap.error || snap.status);
          if (['succeeded', 'failed', 'cancelled'].includes(snap.status)) break;
        }
        setChatOut(snap.result?.message?.content || snap.partial || snap.error || JSON.stringify(snap));
      } else {
        setChatOut(res?.message?.content || res?.response || JSON.stringify(res));
      }
    } catch (err) {
      setChatOut(err.response?.data?.error?.message || err.message);
    } finally {
      setChatting(false);
    }
  };

  const loraOnVllm = backend === 'vllm' && loraNames.length > 0;
  const attachedRags = rags.filter((c) => ragNames.includes(c.name));
  const unattachedRags = rags.filter((c) => !ragNames.includes(c.name));
  const attachedMem = memories.filter((m) => memoryNames.includes(m.name));
  const unattachedMem = memories.filter((m) => !memoryNames.includes(m.name));
  const attachedLora = adapters.filter((a) => loraNames.includes(a.name) || loraNames.includes(a.id));
  const unattachedLora = adapters.filter((a) => !loraNames.includes(a.name) && !loraNames.includes(a.id));

  if (fetching) {
    return (
      <View style={[S.container, S.center]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={S.container} contentContainerStyle={S.content}>
      <Text style={S.title}>{isEdit ? 'Edit intelligence endpoint' : 'Create intelligence endpoint'}</Text>
      <Text style={S.subtitle}>
        Stable URL for apps. Cloud binds the LLM route and model. Apps keep calling the same ARN.
      </Text>
      <Text style={[S.help, { marginBottom: 8 }]}>{boundSubtitle}</Text>
      <ScreenTabs
        tabs={[
          { id: 'endpoint', label: 'Endpoint' },
          { id: 'attachments', label: 'Attachments' },
          { id: 'queue', label: 'Queue' },
          { id: 'chat', label: 'Try chat' },
        ]}
        active={formTab}
        onChange={setFormTab}
      />

      {formTab === 'endpoint' ? <>
      <Box title="Endpoint">
        <View style={S.field}>
          <Text style={S.label}>Name *</Text>
          <TextInput
            style={[S.input, errors.name && S.inputError]}
            value={form.name}
            onChangeText={(v) => setForm((p) => ({ ...p, name: v }))}
            placeholder="icarus-assistant"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
          />
          {errors.name ? <Text style={S.errorText}>{errors.name}</Text> : null}
          <Text style={S.help}>Apps invoke arn:…:ai:intelligence:endpoint/{form.name || 'name'}</Text>
        </View>
        <View style={S.field}>
          <Text style={S.label}>Description</Text>
          <TextInput
            style={S.input}
            value={form.description}
            onChangeText={(v) => setForm((p) => ({ ...p, description: v }))}
            placeholder="Icarus coach"
            placeholderTextColor={colors.textMuted}
          />
        </View>
        <View style={S.switchRow}>
          <Text style={S.label}>Default intelligence endpoint</Text>
          <Switch value={form.is_default} onValueChange={(v) => setForm((p) => ({ ...p, is_default: v }))} />
        </View>
        <View style={S.switchRow}>
          <Text style={S.label}>Enabled</Text>
          <Switch value={form.enabled} onValueChange={(v) => setForm((p) => ({ ...p, enabled: v }))} />
        </View>
      </Box>

      <Box title="LLM">
        <Text style={S.help}>Changing backend or model does not change the app ARN.</Text>
        <View style={[S.chips, { marginTop: 8 }]}>
          <Button title="vLLM" variant={backend === 'vllm' ? 'primary' : 'secondary'} onPress={() => switchBackend('vllm')} style={S.chip} />
          <Button title="Ollama" variant={backend === 'ollama' ? 'primary' : 'secondary'} onPress={() => switchBackend('ollama')} style={S.chip} />
        </View>
        <View style={[S.field, { marginTop: 12 }]}>
          <Text style={S.label}>Attach LLM route</Text>
          {backendLlms.length === 0 ? (
            <>
              <Text style={S.help}>No {backend === 'vllm' ? 'vLLM' : 'Ollama'} route yet.</Text>
              <Button
                title={`Create ${backend === 'vllm' ? 'vLLM' : 'Ollama'} endpoint`}
                variant="secondary"
                onPress={() => navigation.navigate('aiProviderForm', { capability: 'llm', provider: backend })}
                style={{ marginTop: 8, alignSelf: 'flex-start' }}
              />
            </>
          ) : (
            <RouteSelect
              items={backendLlms}
              value={form.llm_integration}
              onChange={(name) => setForm((p) => ({ ...p, llm_integration: name, model: '' }))}
              placeholder="Select route"
            />
          )}
        </View>
        {form.llm_integration ? (
          <View style={S.field}>
            <Text style={S.label}>Bound model</Text>
            <ModelSelect
              models={chatModels}
              value={form.model}
              onChange={(v) => setForm((p) => ({ ...p, model: v }))}
              placeholder={backend === 'vllm' ? 'Served Hugging Face id' : 'Pulled Ollama tag'}
            />
            {backend === 'ollama' && modelsUnreachable ? (
              <Text style={S.warn}>Ollama unreachable. Pull is disabled until the host daemon is up. Do not auto-start it here.</Text>
            ) : null}
            {backend === 'vllm' ? (
              <Text style={S.help}>
                GPU serves one model. Save apply restarts aerekos-vllm (minutes). Exit 1/137 leaves it stopped. All intelligence on this route see the new id.
              </Text>
            ) : null}
            <Button
              title={showAddModel ? 'Hide add / load' : (backend === 'vllm' ? 'Load Hugging Face id' : 'Add model (pull tag)')}
              variant="secondary"
              onPress={() => setShowAddModel((v) => !v)}
              disabled={backend === 'ollama' && modelsUnreachable}
              style={{ marginTop: 8, alignSelf: 'flex-start' }}
            />
            {showAddModel ? (
              <View style={{ marginTop: 8 }}>
                <TextInput
                  style={S.input}
                  value={addModel}
                  onChangeText={setAddModel}
                  placeholder={backend === 'vllm' ? 'org/model-id' : 'llama3.2:3b'}
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                />
                <Button
                  title={backend === 'vllm' ? 'Use this id' : 'Pull'}
                  onPress={handleAddModel}
                  loading={addingModel}
                  disabled={!addModel.trim() || (backend === 'ollama' && modelsUnreachable)}
                  style={{ marginTop: 8, alignSelf: 'flex-start' }}
                />
              </View>
            ) : null}
          </View>
        ) : null}
        {applyNote ? <Text style={S.warn}>{applyNote}</Text> : null}
      </Box>
      </> : null}

      {formTab === 'attachments' ? <>
      <Box title="Attached">
        <Text style={S.help}>Every bound object opens its own details screen.</Text>
        {selectedLlm ? (
          <AttachedRow
            title={selectedLlm.name}
            subtitle={`LLM · ${selectedLlm.provider || backend}`}
            onPress={() => navigation.navigate('aiProviderForm', { providerId: selectedLlm.id })}
          />
        ) : null}
        {form.model ? (
          <AttachedRow
            title={form.model}
            subtitle="Bound model"
            onPress={() => navigation.navigate('aiModelDetails', { modelName: form.model })}
          />
        ) : null}
        {attachedRags.map((c) => (
          <AttachedRow
            key={c.id}
            title={c.name}
            subtitle="RAG"
            onPress={() => navigation.navigate('aiRagForm', { ragId: c.id })}
          />
        ))}
        {attachedMem.map((m) => (
          <AttachedRow
            key={m.id || m.name}
            title={m.name}
            subtitle={`Memory · ${m.status || 'draft'}`}
            onPress={() => m.id && navigation.navigate('aiMemoryForm', { memoryId: m.id })}
          />
        ))}
        {attachedLora.map((a) => (
          <AttachedRow
            key={a.id}
            title={a.name}
            subtitle={`LoRA · ${a.status || ''}`}
            onPress={() => navigation.navigate('aiLoraForm', { loraId: a.id })}
          />
        ))}
        {form.balancer_id ? (
          <AttachedRow
            title={form.balancer_id}
            subtitle="Load balancer"
            onPress={() => navigation.navigate('aiBalancerDetails', { balancerId: form.balancer_id })}
          />
        ) : null}
        {!selectedLlm && !form.model && !attachedRags.length && !attachedMem.length && !attachedLora.length && !form.balancer_id ? (
          <Text style={S.help}>Nothing attached yet.</Text>
        ) : null}
      </Box>

      <Box title="LoRA adapters">
        <Text style={S.help}>Ollama-only. One adapter per intelligence. The base tag is never overwritten.</Text>
        {loraOnVllm ? (
          <Text style={S.warn}>LoRA is Ollama-only and will be skipped on vLLM chat. It stays attached.</Text>
        ) : null}
        {attachedLora.map((a) => (
          <AttachedRow
            key={`on-${a.id}`}
            title={a.name}
            subtitle="Attached — open details or detach"
            onPress={() => navigation.navigate('aiLoraForm', { loraId: a.id })}
          />
        ))}
        <View style={[S.chips, { marginTop: 8 }]}>
          {unattachedLora.length === 0 && attachedLora.length === 0 ? (
            <Text style={S.help}>No adapters yet.</Text>
          ) : unattachedLora.map((a) => (
            <Button
              key={a.id}
              title={a.name}
              variant="secondary"
              onPress={() => setLoraNames((prev) => (prev.includes(a.name) ? prev : [a.name]))}
              style={S.chip}
            />
          ))}
        </View>
        {attachedLora.length ? (
          <Button title="Detach LoRA" variant="secondary" onPress={() => setLoraNames([])} style={{ marginTop: 8, alignSelf: 'flex-start' }} />
        ) : null}
        <Button
          title="Train adapter"
          variant="secondary"
          onPress={() => navigation.navigate('aiLoraForm', {})}
          style={{ marginTop: 8, alignSelf: 'flex-start' }}
        />
      </Box>

      <Box title="RAG collections">
        <Text style={S.help}>One collection can attach to many intelligence endpoints.</Text>
        {unattachedRags.length === 0 && attachedRags.length === 0 ? <Text style={S.help}>No RAG collections yet.</Text> : null}
        <View style={[S.chips, { marginTop: 8 }]}>
          {unattachedRags.map((c) => (
            <Button key={c.id} title={c.name} variant="secondary" onPress={() => toggle(ragNames, setRagNames, c.name)} style={S.chip} />
          ))}
        </View>
        {attachedRags.map((c) => (
          <Button
            key={`off-${c.id}`}
            title={`Detach ${c.name}`}
            variant="secondary"
            onPress={() => toggle(ragNames, setRagNames, c.name)}
            style={{ marginTop: 8, alignSelf: 'flex-start' }}
          />
        ))}
        <Button
          title="Create RAG collection"
          variant="secondary"
          onPress={() => navigation.navigate('aiRagForm', {})}
          style={{ marginTop: 8, alignSelf: 'flex-start' }}
        />
        <View style={S.switchRow}>
          <Text style={S.label}>Inject RAG on chat</Text>
          <Switch value={form.inject_rag} onValueChange={(v) => setForm((p) => ({ ...p, inject_rag: v }))} />
        </View>
      </Box>

      <Box title="Memory stores">
        <Text style={S.help}>Conversational memory. Same store can attach to multiple intelligence endpoints.</Text>
        {unattachedMem.length === 0 && attachedMem.length === 0 ? <Text style={S.help}>No named memory stores yet.</Text> : null}
        <View style={[S.chips, { marginTop: 8 }]}>
          {unattachedMem.map((m) => (
            <Button
              key={m.id || m.name}
              title={`${m.name}${m.status ? ` · ${m.status}` : ''}`}
              variant="secondary"
              onPress={() => toggle(memoryNames, setMemoryNames, m.name)}
              style={S.chip}
            />
          ))}
        </View>
        {attachedMem.map((m) => (
          <Button
            key={`off-${m.id || m.name}`}
            title={`Detach ${m.name}`}
            variant="secondary"
            onPress={() => toggle(memoryNames, setMemoryNames, m.name)}
            style={{ marginTop: 8, alignSelf: 'flex-start' }}
          />
        ))}
        <Button
          title="Create memory store"
          variant="secondary"
          onPress={() => navigation.navigate('aiMemoryForm', {})}
          style={{ marginTop: 8, alignSelf: 'flex-start' }}
        />
        <View style={S.switchRow}>
          <Text style={S.label}>Inject memory on chat</Text>
          <Switch value={form.inject_memory} onValueChange={(v) => setForm((p) => ({ ...p, inject_memory: v }))} />
        </View>
        <View style={S.switchRow}>
          <Text style={S.label}>Ingest chat into memory</Text>
          <Switch value={form.ingest_on_chat} onValueChange={(v) => setForm((p) => ({ ...p, ingest_on_chat: v }))} />
        </View>
      </Box>
      </> : null}

      {formTab === 'queue' ? (
        <Box title="Queue">
          <Text style={S.help}>Queued endpoints reject sync POST /chat (409). Apps submit a job and poll.</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginVertical: 8 }}>
            <Button title="Sync" variant={form.execution === 'sync' ? 'primary' : 'secondary'} onPress={() => setForm((p) => ({ ...p, execution: 'sync' }))} />
            <Button title="Queued (RabbitMQ)" variant={form.execution === 'queued' ? 'primary' : 'secondary'} onPress={() => setForm((p) => ({ ...p, execution: 'queued', queue_name: p.queue_name || `${p.name || 'endpoint'}-inbox` }))} />
          </View>
          <Text style={S.label}>Inbox queue</Text>
          <TextInput
            style={S.input}
            value={form.queue_name}
            onChangeText={(v) => setForm((p) => ({ ...p, queue_name: v }))}
            placeholder={`${form.name || 'endpoint'}-inbox`}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
          />
        </Box>
      ) : null}

      {formTab === 'chat' && isEdit ? (
        <Box title="Try chat">
          <Text style={S.help}>Uses the saved Cloud-bound model. Does not send a model override.</Text>
          <TextInput
            style={[S.input, S.multiline, { marginTop: 8 }]}
            value={chatInput}
            onChangeText={setChatInput}
            placeholder="Ask using this intelligence endpoint"
            placeholderTextColor={colors.textMuted}
            multiline
          />
          <Button title="Chat" onPress={handleChat} loading={chatting} style={{ marginTop: 8 }} />
          {chatOut ? <Text style={[S.help, { marginTop: 8 }]}>{chatOut}</Text> : null}
        </Box>
      ) : null}

      {formTab === 'chat' && isEdit ? (
        <Box title="Load balancer">
          <Text style={S.help}>One click attaches a target group. Chat origin stays the same pretty URL.</Text>
          {form.balancer_id ? (
            <AttachedRow
              title={form.balancer_id}
              subtitle="Open balancer"
              onPress={() => navigation.navigate('aiBalancerDetails', { balancerId: form.balancer_id })}
            />
          ) : (
            <Button
              title="Add load balancer"
              onPress={async () => {
                try {
                  const item = await aiManagerService.attachBalancer(projectId, intelligenceId, {});
                  setForm((p) => ({ ...p, balancer_id: item?.balancer_id }));
                  Alert.alert('Load balancer', item?.balancer_id ? 'Attached' : 'Requested');
                } catch (err) {
                  Alert.alert('Error', err.response?.data?.error?.message || err.message);
                }
              }}
              style={{ marginTop: 8 }}
            />
          )}
        </Box>
      ) : null}

      <View style={S.buttons}>
        <Button title={isEdit ? 'Save changes' : 'Create endpoint'} onPress={handleSubmit} loading={loading} />
        {isEdit ? <Button title="Delete endpoint" onPress={handleDelete} variant="danger" style={S.cancel} /> : null}
        <Button title="Cancel" onPress={() => navigation.goBack()} variant="secondary" style={S.cancel} />
      </View>
    </ScrollView>
  );
};
