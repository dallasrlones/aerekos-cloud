import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, Alert, ActivityIndicator, Switch } from 'react-native';
import { Box } from '../../components/Box/Box';
import { Button } from '../../components/Button/Button';
import { aiManagerService } from '../../services/aiManagerService';
import { useProject } from '../../contexts/ProjectContext';
import { colors } from '../../styles/theme';
import { AiProviderFormStyles as S } from './AiProviderForm.styles';

export const IntelligenceForm = ({ navigation, route }) => {
  const intelligenceId = route?.params?.intelligenceId;
  const isEdit = !!intelligenceId;
  const { currentProject } = useProject();
  const projectId = currentProject?.id;

  const [form, setForm] = useState({
    name: '',
    description: '',
    llm_integration: '',
    inject_memory: true,
    inject_rag: true,
    ingest_on_chat: true,
    is_default: false,
    enabled: true,
    balancer_id: '',
  });
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
  const [chatModel, setChatModel] = useState('llama3.2:3b');
  const [chatOut, setChatOut] = useState('');
  const [chatting, setChatting] = useState(false);

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
        inject_memory: p.inject_memory !== false,
        inject_rag: p.inject_rag !== false,
        ingest_on_chat: p.ingest_on_chat !== false,
        is_default: p.is_default === 'true' || p.is_default === true,
        enabled: p.enabled !== 'false',
        balancer_id: p.balancer_id || '',
      });
      setRagNames((p.rag || []).map((x) => x.name || x).filter(Boolean));
      setMemoryNames((p.memory || []).map((x) => x.name || x).filter(Boolean));
      setLoraNames((p.lora || []).map((x) => x.name || x).filter(Boolean));
      const llm = llms.find((l) => l.name === form.llm_integration);
      if (llm?.model) setChatModel(llm.model);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error?.message || err.message);
    } finally {
      setFetching(false);
    }
  }, [isEdit, projectId, intelligenceId]);

  useEffect(() => { loadLists(); }, [loadLists]);
  useEffect(() => { load(); }, [load]);

  const toggle = (list, setList, name) => {
    setList((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  };

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
        rag: ragNames,
        memory: memoryNames,
        lora: loraNames,
      };
      if (isEdit) await aiManagerService.updateIntelligence(projectId, intelligenceId, data);
      else await aiManagerService.createIntelligence(projectId, data);
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
        model: chatModel || undefined,
        user_id: 'console',
        session_id: 'console',
        messages: [{ role: 'user', content: chatInput }],
      });
      setChatOut(res?.message?.content || res?.response || JSON.stringify(res));
    } catch (err) {
      setChatOut(err.response?.data?.error?.message || err.message);
    } finally {
      setChatting(false);
    }
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
      <Text style={S.title}>{isEdit ? 'Edit intelligence endpoint' : 'Create intelligence endpoint'}</Text>
      <Text style={S.subtitle}>
        Stable URL for apps. Swap the LLM, attach RAG collections, or attach memory stores without changing the ARN.
      </Text>

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

      <Box title="LLM (hot-swappable)">
        <Text style={S.help}>Changing this does not change the app ARN. Create an Ollama or vLLM endpoint first if the list is empty.</Text>
        <View style={[S.chips, { marginTop: 8 }]}>
          <Button
            title="None"
            variant={!form.llm_integration ? 'primary' : 'secondary'}
            onPress={() => setForm((p) => ({ ...p, llm_integration: '' }))}
            style={S.chip}
          />
          {llms.map((l) => (
            <Button
              key={l.id}
              title={`${l.name} (${l.provider})`}
              variant={form.llm_integration === l.name ? 'primary' : 'secondary'}
              onPress={() => setForm((p) => ({ ...p, llm_integration: l.name }))}
              style={S.chip}
            />
          ))}
        </View>
        <Button
          title="Create LLM endpoint"
          variant="secondary"
          onPress={() => navigation.navigate('aiProviderForm', { capability: 'llm', provider: 'ollama' })}
          style={{ marginTop: 8, alignSelf: 'flex-start' }}
        />
      </Box>

      <Box title="LoRA adapters">
        <Text style={S.help}>One adapter per intelligence. Chat uses a derived Ollama model; the base tag is never overwritten.</Text>
        <View style={[S.chips, { marginTop: 8 }]}>
          {adapters.length === 0 ? <Text style={S.help}>No adapters yet — train one on the Fine-tunes tab.</Text> : adapters.map((a) => (
            <Button
              key={a.id}
              title={a.name}
              variant={loraNames.includes(a.name) || loraNames.includes(a.id) ? 'primary' : 'secondary'}
              onPress={() => {
                setLoraNames((prev) => (prev.includes(a.name) ? [] : [a.name]));
                if (intelligenceId) {
                  aiManagerService.attachIntelligence(projectId, intelligenceId, { kind: 'lora', target_name: a.name }).catch(() => {});
                }
              }}
              style={S.chip}
            />
          ))}
        </View>
      </Box>

      <Box title="RAG collections (many-to-many)">
        <Text style={S.help}>One collection can attach to many intelligence endpoints. Retrieved chunks are injected on chat.</Text>
        <View style={[S.chips, { marginTop: 8 }]}>
          {rags.length === 0 ? <Text style={S.help}>No RAG collections yet.</Text> : rags.map((c) => (
            <Button
              key={c.id}
              title={c.name}
              variant={ragNames.includes(c.name) ? 'primary' : 'secondary'}
              onPress={() => toggle(ragNames, setRagNames, c.name)}
              style={S.chip}
            />
          ))}
        </View>
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
        <View style={[S.chips, { marginTop: 8 }]}>
          {memories.length === 0 ? <Text style={S.help}>No named memory stores yet.</Text> : memories.map((m) => (
            <Button
              key={m.id || m.name}
              title={`${m.name}${m.status ? ` · ${m.status}` : ''}`}
              variant={memoryNames.includes(m.name) ? 'primary' : 'secondary'}
              onPress={() => toggle(memoryNames, setMemoryNames, m.name)}
              style={S.chip}
            />
          ))}
        </View>
        <View style={S.switchRow}>
          <Text style={S.label}>Inject memory on chat</Text>
          <Switch value={form.inject_memory} onValueChange={(v) => setForm((p) => ({ ...p, inject_memory: v }))} />
        </View>
        <View style={S.switchRow}>
          <Text style={S.label}>Ingest chat into memory</Text>
          <Switch value={form.ingest_on_chat} onValueChange={(v) => setForm((p) => ({ ...p, ingest_on_chat: v }))} />
        </View>
      </Box>

      {isEdit ? (
        <Box title="Try chat">
          <TextInput
            style={S.input}
            value={chatModel}
            onChangeText={setChatModel}
            placeholder="Model (uses bound LLM default if empty)"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
          />
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

      {isEdit ? (
        <Box title="Load balancer">
          <Text style={S.help}>One click attaches a target group. Chat origin stays the same pretty URL.</Text>
          <Button
            title={form.balancer_id ? 'Balancer attached' : 'Add load balancer'}
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
