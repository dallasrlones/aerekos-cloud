import React, { useState, useEffect, useCallback } from 'react';
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
import { ModelSelect } from '../../components/ModelSelect/ModelSelect';
import websocketService from '../../services/websocketService';
import { applyPullEvent, applyBenchEvent } from '../../utils/liveEvents';
import { ScreenTabs } from '../../components/ScreenTabs/ScreenTabs';
import { AgentsWorkspace } from './AgentsWorkspace';

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

const SECTION_SCREENS = {
  engines: 'aiEngines',
  endpoints: 'aiEndpoints',
  llm: 'aiLlm',
  tts: 'aiTts',
  stt: 'aiStt',
  embeddings: 'aiEmbeddings',
  benchmarks: 'aiBenchmarks',
  intelligence: 'aiIntelligence',
  rag: 'aiRag',
  memory: 'aiMemory',
  jobs: 'aiJobs',
  finetunes: 'aiFinetunes',
  appaccess: 'aiAccess',
  agents: 'aiAgents',
};
const SERVE_TABS = [
  { id: 'endpoints', label: 'Endpoints' },
  { id: 'llm', label: 'LLM' },
  { id: 'tts', label: 'TTS' },
  { id: 'stt', label: 'STT' },
  { id: 'embeddings', label: 'Embeddings' },
  { id: 'benchmarks', label: 'Benchmarks' },
];
const INTEL_TABS = [
  { id: 'intelligence', label: 'Endpoints' },
  { id: 'rag', label: 'RAG' },
  { id: 'memory', label: 'Memory' },
  { id: 'jobs', label: 'Jobs' },
];
function sectionOf(tab) {
  if (SERVE_TABS.some((t) => t.id === tab)) return 'serve';
  if (INTEL_TABS.some((t) => t.id === tab)) return 'intelligence';
  return tab;
}

const CONFIG_NOTE = 'Place engines on GPU workers here. Apps call Cloud integrations (orin-vllm, orin-stt, …). Do not install Ollama or voice stacks on the host — docker run the worker, then Place.';

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

const TITLES = {
  engines: 'Engines',
  endpoints: 'Endpoints',
  llm: 'LLM',
  tts: 'TTS',
  stt: 'STT',
  embeddings: 'Embeddings',
  benchmarks: 'Benchmarks',
  intelligence: 'Intelligence',
  rag: 'RAG',
  memory: 'Memory',
  jobs: 'Jobs',
  finetunes: 'Fine-tunes',
  appaccess: 'Access',
};

export function AIManagerStudio({ navigation, route }) {
  const { currentProject, loading: projectsLoading } = useProject();
  const projectId = currentProject?.id;
  const initial = route?.params?.section || 'llm';

  const [tab, setTab] = useState(initial);
  useEffect(() => { setTab(initial); }, [initial]);
  const goSection = (id) => {
    const screen = SECTION_SCREENS[id];
    if (screen) navigation.navigate(screen);
  };
  const [intelJobs, setIntelJobs] = useState([]);
  const [jobSnap, setJobSnap] = useState(null);
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
  const [cacheStats, setCacheStats] = useState(null);
  const [models, setModels] = useState([]);
  const [voices, setVoices] = useState([]);
  const [pulls, setPulls] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [error, setError] = useState(null);
  const [engines, setEngines] = useState([]);
  const [engineWorkers, setEngineWorkers] = useState([]);
  const [engineCatalog, setEngineCatalog] = useState([]);
  const [engineKind, setEngineKind] = useState('stt');
  const [engineWorkerId, setEngineWorkerId] = useState('');
  const [engineBusy, setEngineBusy] = useState(false);

  const [pullName, setPullName] = useState('');
  const [pulling, setPulling] = useState(false);
  const [hfLoadName, setHfLoadName] = useState('');

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
  const [accessAgents, setAccessAgents] = useState([]);
  const [accessConnectors, setAccessConnectors] = useState([]);
  const [serviceInfo, setServiceInfo] = useState(null);
  const [instances, setInstances] = useState([]);

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
    if (!projectId) { setIntelligence([]); setRagCollections([]); setMemoryStores([]); setAccessAgents([]); setAccessConnectors([]); return; }
    try {
      const [intel, rag, mem, ag, conn] = await Promise.all([
        aiManagerService.listIntelligence(projectId),
        aiManagerService.listRag(projectId),
        aiManagerService.listMemoryStores(projectId).catch(() => []),
        aiManagerService.listAgents(projectId).catch(() => []),
        aiManagerService.listConnectors(projectId).catch(() => []),
      ]);
      setIntelligence(intel);
      setRagCollections(rag);
      setMemoryStores(mem);
      setAccessAgents(ag);
      setAccessConnectors(conn);
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

  const loadEngines = useCallback(async () => {
    try {
      const data = await aiManagerService.listEngines({ projectId });
      setEngines(data?.engines || []);
      setEngineWorkers(data?.workers || []);
      setEngineCatalog(data?.catalog || []);
      if (!engineWorkerId && data?.workers?.length) {
        setEngineWorkerId(data.workers[0].id);
      }
    } catch (_) {
      setEngines([]);
    }
  }, [engineWorkerId, projectId]);

  const handlePlaceEngine = async () => {
    if (!engineKind || !engineWorkerId) return;
    setEngineBusy(true);
    setError(null);
    try {
      await aiManagerService.placeEngine({ kind: engineKind, worker_id: engineWorkerId }, { projectId });
      await loadEngines();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Place failed');
    } finally {
      setEngineBusy(false);
    }
  };

  const handleEngineAction = async (id, action) => {
    setEngineBusy(true);
    setError(null);
    try {
      if (action === 'start') await aiManagerService.startEngine(id, { projectId });
      else await aiManagerService.stopEngine(id, { projectId });
      await loadEngines();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Engine action failed');
    } finally {
      setEngineBusy(false);
    }
  };

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
    const room = projectId ? `ai:live:${projectId}` : 'ai:live';
    websocketService.subscribeRoom(room, { projectId });
    const offPull = websocketService.on('ai:pull', (payload) => {
      const next = payload?.pull;
      setPulls((prev) => applyPullEvent(prev, payload));
      if (next?.status === 'success') loadModels();
    });
    const offBench = websocketService.on('ai:bench', (payload) => {
      setBenchData((prev) => applyBenchEvent(prev, payload));
      const status = payload?.run?.status;
      setBenchRunning(status === 'running');
      if (status === 'idle' || status === 'error') loadBenchmarks();
    });
    const offJob = websocketService.on('ai:job', (payload) => {
      if (payload?.job) {
        setIntelJobs((prev) => {
          const rest = (prev || []).filter((j) => j.id !== payload.job.id);
          return [payload.job, ...rest];
        });
        setJobSnap((cur) => (cur && cur.id === payload.job.id ? { ...cur, ...payload.job } : cur));
      }
    });
    const offToken = websocketService.on('ai:job.token', (payload) => {
      if (!payload?.job_id) return;
      setJobSnap((cur) => (cur && cur.id === payload.job_id ? { ...cur, partial: payload.partial || cur.partial } : cur));
    });
    const offReconnect = websocketService.on('console:reconnected', () => {
      loadPulls();
      if (tab === 'benchmarks') loadBenchmarks();
    });
    return () => {
      offPull();
      offBench();
      offJob();
      offToken();
      offReconnect();
      websocketService.unsubscribeRoom(room);
    };
  }, [loadPulls, loadModels, loadBenchmarks, tab, projectId]);

  useEffect(() => {
    if (tab === 'benchmarks') loadBenchmarks();
  }, [tab, integrationPick.llm, loadBenchmarks]);

  useEffect(() => {
    if (tab !== 'finetunes' || !projectId) return;
    aiManagerService.listLora(projectId).then(setLoraAdapters).catch(() => setLoraAdapters([]));
  }, [tab, projectId]);

  useEffect(() => {
    if (tab === 'engines') loadEngines();
  }, [tab, loadEngines]);

  useEffect(() => {
    if ((tab !== 'jobs' && tab !== 'agents' && tab !== 'appaccess') || !projectId) return;
    aiManagerService.listIntelligenceJobs(projectId).then(setIntelJobs).catch(() => setIntelJobs([]));
    if (tab === 'appaccess' || tab === 'agents') loadIntelligence();
  }, [tab, projectId, loadIntelligence]);

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
    const jobs = [loadStatus(), loadModels(), loadPulls(), loadVoices(), loadIntegrations(), loadMemoryStatus(), loadServiceInfo(), loadInstances(), loadIntelligence(), loadEngines()];
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

  const handleLoadVllm = async () => {
    const name = hfLoadName.trim();
    if (!name || !selectedLlm?.id) return;
    setPulling(true); setError(null);
    try {
      const applied = await aiManagerService.applyVllm(projectId, selectedLlm.id, { model: name });
      if (applied?.left_stopped) {
        setError(applied.message || 'vLLM left stopped');
      }
      await loadModels();
      await loadIntegrations();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load vLLM model');
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
      <TouchableOpacity style={S.breadcrumb} onPress={() => navigation.navigate('aiManager')} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
        <Text style={S.hintText}>AI Manager</Text>
      </TouchableOpacity>
      <Text style={S.title}>{TITLES[tab] || TITLES[initial] || 'AI Manager'}</Text>
      {(projectsLoading || !projectId) ? (
        <Text style={S.hintText}>
          {projectsLoading ? 'Loading project…' : 'Select a project in the header to load fleet details.'}
        </Text>
      ) : null}

      {sectionOf(tab) === 'serve' ? (
        <ScreenTabs tabs={SERVE_TABS} active={tab} onChange={goSection} />
      ) : null}
      {sectionOf(tab) === 'intelligence' ? (
        <ScreenTabs tabs={INTEL_TABS} active={tab === 'rag' || tab === 'memory' || tab === 'jobs' ? tab : 'intelligence'} onChange={goSection} />
      ) : null}

      {error && <Box style={S.errorBox}><Text style={S.errorText}>{error}</Text></Box>}

      {/* ── Overview ─────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <>
          <ActionBar actions={[
            ...(projectId && integrations.length === 0 ? [{ title: 'Setup local fleet', onPress: handleSeedLocal, loading: seeding }] : []),
            { title: 'Engines', variant: 'secondary', onPress: () => goSection('engines') },
            { title: 'Serve', variant: 'secondary', onPress: () => goSection('llm') },
            { title: 'Intelligence', variant: 'secondary', onPress: () => goSection('intelligence') },
            { title: 'Agents', variant: 'secondary', onPress: () => goSection('agents') },
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
              <TouchableOpacity style={S.quickCard} onPress={() => goSection('llm')} activeOpacity={0.8}>
                <Text style={S.quickCardTitle}>LLM models</Text>
                <Text style={S.quickCardMeta}>{models.length} installed · {status?.reachable ? 'online' : 'offline'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={S.quickCard} onPress={() => goSection('tts')} activeOpacity={0.8}>
                <Text style={S.quickCardTitle}>TTS dictionary</Text>
                <Text style={S.quickCardMeta}>
                  {cacheStats?.cached_words != null ? `${cacheStats.cached_words.toLocaleString()} words` : '—'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={S.quickCard} onPress={() => goSection('tts')} activeOpacity={0.8}>
                <Text style={S.quickCardTitle}>TTS voices</Text>
                <Text style={S.quickCardMeta}>{voices.length} available · {ttsStatus?.backend || 'cache'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={S.quickCard} onPress={() => goSection('embeddings')} activeOpacity={0.8}>
                <Text style={S.quickCardTitle}>Embeddings</Text>
                <Text style={S.quickCardMeta}>{embedStatus?.default_model || '—'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={S.quickCard} onPress={() => goSection('benchmarks')} activeOpacity={0.8}>
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
              <TouchableOpacity onPress={() => goSection('llm')}>
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
                <TouchableOpacity
                  key={m.name}
                  style={S.row}
                  onPress={() => navigation.navigate('aiModelDetails', { modelName: m.name })}
                  activeOpacity={0.8}
                >
                  <View style={S.rowMain}>
                    <Text style={S.rowName}>{m.name}</Text>
                    <Text style={S.rowSub}>
                      {modelMetaLine(m)}
                      {embedStatus?.default_model === m.name ? ' · default' : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>
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
                  <TouchableOpacity onPress={() => goSection('endpoints')}>
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

      {tab === 'engines' && (
        <>
          <ActionBar actions={[
            { title: 'Place on device', onPress: handlePlaceEngine, loading: engineBusy },
            { title: 'Refresh', variant: 'secondary', onPress: loadEngines },
          ]} />
          <Box title="Place">
            <Text style={S.hintText}>
              Pick an engine and a GPU worker. vLLM, XTTS, and Ollama never start unless you hit Start. Apps keep calling the same orin-* integrations.
            </Text>
            <Text style={[S.statusLabel, { marginTop: spacing.md }]}>Engine</Text>
            <View style={S.rowInline}>
              {(engineCatalog.length ? engineCatalog : [{ kind: 'stt', label: 'Whisper STT' }]).map((c) => (
                <TouchableOpacity
                  key={c.kind}
                  style={[S.selectChip, engineKind === c.kind && S.selectChipActive]}
                  onPress={() => setEngineKind(c.kind)}
                >
                  <Text style={S.selectChipText}>{c.label || c.kind}{c.auto_start === false ? ' · no auto' : ''}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[S.statusLabel, { marginTop: spacing.md }]}>Device</Text>
            <View style={S.rowInline}>
              {engineWorkers.map((w) => (
                <TouchableOpacity
                  key={w.id}
                  style={[S.selectChip, engineWorkerId === w.id && S.selectChipActive]}
                  onPress={() => setEngineWorkerId(w.id)}
                >
                  <Text style={S.selectChipText}>{w.display_name || w.hostname || w.id.slice(0, 8)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Box>
          <Box title="Placed engines">
            {engines.length === 0 ? (
              <Text style={S.emptyText}>None yet. Place Whisper or Kokoro on a worker, or refresh to seed what is already running on Orin.</Text>
            ) : engines.map((eng) => (
              <View key={eng.id} style={S.row}>
                <View style={S.rowMain}>
                  <Text style={S.rowName}>{eng.kind}</Text>
                  <Text style={S.rowSub}>
                    {eng.status} · {eng.worker_hostname || eng.worker_id?.slice(0, 8)} · {eng.container_name}
                    {eng.endpoint ? ` · ${eng.endpoint}` : ''}
                    {eng.auto_start === false ? ' · start is explicit' : ''}
                  </Text>
                </View>
                <View style={S.modelActions}>
                  {eng.status === 'running' ? (
                    <Button title="Stop" variant="secondary" onPress={() => handleEngineAction(eng.id, 'stop')} disabled={engineBusy} />
                  ) : (
                    <Button title="Start" onPress={() => handleEngineAction(eng.id, 'start')} disabled={engineBusy || !eng.container_name} />
                  )}
                </View>
              </View>
            ))}
          </Box>
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

      {tab === 'agents' && (
        <AgentsWorkspace projectId={projectId} jobs={intelJobs} navigation={navigation} />
      )}

      {(tab === 'intelligence' || tab === 'rag' || tab === 'memory' || tab === 'jobs') && (
        <>
          <ActionBar actions={[
            { title: 'Create intelligence', onPress: () => navigation.navigate('aiIntelligenceForm', {}) },
            { title: 'Create RAG', variant: 'secondary', onPress: () => navigation.navigate('aiRagForm', {}) },
            { title: 'Create memory', variant: 'secondary', onPress: () => navigation.navigate('aiMemoryForm', {}) },
          ]} />
          {tab === 'intelligence' ? <Box title="Intelligence endpoints">
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
          </Box> : null}
          {tab === 'rag' ? <Box title="RAG collections">
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
          </Box> : null}
          {tab === 'memory' ? <Box title="Memory stores">
            {memoryStores.length === 0 ? (
              <Text style={S.hintText}>No stores. Create one to attach to intelligence endpoints.</Text>
            ) : memoryStores.map((m) => (
              <TouchableOpacity
                key={m.id || m.name}
                style={S.row}
                onPress={() => navigation.navigate('aiMemoryForm', m.id ? { memoryId: m.id } : {})}
                activeOpacity={0.8}
              >
                <View style={S.rowMain}>
                  <Text style={S.rowName}>{m.name}</Text>
                  <Text style={S.rowSub}>{m.status || 'draft'} · {m.arn || '—'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
            <Button
              title="Create memory store"
              variant="secondary"
              onPress={() => navigation.navigate('aiMemoryForm', {})}
              style={{ marginTop: 12, alignSelf: 'flex-start' }}
            />
          </Box> : null}
          {tab === 'jobs' ? (
            <Box title="Jobs">
              <Text style={S.hintText}>Poll is source of truth. Cancel stops queued or running jobs.</Text>
              {(intelJobs || []).length === 0 ? <Text style={S.hintText}>No jobs yet.</Text> : null}
              {(intelJobs || []).map((j) => (
                <TouchableOpacity
                  key={j.id}
                  style={S.row}
                  onPress={() => setJobSnap(j)}
                  activeOpacity={0.8}
                >
                  <View style={S.rowMain}>
                    <Text style={S.rowName}>{j.intelligence} · {j.status}</Text>
                    <Text style={S.rowSub}>{j.created_at || j.id}</Text>
                  </View>
                  {['queued', 'running'].includes(j.status) ? (
                    <Button title="Cancel" variant="secondary" onPress={() => aiManagerService.cancelIntelligenceJob(projectId, j.id).then((next) => {
                      setIntelJobs((prev) => prev.map((x) => (x.id === next.id ? next : x)));
                    }).catch((err) => setError(err.response?.data?.error?.message || err.message))} />
                  ) : null}
                </TouchableOpacity>
              ))}
              {jobSnap ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={S.rowName}>{jobSnap.status}</Text>
                  <Text style={S.hintText} selectable>{jobSnap.partial || jobSnap.error || JSON.stringify(jobSnap.result || {}, null, 2)}</Text>
                </View>
              ) : null}
            </Box>
          ) : null}
        </>
      )}

      {/* ── App access ───────────────────────────────────────────────────── */}
      {tab === 'appaccess' && (
        <>
          <ActionBar actions={[
            { title: 'Endpoints', variant: 'secondary', onPress: () => goSection('endpoints') },
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
              ...accessAgents.filter((i) => i.name).map((p) => ({
                id: p.id,
                name: p.name,
                arn: p.arn,
                prettyUrl: buildPrettyUrl(apiBase, AI_ACCESS?.prettyPreset?.({ ...p, capability: 'agent' }, projectId)),
              })),
              ...accessConnectors.filter((i) => i.name).map((p) => ({
                id: p.id,
                name: p.name,
                arn: p.arn,
                prettyUrl: buildPrettyUrl(apiBase, AI_ACCESS?.prettyPreset?.({ ...p, capability: 'connector' }, projectId)),
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
                      vLLM serves one Hugging Face model at a time. Load a new id to recreate aerekos-vllm (leave stopped on exit 1/137). Pull/delete are Ollama-only.
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
                <ModelSelect
                  models={models}
                  value={selectedModel || ''}
                  onChange={setSelectedModel}
                  placeholder="Select served model"
                />
                {!llmIsVllm ? (
                <View style={S.pullRow}>
                  <TextInput
                    style={S.input}
                    placeholder="Pull Ollama tag"
                    placeholderTextColor={colors.textMuted}
                    value={pullName}
                    onChangeText={setPullName}
                    autoCapitalize="none"
                    onSubmitEditing={handlePull}
                  />
                  <Button title="Pull model" onPress={handlePull} loading={pulling} style={S.pullBtn} />
                </View>
                ) : (
                <View style={S.pullRow}>
                  <TextInput
                    style={S.input}
                    placeholder="Load Hugging Face id"
                    placeholderTextColor={colors.textMuted}
                    value={hfLoadName}
                    onChangeText={setHfLoadName}
                    autoCapitalize="none"
                    onSubmitEditing={handleLoadVllm}
                  />
                  <Button title="Load" onPress={handleLoadVllm} loading={pulling} style={S.pullBtn} disabled={!selectedLlm?.id} />
                </View>
                )}
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
                    {!llmIsVllm ? null : selectedLlm ? (
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
                  <TouchableOpacity
                    key={`${row.model}-${row.benchmarked_at}`}
                    style={S.row}
                    onPress={() => navigation.navigate('aiModelDetails', { modelName: row.model })}
                    activeOpacity={0.8}
                  >
                    <View style={S.rowMain}>
                      <Text style={S.rowName} numberOfLines={1}>{row.model}</Text>
                      <Text style={S.rowSub} numberOfLines={1}>
                        {row.pass ? 'PASS' : `FAIL · ${row.reason || '?'}`}
                        {row.wall_ms != null ? ` · ${row.wall_ms}ms` : ''}
                        {row.parameter_size ? ` · ${row.parameter_size}` : ''}
                      </Text>
                    </View>
                    <View style={[S.dot, { backgroundColor: row.pass ? colors.success : colors.error }]} />
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
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
          <ActionBar actions={[
            { title: 'Train adapter', onPress: () => navigation.navigate('aiLoraForm', {}) },
            { title: 'Refresh', variant: 'secondary', onPress: async () => {
              if (!projectId) return;
              setLoraAdapters(await aiManagerService.listLora(projectId).catch(() => []));
            } },
          ]} />
          <Box title="LoRA adapters">
            <Text style={S.hintText}>Train PEFT adapters against a base LLM. Never overwrites production Ollama tags. Attach per intelligence endpoint.</Text>
            {(loraAdapters || []).length === 0 ? (
              <Text style={S.hintText}>None yet. Train an adapter to open its details screen.</Text>
            ) : (loraAdapters || []).map((a) => (
              <TouchableOpacity
                key={a.id}
                style={S.row}
                onPress={() => navigation.navigate('aiLoraForm', { loraId: a.id })}
                activeOpacity={0.8}
              >
                <View style={S.rowMain}>
                  <Text style={S.rowName}>{a.name}</Text>
                  <Text style={S.rowSub}>{a.status} · {a.derived_model || 'no derived model yet'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </Box>
        </>
      )}
      {tab === 'llm' ? (
        <ResourceCrud serviceName="ai_manager" enabled={!!projectId} title="AI models" />
      ) : null}
    </ScrollView>
  );
};
