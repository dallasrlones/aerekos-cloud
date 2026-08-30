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
  { id: 'appaccess', label: 'App access', icon: 'key-outline' },
  { id: 'llm', label: 'LLM', icon: 'chatbubbles-outline' },
  { id: 'benchmarks', label: 'Benchmarks', icon: 'speedometer-outline' },
  { id: 'tts', label: 'TTS', icon: 'volume-high-outline' },
  { id: 'stt', label: 'STT', icon: 'mic-outline' },
  { id: 'embeddings', label: 'Embeddings', icon: 'layers-outline' },
];

const CONFIG_NOTE = 'Host defaults come from docker-compose.ai.yml on the GPU worker. Endpoints override per project — Ollama, dictionary TTS, Kokoro, XTTS, faster-whisper.';

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

const EMPTY_PICKS = { llm: null, tts: null, stt: null, embeddings: null };

export const AIManager = ({ navigation }) => {
  const { currentProject } = useProject();
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

  const [benchData, setBenchData] = useState(null);
  const [benchLoading, setBenchLoading] = useState(false);
  const [benchRunning, setBenchRunning] = useState(false);
  const [memoryStatus, setMemoryStatus] = useState(null);
  const [serviceInfo, setServiceInfo] = useState(null);
  const [instances, setInstances] = useState([]);

  const pollRef = useRef(null);
  const benchPollRef = useRef(null);
  const apiBase = getApiBaseUrl();

  const loadStatus = useCallback(async () => {
    try {
      const [llm, tts, stt, emb, cache] = await Promise.all([
        aiManagerService.llmStatus(),
        aiManagerService.ttsStatus().catch(() => null),
        aiManagerService.sttStatus().catch(() => null),
        aiManagerService.embedStatus().catch(() => null),
        aiManagerService.ttsCacheStats().catch(() => null),
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
  }, [ttsVoice, embedModel]);

  const loadModels = useCallback(async () => {
    setLoadingModels(true);
    try {
      const list = await aiManagerService.listModels();
      setModels(list);
      setSelectedModel((cur) => cur || (list[0] && list[0].name) || null);
    } catch (_) { setModels([]); }
    finally { setLoadingModels(false); }
  }, []);

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
    try { setPulls(await aiManagerService.listPulls()); } catch (_) {}
  }, []);

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
      setServiceInfo(await aiManagerService.info());
    } catch (_) {
      setServiceInfo(null);
    }
  }, []);

  const handleSeedLocal = async () => {
    if (!projectId) return;
    setSeeding(true);
    setError(null);
    try {
      await aiManagerService.seedLocalIntegrations(projectId);
      await loadIntegrations();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to seed local integrations');
    } finally { setSeeding(false); }
  };

  useEffect(() => {
    loadStatus();
    loadModels();
    loadPulls();
    loadVoices();
    loadIntegrations();
    loadMemoryStatus();
    loadServiceInfo();
    loadInstances();
  }, [loadStatus, loadModels, loadPulls, loadVoices, loadIntegrations, loadMemoryStatus, loadServiceInfo, loadInstances]);

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
    const jobs = [loadStatus(), loadModels(), loadPulls(), loadVoices(), loadIntegrations(), loadMemoryStatus(), loadServiceInfo(), loadInstances()];
    if (tab === 'benchmarks') jobs.push(loadBenchmarks());
    await Promise.all(jobs);
    setRefreshing(false);
  };

  const confirmDelete = (name) => {
    const run = async () => {
      try {
        await aiManagerService.deleteModel(name);
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
      await aiManagerService.pullModel(name);
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

  const handleGenerate = async () => {
    const prompt = genPrompt.trim();
    if (!prompt || !selectedModel) return;
    setGenLoading(true); setError(null);
    try {
      const res = await aiManagerService.generate({ model: selectedModel, prompt }, integrationRoute('llm'));
      setGenResult(res?.response || res?.message?.content || JSON.stringify(res));
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Generate failed');
    } finally { setGenLoading(false); }
  };

  const handleSend = async () => {
    const content = chatInput.trim();
    if (!content || !selectedModel) return;
    const next = [...messages, { role: 'user', content }];
    setMessages(next);
    setChatInput('');
    setSending(true); setError(null);
    try {
      const res = await aiManagerService.chat({ model: selectedModel, messages: next }, integrationRoute('llm'));
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
            { title: 'Pull model', onPress: () => { setTab('llm'); setLlmSub('models'); } },
            { title: 'Chat', variant: 'secondary', onPress: () => { setTab('llm'); setLlmSub('playground'); } },
            { title: 'Endpoints', variant: 'secondary', onPress: () => setTab('endpoints') },
            { title: 'Benchmarks', variant: 'secondary', onPress: () => setTab('benchmarks') },
          ]} />
          <Box title="GPU fleet backend">
            {status ? (
              <View style={S.statusGrid}>
                <View style={S.statusCell}>
                  <Text style={S.statusLabel}>Ollama</Text>
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
                  <Text style={S.statusLabel}>GPU / mode</Text>
                  <Text style={S.statusValue}>{status.gpu ? `gpu:${status.gpu}` : '—'} · {status.mode || 'external'}</Text>
                </View>
                <View style={S.statusCell}>
                  <Text style={S.statusLabel}>Models on disk</Text>
                  <Text style={S.statusValue}>{status.model_count ?? models.length} total · {chatModels.length} chat · {embedModels.length} embed</Text>
                </View>
                <View style={S.statusCell}>
                  <Text style={S.statusLabel}>Default embed</Text>
                  <Text style={S.statusValue}>{embedStatus?.default_model || '—'}</Text>
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
              <Text style={S.hintText}>No chat models found on Ollama. Pull one from the LLM tab.</Text>
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
                <Text style={S.hintText}>Setup local fleet registers Orin Ollama, embeddings, TTS, and STT in one click.</Text>
                <Button title="Setup local fleet" onPress={handleSeedLocal} loading={seeding} style={{ marginTop: 12 }} />
              </View>
            ) : (
              <>
                <View style={S.statusGrid}>
                  {[
                    ['LLM', endpointCounts.llm],
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
            { title: 'Add endpoint', variant: 'secondary', onPress: () => navigation.navigate('aiProviderForm', {}) },
            { title: 'App access', variant: 'secondary', onPress: () => setTab('appaccess') },
          ]} />
          <Box title="AI endpoints">
            {!projectId ? (
              <Text style={S.hintText}>Select a project to register Ollama, TTS, and STT endpoints on your fleet.</Text>
            ) : loadingIntegrations ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : integrations.length === 0 ? (
              <View style={S.emptyState}>
                <Ionicons name="link-outline" size={40} color={colors.textMuted} />
                <Text style={S.emptyText}>No endpoints yet. Setup local fleet registers Orin Ollama, TTS, and STT.</Text>
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
            resources={integrations.filter((i) => i.name).map((p) => {
              const arn = p.arn || `arn:aerekos:${projectId}:ai:${p.capability || 'llm'}:endpoint/${p.name}`;
              return {
                id: p.id,
                name: p.name,
                arn,
                prettyUrl: buildPrettyUrl(apiBase, AI_ACCESS?.prettyPreset?.(p, projectId)),
              };
            })}
            scopes={AI_ACCESS?.scopes || []}
            defaultScopes={AI_ACCESS?.defaultScopes || ['ai:InvokeLlm']}
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
            { title: 'Pull model', onPress: () => setLlmSub('models'), loading: pulling },
            { title: 'Open chat', variant: 'secondary', onPress: () => setLlmSub('playground'), disabled: !selectedModel },
            { title: 'Generate', variant: 'secondary', onPress: () => setLlmSub('playground') },
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
              <Box title="Ollama backend">
                {status ? (
                  <View style={S.statusGrid}>
                    <View style={S.statusCell}>
                      <Text style={S.statusLabel}>Status</Text>
                      <View style={[S.rowInline, { marginTop: 2 }]}>
                        <View style={[S.dot, { backgroundColor: dotColor }]} />
                        <Text style={S.statusValue}>{reachable ? 'Reachable' : 'Unreachable'}</Text>
                      </View>
                    </View>
                    <View style={S.statusCell}>
                      <Text style={S.statusLabel}>Mode</Text>
                      <Text style={S.statusValue}>{status.mode}{status.gpu ? ` · gpu:${status.gpu}` : ''}</Text>
                    </View>
                    <View style={S.statusCell}>
                      <Text style={S.statusLabel}>Version</Text>
                      <Text style={S.statusValue}>{status.version || '—'}</Text>
                    </View>
                    <View style={S.statusCell}>
                      <Text style={S.statusLabel}>Models</Text>
                      <Text style={S.statusValue}>{status.model_count ?? models.length}</Text>
                    </View>
                  </View>
                ) : <ActivityIndicator size="small" color={colors.primary} />}
              </Box>
              <Box title="Models">
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
                    <Text style={S.emptyText}>No models. Click Pull model above.</Text>
                    <Button title="Pull llama3.2:3b" onPress={() => handlePull('llama3.2:3b')} style={{ marginTop: 12 }} />
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
                          <Button
                            title="Delete"
                            variant="secondary"
                            onPress={() => confirmDelete(m.name)}
                            style={S.rowBtn}
                          />
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
                {!selectedModel ? (
                  <>
                    <Text style={S.hintText}>Select a model on the Models tab first.</Text>
                    <Button title="Go to models" onPress={() => setLlmSub('models')} style={{ marginTop: 8, alignSelf: 'flex-start' }} />
                  </>
                ) : (
                  <>
                    <IntegrationPicker
                      capability="llm"
                      items={llmIntegrations}
                      label="LLM integration"
                    />
                    <Text style={S.metaText}>Model: {selectedModel}</Text>
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
                <Button title="Generate" onPress={handleGenerate} loading={genLoading} disabled={!selectedModel} />
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
            label="Ollama integration"
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
            { title: 'Synthesize', onPress: handleTts, loading: ttsLoading },
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
            { title: 'Upload & transcribe', onPress: pickSttFile, loading: sttLoading },
            { title: 'Transcribe', variant: 'secondary', onPress: pickSttFile, loading: sttLoading },
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
            { title: 'Create embedding', onPress: handleEmbed, loading: embedLoading },
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
    </ScrollView>
  );
};
