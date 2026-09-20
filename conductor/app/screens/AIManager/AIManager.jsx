import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Page, ListRow } from '../../components/ui';
import { ManagerSetupSection } from '../../components/ManagerSetupSection';
import { useProject } from '../../contexts/ProjectContext';
import { aiManagerService } from '../../services/aiManagerService';
import { DashboardStyles as S } from '../Dashboard/Dashboard.styles';

const GROUPS = [
  {
    id: 'talk',
    label: 'Talk',
    items: [
      { screen: 'aiAgents', icon: 'chatbubbles-outline', title: 'Agents', subtitle: 'ChatGPT-style window for Icarus' },
    ],
  },
  {
    id: 'fleet',
    label: 'Fleet',
    items: [
      { screen: 'aiEngines', icon: 'hardware-chip-outline', title: 'Engines', subtitle: 'Place STT, TTS, vLLM, Ollama on Orin' },
      { screen: 'aiEndpoints', icon: 'link-outline', title: 'Endpoints', subtitle: 'orin-vllm, orin-ollama, speech integrations' },
    ],
  },
  {
    id: 'serve',
    label: 'Serve',
    items: [
      { screen: 'aiLlm', icon: 'flash-outline', title: 'LLM', subtitle: 'Models, pull, playground' },
      { screen: 'aiTts', icon: 'volume-high-outline', title: 'Text to speech', subtitle: 'Kokoro / cache voices' },
      { screen: 'aiStt', icon: 'mic-outline', title: 'Speech to text', subtitle: 'Whisper transcribe' },
      { screen: 'aiEmbeddings', icon: 'git-commit-outline', title: 'Embeddings', subtitle: 'Vectors for memory and RAG' },
      { screen: 'aiBenchmarks', icon: 'speedometer-outline', title: 'Benchmarks', subtitle: 'Speed and JSON compliance' },
    ],
  },
  {
    id: 'apps',
    label: 'Apps',
    items: [
      { screen: 'aiIntelligence', icon: 'sparkles-outline', title: 'Intelligence', subtitle: 'Stable invoke ARNs for apps' },
      { screen: 'aiRag', icon: 'library-outline', title: 'RAG', subtitle: 'Document collections' },
      { screen: 'aiMemory', icon: 'heart-outline', title: 'Memory', subtitle: 'Short-term and long-term stores' },
      { screen: 'aiJobs', icon: 'hourglass-outline', title: 'Jobs', subtitle: 'Queued intelligence' },
      { screen: 'aiFinetunes', icon: 'color-wand-outline', title: 'Fine-tunes', subtitle: 'LoRA adapters' },
      { screen: 'aiAccess', icon: 'key-outline', title: 'Access', subtitle: 'App tokens and scopes' },
    ],
  },
];

export const AIManager = ({ navigation }) => {
  const { currentProject } = useProject();
  const projectId = currentProject?.id;
  const [refreshing, setRefreshing] = useState(false);
  const [agents, setAgents] = useState([]);
  const [llmUp, setLlmUp] = useState(null);

  const load = useCallback(async () => {
    if (!projectId) {
      setAgents([]);
      setLlmUp(null);
      return;
    }
    try {
      const [list, st] = await Promise.all([
        aiManagerService.listAgents(projectId).catch(() => []),
        aiManagerService.llmStatus({ projectId }).catch(() => null),
      ]);
      setAgents(list || []);
      setLlmUp(st?.reachable);
    } catch {
      setAgents([]);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const agentSub = agents.length
    ? `${agents.map((a) => a.display_name || a.name).join(', ')} · open chat`
    : 'ChatGPT-style window for Icarus';

  return (
    <Page
      title="AI Manager"
      subtitle="GPU AI on Orin. Open one thing at a time."
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <ManagerSetupSection serviceName="ai_manager" navigation={navigation} onEnabled={load} />

      {GROUPS.map((group) => (
        <View key={group.id} style={S.group}>
          <Text style={S.groupTitle}>{group.label}</Text>
          {group.items.map((item) => (
            <ListRow
              key={item.screen}
              icon={item.icon}
              title={item.title}
              subtitle={item.screen === 'aiAgents' ? agentSub : item.subtitle}
              status={item.screen === 'aiLlm' && llmUp != null ? (llmUp ? 'online' : 'offline') : undefined}
              onPress={() => navigation.navigate(item.screen)}
            />
          ))}
        </View>
      ))}
    </Page>
  );
};
