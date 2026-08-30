import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, RefreshControl, TouchableOpacity,
  ActivityIndicator, TextInput, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Box } from '../../components/Box/Box';
import { Button } from '../../components/Button/Button';
import { ConsoleGuide } from '../../components/ConsoleGuide/ConsoleGuide';
import { ApiReference } from '../../components/ApiReference/ApiReference';
import { ConfigTable } from '../../components/ConfigTable/ConfigTable';
import { ActionBar } from '../../components/ActionBar/ActionBar';
import { aiManagerService } from '../../services/aiManagerService';
import { managerService } from '../../services/managerService';
import { AppAccessPanel } from '../../components/AppAccessPanel';
import { getApiBaseUrl } from '../../utils/api';
import { getAppAccessConfig, buildPrettyUrl } from '../../services/appAccessConfig';
import { useProject } from '../../contexts/ProjectContext';
import { colors, spacing } from '../../styles/theme';
import { AIManagerStyles as S } from './AIManager.styles';
import { ResourceCrud } from '../../components/ResourceCrud';
import { stackService } from '../../services/stackService';
import { ManagerSetupSection } from '../../components/ManagerSetupSection';
import { AI_GUIDES, API_EXAMPLES } from './guides';

function formatBytes(n) {
  if (!n || n <= 0) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0; let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
}

function modelCapabilities(model) {
  if (Array.isArray(model?.capabilities) && model.capabilities.length) return model.capabilities;
  if (model?.details?.family === 'nomic-bert') return ['embedding'];
  return ['completion'];
}

function isChatModel(model) {
  const caps = modelCapabilities(model);
  return caps.some((c) => ['completion', 'tools', 'thinking', 'vision'].includes(c));
}

function isEmbedModel(model) {
  return modelCapabilities(model).includes('embedding');
}

function modelMetaLine(model) {
  const d = model.details || {};
  const parts = [
    d.parameter_size,
    d.quantization_level,
    d.context_length ? `${Math.round(d.context_length / 1024)}k ctx` : null,
  ].filter(Boolean);
  return parts.join(' · ') || formatBytes(model.size);
}

const WebAudio = ({ src }) => {
  if (Platform.OS !== 'web' || !src) return null;
  return React.createElement('audio', { src, controls: true, style: { width: '100%', marginTop: 8 } });
};

const TABS = [
  { id: 'overview', label: 'Overview', icon: 'grid-outline' },
  { id: 'endpoints', label: 'Endpoints', icon: 'link-outline' },
  { id: 'intelligence', label: 'Intelligence', icon: 'sparkles-outline' },
  { id: 'appaccess', label: 'App access', icon: 'key-outline' },
  { id: 'llm', label: 'LLM', icon: 'chatbubbles-outline' },
  { id: 'benchmarks', label: 'Benchmarks', icon: 'speedometer-outline' },
  { id: 'tts', label: 'TTS', icon: 'volume-high-outline' },
  { id: 'stt', label: 'STT', icon: 'mic-outline' },
  { id: 'embeddings', label: 'Embeddings', icon: 'layers-outline' },
  { id: 'finetunes', label: 'Fine-tunes', icon: 'color-wand-outline' },
];

const CONFIG_NOTE = 'Host defaults come from docker-compose.ai.yml on the GPU worker. Endpoints override per project — Ollama, vLLM, dictionary TTS, Kokoro, XTTS, faster-whisper.';

const AI_ACCESS = getAppAccessConfig('ai_manager');

function copyToClipboard(text, onDone) {
  if (Platform.OS === 'web' && navigator?.clipboard) {
    navigator.clipboard.writeText(text);
    onDone?.();
    return;
  }
  Alert.alert('Copied', 'Copied to clipboard');
  onDone?.();
}

function parseOpts(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch (_) { return {}; }
}

const EMPTY_PICKS = { llm: null, tts: null, stt: null, embeddings: null };

export const AIManager = ({ navigation }) => {
  const { currentProject, loading: projectsLoading } = useProject();
  const projectId = currentProject?.id;

  const [tab, setTab] = useState('overview');
  const [integrations, setIntegrations] = useState([]);
  const [loadingIntegrations, setLoadingIntegrations] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [integrationPick, setIntegrationPick] = useState(EMPTY_PICKS);
  const integrationRoute = useCallback((cap) => ({
    projectId,
    integration: integrationPick[cap] || undefined,
  }), [projectId, integrationPick]);
  const [llmSub, setLlmSub] = useState('models');
  const [ttsSub, setTtsSub] = useState('synthesize');
  const [status, setStatus] = useState(null);
  const [ttsStatus, setTtsStatus] = useState(null);
  const [sttStatus, setSttStatus] = useState(null);
  const [embedStatus, setEmbedStatus] = useState(null);
  const [loraAdapters, setLoraAdapters] = useState([]);
  const [loraName, setLoraName] = useState('coach');
  const [loraIntelName, setLoraIntelName] = useState('');
  const [loraBusy, setLoraBusy] = useState(false);
  const [cacheStats, setCacheStats] = useState(null);
  const [models, setModels] = useState([]);
  const [voices, setVoices] = useState([]);
  const [pulls, setPulls] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [error, setError] = useState(null);

  const [pullName, setPullName] = useState('');
  const [pulling, setPulling] = useState(false);

  const [selectedModel, setSelectedModel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);

  const [genPrompt, setGenPrompt] = useState('Summarize Aerekos Cloud in one sentence.');
  const [genResult, setGenResult] = useState('');
  const [genLoading, setGenLoading] = useState(false);

  const [ttsText, setTtsText] = useState('Hello from Aerekos AI.');
  const [ttsVoice, setTtsVoice] = useState('');
  const [ttsLanguage, setTtsLanguage] = useState('en');
  const [ttsSpeed, setTtsSpeed] = useState('1');
  const [ttsAudioUrl, setTtsAudioUrl] = useState(null);
  const [ttsLoading, setTtsLoading] = useState(false);

  const [sttLanguage, setSttLanguage] = useState('');
  const [sttTask, setSttTask] = useState('transcribe');
  const [sttResult, setSttResult] = useState(null);
  const [sttLoading, setSttLoading] = useState(false);
  const [sttFileName, setSttFileName] = useState('');

  const [embedInput, setEmbedInput] = useState('Aerekos cloud inference');
  const [embedModel, setEmbedModel] = useState('');
  const [embedResult, setEmbedResult] = useState(null);
  const [embedLoading, setEmbedLoading] = useState(false);

  const [copiedId, setCopiedId] = useState(null);
  const [llmHealth, setLlmHealth] = useState({});

  const [benchData, setBenchData] = useState(null);
  const [benchLoading, setBenchLoading] = useState(false);
  const [benchRunning, setBenchRunning] = useState(false);
  const [memoryStatus, setMemoryStatus] = useState(null);
  const [intelligence, setIntelligence] = useState([]);
  const [ragCollections, setRagCollections] = useState([]);
  const [memoryStores, setMemoryStores] = useState([]);
  const [memoryStoreName, setMemoryStoreName] = useState('');
  const [creatingMemory, setCreatingMemory] = useState(false);
  const [serviceInfo, setServiceInfo] = useState(null);
  const [instances, setInstances] = useState([]);

  const pollRef = useRef(null);
  const benchPollRef = useRef(null);
  const apiBase = getApiBaseUrl();

  const loadStatus = useCallback(async () => {
    try {
      const [llm, tts, stt, emb, cache] = await Promise.all([
        aiManagerService.llmStatus({ projectId }),
        aiManagerService.ttsStatus({ projectId }).catch(() => null),
        aiManagerService.sttStatus({ projectId }).catch(() => null),
        aiManagerService.embedStatus({ projectId }).catch(() => null),
        aiManagerService.ttsCacheStats({ projectId }).catch(() => null),
      ]);
      setStatus(llm);
      setTtsStatus(tts);
      setSttStatus(stt);
      setEmbedStatus(emb);
      setCacheStats(cache);
      if (tts?.voice && !ttsVoice) setTtsVoice(tts.voice);
      if (emb?.default_model && !embedModel) setEmbedModel(emb.default_model);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load status');
    }
  }, [ttsVoice, embedModel, projectId]);

  const loadModels = useCallback(async () => {
    setLoadingModels(true);
    try {
      const list = await aiManagerService.listModels({
        projectId,
        integration: integrationPick.llm || undefined,
      });
      setModels(list);
      setSelectedModel((cur) => (cur && list.some((m) => m.name === cur) ? cur : (list[0] && list[0].name) || null));
    } catch (_) { setModels([]); }
    finally { setLoadingModels(false); }
  }, [projectId, integrationPick.llm]);

  const loadVoices = useCallback(async () => {
    try {
      const v = await aiManagerService.listVoices({
        projectId,
        integration: integrationPick.tts || undefined,
      });
      setVoices(Array.isArray(v) ? v : []);
    } catch (_) { setVoices([]); }
  }, [projectId, integrationPick.tts]);

  const loadPulls = useCallback(async () => {
    try { setPulls(await aiManagerService.listPulls({ projectId })); } catch (_) {}
  }, [projectId]);

  const loadBenchmarks = useCallback(async () => {
    setBenchLoading(true);
    try {
      const data = await aiManagerService.listBenchmarks(integrationRoute('llm'));
      setBenchData(data);
      setBenchRunning(data?.run?.status === 'running');
      setError(null);
    } catch (err) {
      setBenchData(null);
      setError(err.response?.data?.error?.message || err.message || 'Failed to load benchmarks');
    } finally { setBenchLoading(false); }
  }, [integrationRoute]);

  const loadIntegrations = useCallback(async () => {
    if (!projectId) { setIntegrations([]); setIntegrationPick(EMPTY_PICKS); return; }
    setLoadingIntegrations(true);
    try {
      const items = await aiManagerService.listIntegrations(projectId);
      setIntegrations(items);
      const picks = { ...EMPTY_PICKS };
      ['llm', 'tts', 'stt', 'embeddings'].forEach((cap) => {
        const capItems = items.filter((i) => i.capability === cap && i.enabled !== 'false');
        const def = capItems.find((i) => i.is_default === 'true' || i.is_default === true);
        picks[cap] = def?.name || capItems[0]?.name || null;
      });
      setIntegrationPick((prev) => ({
        llm: prev.llm ?? picks.llm,
        tts: prev.tts ?? picks.tts,
        stt: prev.stt ?? picks.stt,
        embeddings: prev.embeddings ?? picks.embeddings,
      }));
    } catch (_) { setIntegrations([]); }
    finally { setLoadingIntegrations(false); }
  }, [projectId]);

  const loadMemoryStatus = useCallback(async () => {
    if (!projectId) { setMemoryStatus(null); return; }
    try {
      setMemoryStatus(await aiManagerService.memoryStatus(projectId));
    } catch (_) {
      setMemoryStatus({ configured: false, status: 'unconfigured' });
    }
  }, [projectId]);

  const loadIntelligence = useCallback(async () => {
    if (!projectId) { setIntelligence([]); setRagCollections([]); setMemoryStores([]); return; }
    try {
      const [intel, rag, mem] = await Promise.all([
        aiManagerService.listIntelligence(projectId),
        aiManagerService.listRag(projectId),
        aiManagerService.listMemoryStores(projectId).catch(() => []),
      ]);
      setIntelligence(intel);
      setRagCollections(rag);
      setMemoryStores(mem);
    } catch (_) {
      setIntelligence([]);
      setRagCollections([]);
      setMemoryStores([]);
    }
  }, [projectId]);

  const loadInstances = useCallback(async () => {
    try {
      const inst = projectId
        ? await managerService.listInstances('ai_manager', projectId)
        : await managerService.listInstances('ai_manager');
      setInstances(inst);
    } catch (_) {
      setInstances([]);
    }
  }, [projectId]);

  const loadServiceInfo = useCallback(async () => {
    try {
      setServiceInfo(await aiManagerService.info({ projectId }));
    } catch (_) {
      setServiceInfo(null);
    }
  }, [projectId]);

  const handleSeedLocal = async () => {
    if (!projectId) return;
    setSeeding(true);
    setError(null);
    try {
      await aiManagerService.seedLocalIntegrations(projectId);
      await stackService.record(projectId, { service: 'ai_manager', resource: { name: 'local', provider: 'ollama' } });
      await loadIntegrations();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to seed local integrations');
    } finally { setSeeding(false); }
  };

  const handleCreateMemoryStore = async () => {
    const name = memoryStoreName.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-') || 'default';
    if (!projectId) return;
    setCreatingMemory(true);
    setError(null);
    try {
      await aiManagerService.setupMemoryStore(projectId, {
        name,
        config: {
          name,
          data_worker_id: 'local',
          embeddings_integration: integrationPick.embeddings || '',
        },
      });
      setMemoryStoreName('');
      await loadIntelligence();
      await loadMemoryStatus();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to create memory store');
    } finally {
      setCreatingMemory(false);
    }
  };

  const openEndpointForm = (capability, provider) => {
    navigation.navigate('aiProviderForm', {
      ...(capability ? { capability } : {}),
      ...(provider ? { provider } : {}),
    });
  };

  useEffect(() => {
    if (!projectId) { setLlmHealth({}); return undefined; }
    const llms = integrations.filter((i) => i.capability === 'llm');
    if (!llms.length) { setLlmHealth({}); return undefined; }
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(llms.map(async (i) => {
        try {
          const s = await aiManagerService.llmStatus({ projectId, integration: i.name });
          return [i.name, s];
        } catch (e) {
          return [i.name, {
            reachable: false,
            error: e.response?.data?.error?.message || e.message,
            provider: i.provider,
          }];
        }
      }));
      if (!cancelled) setLlmHealth(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
  }, [projectId, integrations]);

  useEffect(() => {
    if (projectsLoading || !projectId) return undefined;
    loadStatus();
    loadModels();
    loadPulls();
    loadVoices();
    loadIntegrations();
    loadMemoryStatus();
    loadServiceInfo();
    loadInstances();
    loadIntelligence();
    return undefined;
  }, [projectsLoading, projectId, loadStatus, loadModels, loadPulls, loadVoices, loadIntegrations, loadMemoryStatus, loadServiceInfo, loadInstances, loadIntelligence]);

  useEffect(() => {
    if (tab === 'tts') loadVoices();
  }, [tab, integrationPick.tts, loadVoices]);

  useEffect(() => {
    const active = pulls.some((p) => p.status === 'pulling');
    if (active && !pollRef.current) {
      pollRef.current = setInterval(loadPulls, 1500);
    }
    if (!active && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
      loadModels();
    }
    return () => {};
  }, [pulls, loadPulls, loadModels]);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (benchPollRef.current) clearInterval(benchPollRef.current);
  }, []);

  useEffect(() => {
    if (tab === 'benchmarks') loadBenchmarks();
  }, [tab, integrationPick.llm, loadBenchmarks]);

  useEffect(() => {
    if (tab !== 'finetunes' || !projectId) return;
    aiManagerService.listLora(projectId).then(setLoraAdapters).catch(() => setLoraAdapters([]));
  }, [tab, projectId]);

  useEffect(() => {
    const active = benchRunning || benchData?.run?.status === 'running';
    if (tab === 'benchmarks' && active && !benchPollRef.current) {
      benchPollRef.current = setInterval(loadBenchmarks, 3000);
    }
    if ((!active || tab !== 'benchmarks') && benchPollRef.current) {
      clearInterval(benchPollRef.current);
      benchPollRef.current = null;
    }
    return () => {};
  }, [tab, benchRunning, benchData?.run?.status, loadBenchmarks]);

  const handleRunBenchmarks = async (force = false) => {
    setBenchRunning(true);
    setError(null);
    try {
      await aiManagerService.runBenchmarks({ ...integrationRoute('llm'), force });
      await loadBenchmarks();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to start benchmark');
      setBenchRunning(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    const jobs = [loadStatus(), loadModels(), loadPulls(), loadVoices(), loadIntegrations(), loadMemoryStatus(), loadServiceInfo(), loadInstances(), loadIntelligence()];
    if (tab === 'benchmarks') jobs.push(loadBenchmarks());
    await Promise.all(jobs);
    setRefreshing(false);
  };

  const confirmDelete = (name) => {
    const run = async () => {
      try {
        await aiManagerService.deleteModel(name, integrationRoute('llm'));
        if (selectedModel === name) setSelectedModel(null);
        await loadModels();
      } catch (err) {
        setError(err.response?.data?.error?.message || err.message || 'Failed to delete model');
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete model "${name}" from disk?`)) run();
    } else {
      Alert.alert('Delete model', `Remove "${name}" from Ollama?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: run },
      ]);
    }
  };

  const handlePull = async (nameOverride) => {
    const name = (typeof nameOverride === 'string' ? nameOverride : pullName).trim();
    if (!name) return;
    setPullName(name);
    setPulling(true); setError(null);
    try {
      await aiManagerService.pullModel(name, integrationRoute('llm'));
      await loadPulls();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to start pull');
    } finally { setPulling(false); }
  };

  const handleTts = async () => {
    const text = ttsText.trim();
    if (!text) return;
    setTtsLoading(true); setError(null);
    try {
      if (ttsAudioUrl) URL.revokeObjectURL(ttsAudioUrl);
      setTtsAudioUrl(await aiManagerService.synthesize(text, {
        voice: ttsVoice || undefined,
        language: ttsLanguage || undefined,
        speed: parseFloat(ttsSpeed) || undefined,
        ...integrationRoute('tts'),
      }));
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'TTS failed');
    } finally { setTtsLoading(false); }
  };

  const pickSttFile = () => {
    if (Platform.OS !== 'web') {
      setError('Audio upload is supported in the web console. Use the API on mobile.');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setSttFileName(file.name);
      setSttLoading(true); setError(null);
      try {
        setSttResult(await aiManagerService.transcribeFile(file, {
          language: sttLanguage || undefined,
          task: sttTask || undefined,
          ...integrationRoute('stt'),
        }));
      } catch (err) {
        setError(err.response?.data?.error?.message || err.message || 'Transcription failed');
      } finally { setSttLoading(false); }
    };
    input.click();
  };

  const handleEmbed = async () => {
    const raw = embedInput.trim();
    if (!raw) return;
    const input = raw.includes('\n') ? raw.split('\n').map((s) => s.trim()).filter(Boolean) : raw;
    setEmbedLoading(true); setError(null);
    try {
      const embedOpts = integrationRoute('embeddings');
      setEmbedResult(await aiManagerService['embed']({
        input,
        model: embedModel || undefined,
      }, embedOpts));
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Embed failed');
    } finally { setEmbedLoading(false); }
  };

  const resolveLlmModel = () => {
    if (selectedModel) return selectedModel;
    const row = integrations.find((i) => i.capability === 'llm' && i.name === integrationPick.llm);
    return row?.model || '';
  };

  const handleGenerate = async () => {
    const prompt = genPrompt.trim();
    const model = resolveLlmModel();
    if (!prompt || !model) return;
    setGenLoading(true); setError(null);
    try {
      const res = await aiManagerService.generate({ model, prompt }, integrationRoute('llm'));
      setGenResult(res?.response || res?.message?.content || JSON.stringify(res));
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Generate failed');
    } finally { setGenLoading(false); }
  };

  const handleSend = async () => {
    const content = chatInput.trim();
    const model = resolveLlmModel();
    if (!content || !model) return;
    const next = [...messages, { role: 'user', content }];
    setMessages(next);
    setChatInput('');
    setSending(true); setError(null);
    try {
      const res = await aiManagerService.chat({ model, messages: next }, integrationRoute('llm'));
      const reply = res?.message?.content || res?.response || '(no response)';
      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message || 'Chat failed';
      setMessages((m) => [...m, { role: 'assistant', content: `Error: ${msg}` }]);
    } finally { setSending(false); }
  };

  const reachable = status?.reachable;
  const dotColor = reachable === undefined ? colors.textMuted : reachable ? colors.success : colors.error;

  const ttsConfigValues = {
    TTS_BACKEND: ttsStatus?.backend,
    TTS_VOICE: ttsStatus?.voice,
    TTS_LANGUAGE: ttsStatus?.language,
    TTS_CACHE_URL: ttsStatus?.backend === 'cache' ? ttsStatus?.url : undefined,
  };

  const llmApiExamples = [API_EXAMPLES.seed_local, API_EXAMPLES.llm_status, API_EXAMPLES.llm_chat];
  const ttsApiExamples = [API_EXAMPLES.tts_synth];
  const sttApiExamples = [API_EXAMPLES.stt_upload];
  const embApiExamples = [API_EXAMPLES.embed];

  const llmIntegrations = integrations.filter((i) => i.capability === 'llm' && i.enabled !== 'false');
  const embedIntegrations = integrations.filter((i) => i.capability === 'embeddings' && i.enabled !== 'false');
  const selectedLlm = llmIntegrations.find((i) => i.name === integrationPick.llm) || null;
  const llmIsVllm = selectedLlm?.provider === 'vllm' || (!selectedLlm && status?.provider === 'vllm');
  const selectedLlmOpts = parseOpts(selectedLlm?.options);
  const selectedLlmHealth = (selectedLlm && llmHealth[selectedLlm.name]) || status;

  const IntegrationPicker = ({ capability, items, label }) => (
    <View style={{ marginBottom: spacing.sm }}>
      <Text style={S.label}>{label}</Text>
      <View style={S.pickerRow}>
        <Button
          title="Host default"
          variant={!integrationPick[capability] ? 'primary' : 'secondary'}
          onPress={() => setIntegrationPick((p) => ({ ...p, [capability]: null }))}
          style={S.rowBtn}
        />
        {items.map((i) => (
          <Button
            key={i.id || i.name}
            title={i.name}
            variant={integrationPick[capability] === i.name ? 'primary' : 'secondary'}
            onPress={() => setIntegrationPick((p) => ({ ...p, [capability]: i.name }))}
            style={S.rowBtn}
          />
        ))}
      </View>
    </View>
  );

  const ttsIntegrations = integrations.filter((i) => i.capability === 'tts' && i.enabled !== 'false');
  const sttIntegrations = integrations.filter((i) => i.capability === 'stt' && i.enabled !== 'false');

  const chatModels = models.filter(isChatModel);
  const embedModels = models.filter(isEmbedModel);
  const endpointCounts = {
    llm: llmIntegrations.length,
    embeddings: embedIntegrations.length,
    tts: ttsIntegrations.length,
    stt: sttIntegrations.length,
  };

  const deployedInstances = instances.filter((i) => i.status === 'deployed');

  const SubTabs = ({ tabs, active, onChange }) => (
    <View style={S.subTabRow}>
      {tabs.map((t) => (
        <TouchableOpacity
          key={t.id}
          style={[S.subTab, active === t.id && S.subTabActive]}
          onPress={() => onChange(t.id)}
          accessibilityRole="button"
        >
          <Text style={[S.subTabText, active === t.id && S.subTabTextActive]}>{t.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <ScrollView
      style={S.container}
      contentContainerStyle={S.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <ManagerSetupSection serviceName="ai_manager" navigation={navigation} onEnabled={onRefresh} />
      <Text style={S.title}>AI Services</Text>
      <Text style={S.subtitle}>LLM, embeddings, speech — GPU-accelerated on your fleet.</Text>
      {(projectsLoading || !projectId) ? (
        <Text style={S.hintText}>
          {projectsLoading ? 'Loading project…' : 'Select a project in the header to load fleet details.'}
        </Text>
      ) : null}

      <View style={S.tabRow}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[S.tab, tab === t.id && S.tabActive]}
            onPress={() => setTab(t.id)}
            activeOpacity={0.7}
          >
            <Ionicons name={t.icon} size={14} color={tab === t.id ? colors.primary : colors.textMuted} />
            <Text style={[S.tabText, tab === t.id && S.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {error && <Box style={S.errorBox}><Text style={S.errorText}>{error}</Text></Box>}

      {/* ── Overview ─────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <>
          <ActionBar actions={[
            ...(projectId && integrations.length === 0 ? [{ title: 'Setup local fleet', onPress: handleSeedLocal, loading: seeding }] : []),
            { title: 'Create Ollama LLM', onPress: () => openEndpointForm('llm', 'ollama') },
            { title: 'Create vLLM', variant: 'secondary', onPress: () => openEndpointForm('llm', 'vllm') },
            { title: 'Create intelligence', variant: 'secondary', onPress: () => navigation.navigate('aiIntelligenceForm', {}) },
            { title: 'Pull model', variant: 'secondary', onPress: () => { setTab('llm'); setLlmSub('models'); } },
            { title: 'Chat', variant: 'secondary', onPress: () => { setTab('llm'); setLlmSub('playground'); } },
            { title: 'Endpoints', variant: 'secondary', onPress: () => setTab('endpoints') },
          ]} />
          <Box title="Inference backends">
            {llmIntegrations.length > 0 ? (
              llmIntegrations.map((p) => {
                const h = llmHealth[p.name] || {};
                const up = h.reachable;
                const color = up === undefined ? colors.textMuted : up ? colors.success : colors.error;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={S.row}
                    onPress={() => navigation.navigate('aiProviderForm', { providerId: p.id })}
                    activeOpacity={0.8}
                  >
                    <View style={S.rowMain}>
                      <View style={S.rowInline}>
                        <View style={[S.dot, { backgroundColor: color }]} />
                        <Text style={S.rowName}>{p.provider === 'vllm' ? 'vLLM' : 'Ollama'} · {p.name}</Text>
                      </View>
                      <Text style={S.rowSub}>
                        {up === true ? 'Reachable' : up === false ? 'Unreachable' : 'Checking…'}
                        {p.endpoint ? ` · ${p.endpoint}` : ''}
                        {p.model ? ` · ${p.model}` : ''}
                        {p.is_default === 'true' || p.is_default === true ? ' · default' : ''}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                );
              })
            ) : status ? (
              <View style={S.statusGrid}>
                <View style={S.statusCell}>
                  <Text style={S.statusLabel}>{status.provider === 'vllm' ? 'vLLM' : 'Ollama'}</Text>
                  <View style={[S.rowInline, { marginTop: 2 }]}>
                    <View style={[S.dot, { backgroundColor: dotColor }]} />
                    <Text style={S.statusValue}>{reachable ? 'Reachable' : 'Unreachable'}</Text>
                  </View>
                </View>
                <View style={S.statusCell}>
                  <Text style={S.statusLabel}>Backend URL</Text>
                  <Text style={S.statusValue} numberOfLines={2}>{status.base_url || '—'}</Text>
                </View>
                <View style={S.statusCell}>
                  <Text style={S.statusLabel}>Version</Text>
                  <Text style={S.statusValue}>{status.version || serviceInfo?.version || '—'}</Text>
                </View>
                <View style={S.statusCell}>
                  <Text style={S.statusLabel}>Models</Text>
                  <Text style={S.statusValue}>{status.model_count ?? models.length}</Text>
                </View>
              </View>
            ) : (
              <ActivityIndicator size="small" color={colors.primary} />
            )}
            {deployedInstances.length > 0 ? (
              <TouchableOpacity
                style={[S.row, { marginTop: spacing.sm, borderTopWidth: 0 }]}
                onPress={() => navigation.navigate('aiDeploymentDetails')}
                activeOpacity={0.8}
              >
                <View style={S.rowMain}>
                  <Text style={S.rowName}>Deployed on {deployedInstances.length} device{deployedInstances.length === 1 ? '' : 's'}</Text>
                  <Text style={S.rowSub}>
                    {deployedInstances.map((i) => i.worker_hostname || i.worker_id?.slice(0, 8)).join(', ')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ) : (
              <Text style={[S.hintText, { marginTop: spacing.sm }]}>Not deployed for this project yet.</Text>
            )}
          </Box>
          <Box title="Resources">
            <View style={S.quickGrid}>
              <TouchableOpacity style={S.quickCard} onPress={() => setTab('llm')} activeOpacity={0.8}>
                <Text style={S.quickCardTitle}>LLM models</Text>
                <Text style={S.quickCardMeta}>{models.length} installed · {status?.reachable ? 'online' : 'offline'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={S.quickCard} onPress={() => setTab('tts')} activeOpacity={0.8}>
                <Text style={S.quickCardTitle}>TTS dictionary</Text>
                <Text style={S.quickCardMeta}>
                  {cacheStats?.cached_words != null ? `${cacheStats.cached_words.toLocaleString()} words` : '—'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={S.quickCard} onPress={() => setTab('tts')} activeOpacity={0.8}>
                <Text style={S.quickCardTitle}>TTS voices</Text>
                <Text style={S.quickCardMeta}>{voices.length} available · {ttsStatus?.backend || 'cache'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={S.quickCard} onPress={() => setTab('embeddings')} activeOpacity={0.8}>
                <Text style={S.quickCardTitle}>Embeddings</Text>
                <Text style={S.quickCardMeta}>{embedStatus?.default_model || '—'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={S.quickCard} onPress={() => setTab('benchmarks')} activeOpacity={0.8}>
                <Text style={S.quickCardTitle}>Benchmarks</Text>
                <Text style={S.quickCardMeta}>
                  {benchData?.recommended
                    ? `${benchData.recommended}`
                    : (benchData?.pending_count ? `${benchData.pending_count} pending` : 'LLM speed + JSON')}
                </Text>
              </TouchableOpacity>
            </View>
          </Box>
          <Box title={`Chat LLMs (${chatModels.length})`}>
            {loadingModels ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : chatModels.length === 0 ? (
              <Text style={S.hintText}>No chat models found. Pull from Ollama, or create a vLLM endpoint.</Text>
            ) : (
              chatModels.slice(0, 12).map((m) => (
                <TouchableOpacity
                  key={m.name}
                  style={S.row}
                  onPress={() => navigation.navigate('aiModelDetails', { modelName: m.name })}
                  activeOpacity={0.8}
                >
                  <View style={S.rowMain}>
                    <Text style={S.rowName}>{m.name}</Text>
                    <Text style={S.rowSub}>{modelMetaLine(m)} · {modelCapabilities(m).join(', ')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              ))
            )}
            {chatModels.length > 12 ? (
              <TouchableOpacity onPress={() => { setTab('llm'); setLlmSub('models'); }}>
                <Text style={[S.hintText, { marginTop: 8 }]}>View all {chatModels.length} chat models →</Text>
              </TouchableOpacity>
            ) : null}
          </Box>
          <Box title={`Embedding models (${embedModels.length})`}>
            {loadingModels ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : embedModels.length === 0 ? (
              <Text style={S.hintText}>No embedding models on Ollama. Default: {embedStatus?.default_model || 'not set'}.</Text>
            ) : (
              embedModels.map((m) => (
                <View key={m.name} style={S.row}>
                  <View style={S.rowMain}>
                    <Text style={S.rowName}>{m.name}</Text>
                    <Text style={S.rowSub}>
                      {modelMetaLine(m)}
                      {embedStatus?.default_model === m.name ? ' · default' : ''}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </Box>
          <Box title="Project endpoints">
            {!projectId ? (
              <Text style={S.hintText}>Select a project in the header to register LLM, embedding, TTS, and STT endpoints.</Text>
            ) : loadingIntegrations ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : integrations.length === 0 ? (
              <View style={S.emptyState}>
                <Text style={S.emptyText}>No endpoints registered for this project yet.</Text>
                <Text style={S.hintText}>Setup local fleet registers Orin Ollama, vLLM, embeddings, TTS, and STT in one click.</Text>
                <Button title="Setup local fleet" onPress={handleSeedLocal} loading={seeding} style={{ marginTop: 12 }} />
              </View>
            ) : (
              <>
                <View style={S.statusGrid}>
                  {[
                    ['LLM', endpointCounts.llm],
                    ['Intelligence', intelligence.length],
                    ['RAG', ragCollections.length],
                    ['Embeddings', endpointCounts.embeddings],
                    ['TTS', endpointCounts.tts],
                    ['STT', endpointCounts.stt],
                  ].map(([label, count]) => (
                    <View key={label} style={S.statusCell}>
                      <Text style={S.statusLabel}>{label}</Text>
                      <Text style={S.statusValue}>{count} endpoint{count === 1 ? '' : 's'}</Text>
                    </View>
                  ))}
                </View>
                {integrations.slice(0, 6).map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={S.row}
                    onPress={() => navigation.navigate('aiProviderForm', { providerId: p.id })}
                    activeOpacity={0.8}
                  >
                    <View style={S.rowMain}>
                      <Text style={S.rowName}>{p.name}</Text>
                      <Text style={S.rowSub}>
                        {p.capability || 'llm'} · {p.provider || '—'}
                        {p.endpoint ? ` · ${p.endpoint}` : ''}
                        {p.is_default === 'true' ? ' · default' : ''}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                ))}
                {integrations.length > 6 ? (
                  <TouchableOpacity onPress={() => setTab('endpoints')}>
                    <Text style={[S.hintText, { marginTop: 8 }]}>View all {integrations.length} endpoints →</Text>
                  </TouchableOpacity>
                ) : null}
              </>
            )}
          </Box>
          <Box title="Memory / RAG">
            {!projectId ? (
              <Text style={S.hintText}>Select a project to view memory store status (vector RAG, session ingest, long-term promotion).</Text>
            ) : !memoryStatus?.configured ? (
              <View>
                <Text style={S.hintText}>Not configured for this project.</Text>
                <Text style={[S.hintText, { marginTop: 8 }]}>
                  POST /api/v1/memory/setup with project_id to provision short-term + long-term vector stores.
                </Text>
              </View>
            ) : (
              <View style={S.statusGrid}>
                <View style={S.statusCell}>
                  <Text style={S.statusLabel}>Status</Text>
                  <Text style={S.statusValue}>{memoryStatus.status || '—'}</Text>
                </View>
                <View style={S.statusCell}>
                  <Text style={S.statusLabel}>Store prefix</Text>
                  <Text style={S.statusValue}>{memoryStatus.store_name_prefix || '—'}</Text>
                </View>
                <View style={S.statusCell}>
                  <Text style={S.statusLabel}>Embeddings integration</Text>
                  <Text style={S.statusValue}>{memoryStatus.embeddings_integration || 'default'}</Text>
                </View>
                <View style={S.statusCell}>
                  <Text style={S.statusLabel}>Extractor integration</Text>
                  <Text style={S.statusValue}>{memoryStatus.extractor_integration || 'default LLM'}</Text>
                </View>
              </View>
            )}
          </Box>
          <Box title="Service health">
            <View style={S.statusGrid}>
              {[
                ['LLM', status?.reachable],
                [`TTS (${ttsStatus?.backend || '—'})`, ttsStatus?.reachable],
                ['STT', sttStatus?.reachable],
                ['Embeddings', embedStatus?.reachable],
              ].map(([label, ok]) => (
                <View key={label} style={S.statusCell}>
                  <Text style={S.statusLabel}>{label}</Text>
                  <Text style={S.statusValue}>{ok ? 'Online' : 'Offline'}</Text>
                </View>
              ))}
            </View>
          </Box>
          <ConsoleGuide title={AI_GUIDES.overview.title} steps={AI_GUIDES.overview.steps} />
        </>
      )}

      {/* ── Endpoints ────────────────────────────────────────────────────── */}
      {(tab === 'endpoints' || tab === 'integrations') && (
        <>
          <ActionBar actions={[
            { title: 'Setup local fleet', onPress: handleSeedLocal, loading: seeding },
            { title: 'Create Ollama LLM', variant: 'secondary', onPress: () => openEndpointForm('llm', 'ollama') },
            { title: 'Create vLLM', variant: 'secondary', onPress: () => openEndpointForm('llm', 'vllm') },
            { title: 'Create embeddings', variant: 'secondary', onPress: () => openEndpointForm('embeddings', 'ollama') },
            { title: 'Create TTS', variant: 'secondary', onPress: () => openEndpointForm('tts', 'cache') },
            { title: 'Create STT', variant: 'secondary', onPress: () => openEndpointForm('stt', 'whisper') },
            { title: 'Add endpoint', variant: 'secondary', onPress: () => navigation.navigate('aiProviderForm', {}) },
          ]} />
          <Box title="AI endpoints">
            {!projectId ? (
              <Text style={S.hintText}>Select a project to register Ollama, vLLM, TTS, and STT endpoints on your fleet.</Text>
            ) : loadingIntegrations ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : integrations.length === 0 ? (
              <View style={S.emptyState}>
                <Ionicons name="link-outline" size={40} color={colors.textMuted} />
                <Text style={S.emptyText}>No endpoints yet. Setup local fleet registers Orin Ollama, vLLM, TTS, and STT.</Text>
                <Button title="Setup local fleet" onPress={handleSeedLocal} loading={seeding} style={{ marginTop: 12 }} />
              </View>
            ) : (
              integrations.map((p) => {
                const endpointArn = p.arn || (projectId && p.name
                  ? `arn:aerekos:${projectId}:ai:${p.capability || 'llm'}:endpoint/${p.name}`
                  : null);
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={S.row}
                    onPress={() => navigation.navigate('aiProviderForm', { providerId: p.id })}
                    activeOpacity={0.8}
                  >
                    <View style={S.rowMain}>
                      <Text style={S.rowName}>{p.name}</Text>
                      <Text style={S.rowSub}>
                        {p.capability || 'llm'} · {p.provider || '—'}
                        {p.endpoint ? ` · ${p.endpoint}` : ''}
                        {p.is_default === 'true' ? ' · default' : ''}
                      </Text>
                      {endpointArn ? (
                        <Text style={[S.rowSub, { fontFamily: Platform.OS === 'web' ? 'monospace' : undefined }]} numberOfLines={2}>
                          {endpointArn}
                        </Text>
                      ) : null}
                    </View>
                    <View style={S.rowActions}>
                      {endpointArn ? (
                        <TouchableOpacity
                          style={S.iconBtn}
                          onPress={(e) => {
                            e?.stopPropagation?.();
                            copyToClipboard(endpointArn, () => {
                              setCopiedId(`arn-${p.id}`);
                              setTimeout(() => setCopiedId(null), 2000);
                            });
                          }}
                        >
                          <Ionicons
                            name={copiedId === `arn-${p.id}` ? 'checkmark' : 'copy-outline'}
                            size={18}
                            color={colors.primary}
                          />
                        </TouchableOpacity>
                      ) : null}
                      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </Box>
          <Box title="Invoke from apps">
            <Text style={S.hintText}>
              Apps use client_credentials → app JWT → conductor proxy with resource ARN in body.resource
              or X-Aerekos-Resource. Human console tokens still work without ARN scoping.
            </Text>
          </Box>
          <ApiReference examples={[API_EXAMPLES.seed_local, API_EXAMPLES.app_token, API_EXAMPLES.llm_chat_arn]} baseUrl={apiBase} />
          <ConsoleGuide title={AI_GUIDES.endpoints.title} steps={AI_GUIDES.endpoints.steps} />
        </>
      )}

      {tab === 'intelligence' && (
        <>
          <ActionBar actions={[
            { title: 'Create intelligence', onPress: () => navigation.navigate('aiIntelligenceForm', {}) },
            { title: 'Create RAG', variant: 'secondary', onPress: () => navigation.navigate('aiRagForm', {}) },
            { title: 'Create LLM', variant: 'secondary', onPress: () => openEndpointForm('llm', 'ollama') },
          ]} />
          <Box title="Intelligence endpoints">
            <Text style={S.hintText}>
              Apps call one stable ARN. You hot-swap the LLM and attach or detach RAG and memory without changing that URL.
            </Text>
            {!projectId ? (
              <Text style={[S.hintText, { marginTop: 8 }]}>Select a project first.</Text>
            ) : intelligence.length === 0 ? (
              <View style={S.emptyState}>
                <Text style={S.emptyText}>None yet. Create an intelligence endpoint, bind an LLM, then attach RAG/memory.</Text>
              </View>
            ) : intelligence.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={S.row}
                onPress={() => navigation.navigate('aiIntelligenceForm', { intelligenceId: item.id })}
                activeOpacity={0.8}
              >
                <View style={S.rowMain}>
                  <Text style={S.rowName}>{item.name}</Text>
                  <Text style={S.rowSub}>
                    LLM {item.llm_integration || 'unbound'}
                    {(item.rag || []).length ? ` · RAG ${(item.rag || []).map((r) => r.name).join(', ')}` : ''}
                    {(item.memory || []).length ? ` · memory ${(item.memory || []).map((m) => m.name).join(', ')}` : ''}
                  </Text>
                  {item.arn ? <Text style={S.rowSub} numberOfLines={1}>{item.arn}</Text> : null}
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </Box>
          <Box title="RAG collections">
            {ragCollections.length === 0 ? (
              <Text style={S.hintText}>No collections. Create one, ingest documents, attach it to any intelligence endpoint.</Text>
            ) : ragCollections.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={S.row}
                onPress={() => navigation.navigate('aiRagForm', { ragId: c.id })}
                activeOpacity={0.8}
              >
                <View style={S.rowMain}>
                  <Text style={S.rowName}>{c.name}</Text>
                  <Text style={S.rowSub}>
                    {c.document_count || 0} docs
                    {(c.attached_to || []).length ? ` · used by ${(c.attached_to || []).join(', ')}` : ' · not attached'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </Box>
          <Box title="Memory stores">
            {memoryStores.map((m) => (
              <View key={m.id || m.name} style={S.row}>
                <View style={S.rowMain}>
                  <Text style={S.rowName}>{m.name}</Text>
                  <Text style={S.rowSub}>{m.status || 'draft'} · {m.arn || '—'}</Text>
                </View>
              </View>
            ))}
            <View style={S.pullRow}>
              <TextInput
                style={S.input}
                placeholder="Store name, e.g. icarus"
                placeholderTextColor={colors.textMuted}
                value={memoryStoreName}
                onChangeText={setMemoryStoreName}
                autoCapitalize="none"
              />
              <Button title="Create & provision" onPress={handleCreateMemoryStore} loading={creatingMemory} style={S.pullBtn} />
            </View>
          </Box>
        </>
      )}

      {/* ── App access ───────────────────────────────────────────────────── */}
      {tab === 'appaccess' && (
        <>
          <ActionBar actions={[
            { title: 'Endpoints', variant: 'secondary', onPress: () => setTab('endpoints') },
            { title: 'API Gateway', variant: 'secondary', onPress: () => navigation.navigate('apiGatewayManager') },
          ]} />
          <AppAccessPanel
            projectId={projectId}
            apiBase={apiBase}
            hint="Apps use client_credentials → app JWT → pretty /v1/… URL or conductor proxy with resource ARN."
            resources={[
              ...integrations.filter((i) => i.name).map((p) => {
                const arn = p.arn || `arn:aerekos:${projectId}:ai:${p.capability || 'llm'}:endpoint/${p.name}`;
                return {
                  id: p.id,
                  name: p.name,
                  arn,
                  prettyUrl: buildPrettyUrl(apiBase, AI_ACCESS?.prettyPreset?.(p, projectId)),
                };
              }),
              ...intelligence.filter((i) => i.name).map((p) => ({
                id: p.id,
                name: p.name,
                arn: p.arn,
                prettyUrl: buildPrettyUrl(apiBase, AI_ACCESS?.prettyPreset?.({ ...p, capability: 'intelligence' }, projectId)),
              })),
            ]}
            scopes={AI_ACCESS?.scopes || []}
            defaultScopes={AI_ACCESS?.defaultScopes || ['ai:InvokeLlm', 'ai:InvokeIntelligence']}
            invokeCurl={`# Pretty URL (after gateway presets seeded)\nTOKEN=$(curl -s -X POST "${apiBase}/api/services/auth_manager/api/v1/auth/token" -H "Content-Type: application/json" -d '{"grant_type":"client_credentials","client_id":"$CLIENT_ID","client_secret":"$CLIENT_SECRET"}' | jq -r .access_token)\ncurl -s -X POST "${apiBase}/v1/projects/PROJECT_ID/ai/llm/ENDPOINT/chat" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"model":"llama3.2:3b","messages":[{"role":"user","content":"Hello"}]}'`}
          />
          <ApiReference examples={[API_EXAMPLES.app_token, API_EXAMPLES.llm_chat_arn]} baseUrl={apiBase} />
          <ConsoleGuide title={AI_GUIDES.appaccess.title} steps={AI_GUIDES.appaccess.steps} />
        </>
      )}

      {/* ── LLM ──────────────────────────────────────────────────────────── */}
      {tab === 'llm' && (
        <>
          <ActionBar actions={[
            { title: 'Create Ollama LLM', onPress: () => openEndpointForm('llm', 'ollama') },
            { title: 'Create vLLM', variant: 'secondary', onPress: () => openEndpointForm('llm', 'vllm') },
            ...(!llmIsVllm ? [{ title: 'Pull model', variant: 'secondary', onPress: () => setLlmSub('models'), loading: pulling }] : []),
            { title: 'Open chat', variant: 'secondary', onPress: () => setLlmSub('playground'), disabled: !(selectedModel || selectedLlm?.model) },
          ]} />
          <SubTabs
            tabs={[
              { id: 'models', label: 'Models' },
              { id: 'playground', label: 'Playground' },
              { id: 'config', label: 'Configuration' },
            ]}
            active={llmSub}
            onChange={setLlmSub}
          />
          {llmSub === 'models' && (
            <>
              <IntegrationPicker
                capability="llm"
                items={llmIntegrations}
                label="LLM endpoint"
              />
              <Box title={llmIsVllm ? 'vLLM backend' : 'Ollama backend'}>
                {selectedLlmHealth ? (
                  <View style={S.statusGrid}>
                    <View style={S.statusCell}>
                      <Text style={S.statusLabel}>Status</Text>
                      <View style={[S.rowInline, { marginTop: 2 }]}>
                        <View style={[S.dot, { backgroundColor: selectedLlmHealth.reachable ? colors.success : colors.error }]} />
                        <Text style={S.statusValue}>{selectedLlmHealth.reachable ? 'Reachable' : 'Unreachable'}</Text>
                      </View>
                    </View>
                    <View style={S.statusCell}>
                      <Text style={S.statusLabel}>Provider</Text>
                      <Text style={S.statusValue}>{selectedLlm?.provider || selectedLlmHealth.provider || (llmIsVllm ? 'vllm' : 'ollama')}</Text>
                    </View>
                    <View style={S.statusCell}>
                      <Text style={S.statusLabel}>URL</Text>
                      <Text style={S.statusValue} numberOfLines={2}>{selectedLlm?.endpoint || selectedLlmHealth.base_url || '—'}</Text>
                    </View>
                    <View style={S.statusCell}>
                      <Text style={S.statusLabel}>Models</Text>
                      <Text style={S.statusValue}>{selectedLlmHealth.model_count ?? models.length}</Text>
                    </View>
                  </View>
                ) : <ActivityIndicator size="small" color={colors.primary} />}
                {llmIsVllm ? (
                  <>
                    <Text style={[S.hintText, { marginTop: 8 }]}>
                      vLLM serves one Hugging Face model at a time. Pull and delete are Ollama-only. Serving flags (quantization, dtype, GPU memory) live on the endpoint — restart the GPU container to apply them.
                    </Text>
                    {selectedLlm ? (
                      <Button
                        title="Edit serving options"
                        variant="secondary"
                        onPress={() => navigation.navigate('aiProviderForm', { providerId: selectedLlm.id })}
                        style={{ marginTop: 8, alignSelf: 'flex-start' }}
                      />
                    ) : null}
                    {selectedLlmOpts.quantization || selectedLlmOpts.dtype ? (
                      <Text style={[S.metaText, { marginTop: 8 }]}>
                        quant={selectedLlmOpts.quantization || '—'}
                        {' · '}dtype={selectedLlmOpts.dtype || '—'}
                        {selectedLlmOpts.gpu_memory_utilization != null ? ` · gpu_mem=${selectedLlmOpts.gpu_memory_utilization}` : ''}
                        {selectedLlmOpts.max_model_len != null ? ` · max_len=${selectedLlmOpts.max_model_len}` : ''}
                      </Text>
                    ) : null}
                  </>
                ) : null}
              </Box>
              <Box title="Models">
                {!llmIsVllm ? (
                <View style={S.pullRow}>
                  <TextInput
                    style={S.input}
                    placeholder="Model name, e.g. llama3.2:3b"
                    placeholderTextColor={colors.textMuted}
                    value={pullName}
                    onChangeText={setPullName}
                    autoCapitalize="none"
                    onSubmitEditing={handlePull}
                  />
                  <Button title="Pull model" onPress={handlePull} loading={pulling} style={S.pullBtn} />
                </View>
                ) : null}
                {pulls.filter((p) => p.status === 'pulling' || p.status === 'error').map((p) => (
                  <View key={p.model} style={{ marginBottom: 8 }}>
                    <View style={S.listHeader}>
                      <Text style={S.rowSub}>{p.model} · {p.status}</Text>
                      <Text style={S.rowSub}>{p.percent || 0}%</Text>
                    </View>
                    <View style={S.progressTrack}>
                      <View style={[S.progressFill, { width: `${Math.min(100, p.percent || 0)}%` }]} />
                    </View>
                  </View>
                ))}
                {loadingModels ? (
                  <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 12 }} />
                ) : models.length === 0 ? (
                  <View style={S.emptyState}>
                    <Ionicons name="cube-outline" size={40} color={colors.textMuted} />
                    <Text style={S.emptyText}>
                      {llmIsVllm
                        ? (selectedLlmHealth?.reachable === false
                          ? 'vLLM is not reachable. The GPU process is stopped — register the endpoint, then start vLLM on the host when you want it live.'
                          : 'No models reported by vLLM. Confirm the served Hugging Face id on the endpoint.')
                        : 'No models. Pull one above.'}
                    </Text>
                    {!llmIsVllm ? (
                      <Button title="Pull llama3.2:3b" onPress={() => handlePull('llama3.2:3b')} style={{ marginTop: 12 }} />
                    ) : selectedLlm ? (
                      <Button
                        title="Edit vLLM endpoint"
                        variant="secondary"
                        onPress={() => navigation.navigate('aiProviderForm', { providerId: selectedLlm.id })}
                        style={{ marginTop: 12 }}
                      />
                    ) : (
                      <Button title="Create vLLM endpoint" onPress={() => openEndpointForm('llm', 'vllm')} style={{ marginTop: 12 }} />
                    )}
                  </View>
                ) : (
                  models.map((m) => {
                    const active = selectedModel === m.name;
                    return (
                      <View key={m.name} style={S.row}>
                        <View style={S.rowMain}>
                          <Text style={S.rowName} numberOfLines={1}>{m.name}</Text>
                          <Text style={S.rowSub} numberOfLines={1}>
                            {formatBytes(m.size)}
                            {m.details?.parameter_size ? ` · ${m.details.parameter_size}` : ''}
                          </Text>
                        </View>
                        <View style={S.rowActions}>
                          <Button
                            title="Details"
                            variant="secondary"
                            onPress={() => navigation.navigate('aiModelDetails', { modelName: m.name })}
                            style={S.rowBtn}
                          />
                          <Button
                            title={active ? 'Selected' : 'Select'}
                            variant="secondary"
                            onPress={() => setSelectedModel(m.name)}
                            style={S.rowBtn}
                          />
                          <Button
                            title="Chat"
                            onPress={() => { setSelectedModel(m.name); setLlmSub('playground'); }}
                            style={S.rowBtn}
                          />
                          {!llmIsVllm ? (
                          <Button
                            title="Delete"
                            variant="secondary"
                            onPress={() => confirmDelete(m.name)}
                            style={S.rowBtn}
                          />
                          ) : null}
                        </View>
                      </View>
                    );
                  })
                )}
              </Box>
            </>
          )}

          {llmSub === 'playground' && (
            <>
              <Box title="Chat">
                <IntegrationPicker
                  capability="llm"
                  items={llmIntegrations}
                  label="LLM endpoint"
                />
                {!(selectedModel || selectedLlm?.model) ? (
                  <>
                    <Text style={S.hintText}>
                      {llmIsVllm
                        ? 'Set a Hugging Face model on the vLLM endpoint, or wait until the server lists a model.'
                        : 'Select a model on the Models tab first.'}
                    </Text>
                    <Button title="Go to models" onPress={() => setLlmSub('models')} style={{ marginTop: 8, alignSelf: 'flex-start' }} />
                  </>
                ) : (
                  <>
                    <Text style={S.metaText}>Model: {selectedModel || selectedLlm?.model}</Text>
                    <View style={[S.chatBox, { marginTop: 6 }]}>
                      {messages.length === 0 ? (
                        <Text style={S.hintText}>Type below and click Send.</Text>
                      ) : messages.map((m, i) => (
                        <View key={i} style={S.msg}>
                          <Text style={[S.msgRole, m.role === 'user' && S.msgUser]}>
                            {m.role === 'user' ? 'You' : 'Assistant'}
                          </Text>
                          <Text style={S.msgText}>{m.content}</Text>
                        </View>
                      ))}
                      {sending ? <ActivityIndicator size="small" color={colors.primary} /> : null}
                    </View>
                    <View style={S.chatInputRow}>
                      <TextInput
                        style={[S.input, S.chatInput]}
                        placeholder="Type a message"
                        placeholderTextColor={colors.textMuted}
                        value={chatInput}
                        onChangeText={setChatInput}
                        multiline
                      />
                      <Button title="Send" onPress={handleSend} loading={sending} disabled={!chatInput.trim()} style={S.sendBtn} />
                    </View>
                  </>
                )}
              </Box>
              <Box title="Completion">
                <IntegrationPicker
                  capability="llm"
                  items={llmIntegrations}
                  label="LLM integration"
                />
                <TextInput
                  style={[S.input, { marginBottom: 8, minHeight: 60 }]}
                  placeholder="Prompt"
                  placeholderTextColor={colors.textMuted}
                  value={genPrompt}
                  onChangeText={setGenPrompt}
                  multiline
                />
                <Button title="Generate" onPress={handleGenerate} loading={genLoading} disabled={!(selectedModel || selectedLlm?.model)} />
                {genResult ? (
                  <View style={S.resultBox}><Text style={S.resultText}>{genResult}</Text></View>
                ) : null}
              </Box>
            </>
          )}

          {llmSub === 'config' && (
            <>
              <Box title="Configuration">
                <ConfigTable rows={AI_GUIDES.llm.config} note={CONFIG_NOTE} />
              </Box>
              <ApiReference examples={llmApiExamples} />
              <ConsoleGuide title={AI_GUIDES.llm.title} steps={AI_GUIDES.llm.steps} />
            </>
          )}
        </>
      )}

      {/* ── Benchmarks ───────────────────────────────────────────────────── */}
      {tab === 'benchmarks' && (
        <>
          <ActionBar actions={[
            { title: 'Run pending', onPress: () => handleRunBenchmarks(false), loading: benchRunning },
            { title: 'Re-bench all', variant: 'secondary', onPress: () => handleRunBenchmarks(true), loading: benchRunning },
            { title: 'Refresh', variant: 'secondary', onPress: loadBenchmarks, loading: benchLoading },
          ]} />
          <IntegrationPicker
            capability="llm"
            items={llmIntegrations}
            label="LLM endpoint"
          />
          <Box title="Run status">
            {benchLoading && !benchData ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <View style={S.statusGrid}>
                <View style={S.statusCell}>
                  <Text style={S.statusLabel}>Mode</Text>
                  <Text style={S.statusValue}>{benchData?.run?.mode || 'serial'}</Text>
                </View>
                <View style={S.statusCell}>
                  <Text style={S.statusLabel}>Status</Text>
                  <Text style={S.statusValue}>
                    {benchData?.run?.status === 'running'
                      ? `Running ${benchData.run.done || 0}/${benchData.run.total || '?'}`
                      : (benchData?.run?.status || 'idle')}
                  </Text>
                </View>
                <View style={S.statusCell}>
                  <Text style={S.statusLabel}>Current</Text>
                  <Text style={S.statusValue} numberOfLines={1}>{benchData?.run?.current || '—'}</Text>
                </View>
                <View style={S.statusCell}>
                  <Text style={S.statusLabel}>Queued</Text>
                  <Text style={S.statusValue}>{benchData?.run?.queued ?? 0}</Text>
                </View>
              </View>
            )}
            {benchData?.run?.status === 'running' && benchData?.run?.current ? (
              <Text style={[S.metaText, { marginTop: 8 }]}>
                Benching one model at a time — {benchData.run.current}
              </Text>
            ) : null}
          </Box>
          <Box title="Recommended">
            {benchData?.recommended ? (
              <Text style={S.rowName}>
                {benchData.recommended}
                {(() => {
                  const hit = (benchData.items || []).find((i) => i.model === benchData.recommended && i.pass);
                  return hit?.wall_ms != null ? ` · ${hit.wall_ms}ms` : '';
                })()}
              </Text>
            ) : (
              <Text style={S.hintText}>No passing model yet. Run pending to bench installed chat models.</Text>
            )}
            <Text style={[S.metaText, { marginTop: 6 }]}>
              Suite: {benchData?.suite || 'json-commands-v1'} · Pending: {benchData?.pending_count ?? (benchData?.pending?.length ?? 0)}
            </Text>
          </Box>
          <Box title="Results">
            {benchLoading && !benchData?.items?.length ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : !(benchData?.items || []).length ? (
              <View style={S.emptyState}>
                <Ionicons name="speedometer-outline" size={40} color={colors.textMuted} />
                <Text style={S.emptyText}>No benchmark results yet. New models are benched automatically after pull.</Text>
                <Button title="Run pending models" onPress={() => handleRunBenchmarks(false)} style={{ marginTop: 12 }} />
              </View>
            ) : (
              [...(benchData.items || [])]
                .sort((a, b) => {
                  if (a.pass !== b.pass) return a.pass ? -1 : 1;
                  return (a.wall_ms ?? 9e9) - (b.wall_ms ?? 9e9);
                })
                .map((row) => (
                  <View key={`${row.model}-${row.benchmarked_at}`} style={S.row}>
                    <View style={S.rowMain}>
                      <Text style={S.rowName} numberOfLines={1}>{row.model}</Text>
                      <Text style={S.rowSub} numberOfLines={1}>
                        {row.pass ? 'PASS' : `FAIL · ${row.reason || '?'}`}
                        {row.wall_ms != null ? ` · ${row.wall_ms}ms` : ''}
                        {row.parameter_size ? ` · ${row.parameter_size}` : ''}
                      </Text>
                    </View>
                    <View style={[S.dot, { backgroundColor: row.pass ? colors.success : colors.error }]} />
                  </View>
                ))
            )}
          </Box>
          {(benchData?.pending || []).length > 0 && (
            <Box title="Pending (not yet benchmarked)">
              <Text style={S.hintText}>{benchData.pending.join(', ')}</Text>
            </Box>
          )}
          <Box title="What we test">
            <Text style={S.hintText}>
              Each model gets a warm + timed chat with the eat-cake coach prompt. Pass requires valid JSON,
              a commands array, and propose_create_task — no safety refusals. Runs serially with VRAM unload between models.
            </Text>
          </Box>
          <ConsoleGuide title={AI_GUIDES.benchmarks.title} steps={AI_GUIDES.benchmarks.steps} />
          <ApiReference examples={[API_EXAMPLES.llm_benchmarks, API_EXAMPLES.llm_benchmark_run]} baseUrl={apiBase} />
        </>
      )}

      {/* ── TTS ──────────────────────────────────────────────────────────── */}
      {tab === 'tts' && (
        <>
          <ActionBar actions={[
            { title: 'Create TTS endpoint', onPress: () => openEndpointForm('tts', 'cache') },
            { title: 'Synthesize', variant: 'secondary', onPress: handleTts, loading: ttsLoading },
            { title: 'Voices', variant: 'secondary', onPress: () => setTtsSub('voices') },
          ]} />
          <SubTabs
            tabs={[
              { id: 'synthesize', label: 'Synthesize' },
              { id: 'voices', label: 'Voices' },
              { id: 'config', label: 'Configuration' },
            ]}
            active={ttsSub}
            onChange={setTtsSub}
          />
          {ttsSub === 'voices' && (
            <Box title="Voices — click to select">
              {voices.length === 0 ? (
                <Text style={S.hintText}>No voices from upstream.</Text>
              ) : (
                <View style={S.pickerRow}>
                  {voices.slice(0, 24).map((v) => {
                    const id = typeof v === 'string' ? v : (v.id || v.name || v.voice);
                    const active = ttsVoice === id;
                    return (
                      <Button
                        key={id}
                        title={id}
                        variant={active ? 'primary' : 'secondary'}
                        onPress={() => setTtsVoice(id)}
                        style={S.rowBtn}
                      />
                    );
                  })}
                </View>
              )}
            </Box>
          )}
          {ttsSub === 'config' && (
            <>
              <Box title="Configuration">
                <ConfigTable rows={AI_GUIDES.tts.config} values={ttsConfigValues} note={CONFIG_NOTE} />
              </Box>
              <ApiReference examples={ttsApiExamples} />
              <ConsoleGuide title={AI_GUIDES.tts.title} steps={AI_GUIDES.tts.steps} />
            </>
          )}
          {ttsSub === 'synthesize' && (
          <Box title="Synthesize">
            <IntegrationPicker
              capability="tts"
              items={ttsIntegrations}
              label="TTS integration"
            />
            <Text style={S.label}>Text</Text>
            <TextInput
              style={[S.input, { marginBottom: 8 }]}
              placeholder="Text to speak"
              placeholderTextColor={colors.textMuted}
              value={ttsText}
              onChangeText={setTtsText}
              multiline
            />
            <Text style={S.label}>Voice override</Text>
            <TextInput
              style={[S.input, { marginBottom: 8 }]}
              placeholder={ttsStatus?.voice || 'af_heart'}
              placeholderTextColor={colors.textMuted}
              value={ttsVoice}
              onChangeText={setTtsVoice}
              autoCapitalize="none"
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={S.label}>Language</Text>
                <TextInput
                  style={S.input}
                  value={ttsLanguage}
                  onChangeText={setTtsLanguage}
                  autoCapitalize="none"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={S.label}>Speed</Text>
                <TextInput
                  style={S.input}
                  value={ttsSpeed}
                  onChangeText={setTtsSpeed}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            <Button title="Synthesize" onPress={handleTts} loading={ttsLoading} style={{ marginTop: 8 }} />
            <WebAudio src={ttsAudioUrl} />
            {cacheStats?.cached_words != null && (
              <Text style={[S.metaText, { marginTop: 8 }]}>
                Cache: {cacheStats.cached_words.toLocaleString()} words
                {cacheStats.coverage_pct != null ? ` (${cacheStats.coverage_pct}% coverage)` : ''}
              </Text>
            )}
          </Box>
          )}
        </>
      )}

      {/* ── STT ──────────────────────────────────────────────────────────── */}
      {tab === 'stt' && (
        <>
          <ActionBar actions={[
            { title: 'Create STT endpoint', onPress: () => openEndpointForm('stt', 'whisper') },
            { title: 'Upload & transcribe', variant: 'secondary', onPress: pickSttFile, loading: sttLoading },
          ]} />
          <Box title="Transcribe">
            <IntegrationPicker
              capability="stt"
              items={sttIntegrations}
              label="STT integration"
            />
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={S.label}>Language (optional)</Text>
                <TextInput
                  style={S.input}
                  placeholder="en"
                  placeholderTextColor={colors.textMuted}
                  value={sttLanguage}
                  onChangeText={setSttLanguage}
                  autoCapitalize="none"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={S.label}>Task</Text>
                <View style={S.pickerRow}>
                  {['transcribe', 'translate'].map((t) => (
                    <Button
                      key={t}
                      title={t}
                      variant={sttTask === t ? 'primary' : 'secondary'}
                      onPress={() => setSttTask(t)}
                      style={S.rowBtn}
                    />
                  ))}
                </View>
              </View>
            </View>
            <Button title={sttFileName ? `Transcribe: ${sttFileName}` : 'Choose audio file'} onPress={pickSttFile} loading={sttLoading} />
            {sttResult?.text != null && (
              <View style={S.resultBox}>
                <Text style={S.resultText}>{sttResult.text}</Text>
                {sttResult.language ? <Text style={S.metaText}>Language: {sttResult.language}</Text> : null}
              </View>
            )}
          </Box>
          <Box title="Configuration">
            <ConfigTable
              rows={AI_GUIDES.stt.config}
              values={{ STT_URL: sttStatus?.url, STT_MODEL: sttStatus?.model, STT_DEVICE: sttStatus?.device }}
              note={CONFIG_NOTE}
            />
          </Box>
          <ConsoleGuide title={AI_GUIDES.stt.title} steps={AI_GUIDES.stt.steps} />
          <ApiReference examples={sttApiExamples} />
        </>
      )}

      {/* ── Embeddings ───────────────────────────────────────────────────── */}
      {tab === 'embeddings' && (
        <>
          <ActionBar actions={[
            { title: 'Create embeddings endpoint', onPress: () => openEndpointForm('embeddings', 'ollama') },
            { title: 'Create embedding', variant: 'secondary', onPress: handleEmbed, loading: embedLoading },
          ]} />
          <Box title="Create embeddings">
            <IntegrationPicker
              capability="embeddings"
              items={embedIntegrations}
              label="Embeddings integration"
            />
            <Text style={S.label}>Model</Text>
            <TextInput
              style={[S.input, { marginBottom: 8 }]}
              placeholder={embedStatus?.default_model || 'mxbai-embed-large'}
              placeholderTextColor={colors.textMuted}
              value={embedModel}
              onChangeText={setEmbedModel}
              autoCapitalize="none"
            />
            <Text style={S.label}>Input (one line = one vector, multiple lines = batch)</Text>
            <TextInput
              style={[S.input, { marginBottom: 8, minHeight: 80 }]}
              placeholder="Text to embed"
              placeholderTextColor={colors.textMuted}
              value={embedInput}
              onChangeText={setEmbedInput}
              multiline
            />
            <Button title="Embed" onPress={handleEmbed} loading={embedLoading} />
            {embedResult?.embeddings && (
              <View style={S.resultBox}>
                <Text style={S.metaText}>
                  Model: {embedResult.model || embedModel} · Vectors: {embedResult.embeddings.length}
                </Text>
                {Array.isArray(embedResult.embeddings[0]) && (
                  <Text style={S.resultText}>
                    dim={embedResult.embeddings[0].length} · preview=[
                    {embedResult.embeddings[0].slice(0, 6).map((n) => n.toFixed(4)).join(', ')}
                    , …]
                  </Text>
                )}
              </View>
            )}
          </Box>
          <Box title="Configuration">
            <ConfigTable
              rows={AI_GUIDES.embeddings.config}
              values={{ EMBEDDING_MODEL: embedStatus?.default_model }}
              note={CONFIG_NOTE}
            />
          </Box>
          <ConsoleGuide title={AI_GUIDES.embeddings.title} steps={AI_GUIDES.embeddings.steps} />
          <ApiReference examples={embApiExamples} />
        </>
      )}

      {tab === 'finetunes' && (
        <>
          <Box title="LoRA adapters">
            <Text style={S.help}>Train PEFT adapters against a base LLM. Never overwrites production Ollama tags. Attach per intelligence endpoint.</Text>
            <TextInput
              style={[S.input, { marginBottom: 8 }]}
              placeholder="adapter name"
              placeholderTextColor={colors.textMuted}
              value={loraName}
              onChangeText={setLoraName}
            />
            <TextInput
              style={[S.input, { marginBottom: 8 }]}
              placeholder="intelligence name to attach"
              placeholderTextColor={colors.textMuted}
              value={loraIntelName}
              onChangeText={setLoraIntelName}
            />
            <Button
              title="Train (SKIP_LORA-safe)"
              loading={loraBusy}
              onPress={async () => {
                if (!projectId) return;
                setLoraBusy(true);
                try {
                  await aiManagerService.trainLora(projectId, { name: loraName, examples: [] });
                  setLoraAdapters(await aiManagerService.listLora(projectId));
                } catch (err) { setError(err.response?.data?.error?.message || err.message); }
                finally { setLoraBusy(false); }
              }}
            />
            <Button
              title="Refresh"
              variant="secondary"
              onPress={async () => {
                if (!projectId) return;
                setLoraAdapters(await aiManagerService.listLora(projectId).catch(() => []));
              }}
            />
            {(loraAdapters || []).map((a) => (
              <View key={a.id} style={{ marginTop: 8 }}>
                <Text style={S.rowSub}>{a.name} · {a.status} · {a.derived_model || 'no derived model yet'}</Text>
                <Button
                  title="Use on this intelligence"
                  variant="secondary"
                  onPress={async () => {
                    if (!projectId || !loraIntelName) {
                      setError('Set an intelligence name first');
                      return;
                    }
                    try {
                      await aiManagerService.attachLora(projectId, { adapter_id: a.id, intelligence: loraIntelName });
                    } catch (err) { setError(err.response?.data?.error?.message || err.message); }
                  }}
                />
              </View>
            ))}
          </Box>
        </>
      )}
      <ResourceCrud serviceName="ai_manager" enabled={!!projectId} title="AI models" />
    </ScrollView>
  );
};
