import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, useWindowDimensions,
} from 'react-native';
import { Button } from '../../components/Button/Button';
import { useProject } from '../../contexts/ProjectContext';
import { AgentChat } from '../AIManager/AgentChat';
import { AIManagerStudio } from '../AIManager/AIManagerStudio';
import { IcarusGraph3D } from './IcarusGraph3D';
import { IcarusNodeDetail } from './IcarusNodeDetail';
import {
  IcarusSkillsDrawer,
  IcarusFriendsDrawer,
  IcarusConnectorsDrawer,
  IcarusCronDrawer,
  IcarusAdvancedDrawer,
} from './IcarusDrawers';
import { useIcarusSession } from './useIcarusSession';
import { IcarusStyles as S } from './Icarus.styles';
import { colors, typography } from '../../styles/theme';

const PRIMARY = [
  { id: 'chat', label: 'Chat', screen: 'icarus' },
  { id: 'fleet', label: 'Fleet', screen: 'icarusFleet' },
  { id: 'models', label: 'Models', screen: 'icarusModels' },
  { id: 'apps', label: 'Apps', screen: 'icarusApps' },
];

const DRAWERS = [
  { id: 'skills', label: 'Skills', screen: 'icarusSkills' },
  { id: 'friends', label: 'Friends', screen: 'icarusFriends' },
  { id: 'connectors', label: 'Connectors', screen: 'icarusConnectors' },
  { id: 'cron', label: 'Cron', screen: 'icarusCron' },
  { id: 'advanced', label: 'Advanced', screen: 'icarusAdvanced' },
];

const MODELS_TABS = [
  { id: 'llm', label: 'LLM' },
  { id: 'tts', label: 'TTS' },
  { id: 'stt', label: 'STT' },
  { id: 'embeddings', label: 'Embeddings' },
  { id: 'benchmarks', label: 'Bench' },
];

const APPS_TABS = [
  { id: 'intelligence', label: 'Intelligence' },
  { id: 'rag', label: 'RAG' },
  { id: 'memory', label: 'App memory' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'finetunes', label: 'Fine-tunes' },
  { id: 'appaccess', label: 'Access' },
];

const FLEET_TABS = [
  { id: 'engines', label: 'Engines' },
  { id: 'endpoints', label: 'Endpoints' },
];

function sectionFromRoute(route) {
  const p = route?.params || {};
  if (p.section) return p.section;
  return 'chat';
}

export function IcarusShell({ navigation, route }) {
  const { currentProject, loading } = useProject();
  const projectId = currentProject?.id;
  const section = sectionFromRoute(route);
  const tab = route?.params?.tab;
  const { width } = useWindowDimensions();
  const compact = width < 900;
  const session = useIcarusSession(projectId);

  const brainLabel = useMemo(() => {
    const g = session.gateway;
    if (!g) return null;
    return g.model || g.name || g.endpoint || g.host || null;
  }, [session.gateway]);

  const go = (screen, params = {}) => {
    navigation?.navigate(screen, params);
  };

  const rail = (
    <View style={[S.rail, compact && { width: 112 }]}>
      <Text style={S.railBrand}>Icarus</Text>
      <View style={S.projectChip}>
        <Text style={S.projectChipText} numberOfLines={1}>
          {loading ? 'Loading…' : (currentProject?.name || currentProject?.slug || 'Select project')}
        </Text>
      </View>
      {PRIMARY.map((item) => {
        const active = section === item.id;
        return (
          <TouchableOpacity
            key={item.id}
            style={[S.railItem, active && S.railItemActive]}
            onPress={() => go(item.screen)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={S.railItemText}>{item.label}</Text>
              {item.id === 'chat' && session.openAsks?.length ? (
                <View style={S.askBadge}>
                  <Text style={S.askBadgeText}>{session.openAsks.length}</Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
        );
      })}
      <Text style={S.railGroup}>More</Text>
      {DRAWERS.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={[S.railItem, section === item.id && S.railItemActive]}
          onPress={() => go(item.screen)}
        >
          <Text style={S.railItemText}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const banners = (
    <View>
      {!projectId && !loading ? (
        <View style={S.banner}>
          <Text style={S.bannerText}>Select a project in the header — Icarus always talks in the current project.</Text>
        </View>
      ) : null}
      {session.brainOffline ? (
        <View style={[S.banner, S.bannerDanger]}>
          <Text style={[S.bannerText, S.bannerDangerText]}>
            Icarus brain offline (Orin/dev). Chat will hang until the fleet LLM path is reachable.
          </Text>
        </View>
      ) : null}
      {session.needsSetup || (!session.agent && projectId && !loading) ? (
        <View style={S.banner}>
          <Text style={S.bannerText}>No Icarus agent in this project yet.</Text>
          <Button
            title="Setup Icarus"
            onPress={() => session.runSetup('icarus')}
            loading={session.busy}
            style={{ alignSelf: 'flex-start', marginTop: 8 }}
          />
        </View>
      ) : null}
      {session.handoff ? (
        <View style={S.banner}>
          <Text style={S.bannerText}>{session.handoff.label || 'talking to manager…'}</Text>
        </View>
      ) : null}
      {session.error ? (
        <View style={[S.banner, S.bannerDanger]}>
          <Text style={[S.bannerText, S.bannerDangerText]}>{session.error}</Text>
        </View>
      ) : null}
      {brainLabel && section === 'chat' ? (
        <View style={[S.banner, { backgroundColor: colors.surface }]}>
          <Text style={[S.bannerText, { color: colors.textMuted }]}>Brain: {brainLabel}</Text>
        </View>
      ) : null}
    </View>
  );

  const chatView = session.agent ? (
    <View style={S.chatSplit}>
      <View style={S.chatCol}>
        {(session.agents || []).length > 0 ? (
          <ScrollView horizontal style={S.threadList} showsHorizontalScrollIndicator={false}>
            {session.agents.map((a) => (
              <TouchableOpacity
                key={a.id}
                onPress={() => session.selectAgent(a)}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  marginRight: 6,
                  borderRadius: 8,
                  backgroundColor: session.agent?.id === a.id ? colors.border : 'transparent',
                }}
              >
                <Text style={typography.caption}>{a.display_name || a.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}
        <AgentChat
          agent={session.agent}
          agents={session.agents}
          messages={session.messages}
          asks={session.asks}
          chatInput={session.chatInput}
          setChatInput={session.setChatInput}
          busy={session.busy}
          stream={session.stream}
          gateway={session.gateway}
          holding={session.holding}
          onSelectAgent={session.selectAgent}
          onSend={session.sendChat}
          onInterrupt={session.interrupt}
          onVoice={session.sendVoice}
          onApprove={session.approve}
          onMode={session.setMode}
          onOpenBoard={(link) => session.setSelectedNode(link)}
        />
      </View>
      <View style={S.graphCol}>
        <IcarusGraph3D
          subgraph={session.liveGraph}
          workers={session.workers}
          selectedId={session.selectedNode?.id}
          onSelect={(n) => session.setSelectedNode(n)}
        />
        {session.selectedNode ? (
          <IcarusNodeDetail
            projectId={projectId}
            node={session.selectedNode}
            agents={session.agents}
            workers={session.workers}
            asks={session.asks}
            messages={session.messages}
            liveTools={session.liveTools}
            liveGraph={session.liveGraph}
            onClose={session.clearSelectedNode}
            onSelectChild={(n) => session.setSelectedNode(n)}
            onFocusChat={(n) => session.selectAgent(n)}
            onShowRelatedChat={() => {
              go('icarus');
            }}
          />
        ) : null}
      </View>
    </View>
  ) : (
    <View style={S.sectionBody}>
      <Text style={S.sectionTitle}>Chat</Text>
      <Text style={S.sectionSub}>
        {loading || !projectId
          ? 'Pick a project to talk to Icarus.'
          : 'Setup Icarus to start the sacred talk path (hey → friend, do-work → manager).'}
      </Text>
    </View>
  );

  const studio = (defaultSection, tabs) => (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <Text style={S.sectionTitle}>
          {section === 'fleet' ? 'Fleet' : section === 'models' ? 'Models' : 'Apps'}
        </Text>
        <Text style={S.sectionSub}>
          {section === 'fleet'
            ? 'Where the brain runs — place GPU engines and seed endpoints.'
            : section === 'models'
              ? 'Pull, playground, voices, transcribe, vectors, and bench.'
              : 'Intelligence ARNs, RAG, app memory stores, jobs, LoRA, and access.'}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          {(tabs || []).map((t) => (
            <TouchableOpacity
              key={t.id}
              onPress={() => go(
                section === 'fleet' ? 'icarusFleet' : section === 'models' ? 'icarusModels' : 'icarusApps',
                { tab: t.id },
              )}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                marginRight: 6,
                borderRadius: 8,
                backgroundColor: (tab || defaultSection) === t.id ? colors.border : 'transparent',
              }}
            >
              <Text style={typography.caption}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      <AIManagerStudio
        navigation={navigation}
        route={{ params: { section: tab || defaultSection } }}
      />
    </View>
  );

  let body = chatView;
  if (section === 'fleet') body = studio('engines', FLEET_TABS);
  else if (section === 'models') body = studio('llm', MODELS_TABS);
  else if (section === 'apps') body = studio('intelligence', APPS_TABS);
  else if (section === 'skills') {
    body = (
      <IcarusSkillsDrawer
        projectId={projectId}
        agent={session.agent}
        skills={session.skills}
        onRefresh={() => session.reloadAgent(session.agent?.id)}
      />
    );
  } else if (section === 'friends') {
    body = <IcarusFriendsDrawer projectId={projectId} initialTab={tab} />;
  } else if (section === 'connectors') {
    body = (
      <IcarusConnectorsDrawer
        projectId={projectId}
        connectors={session.connectors}
        kinds={session.kinds}
        onRefresh={session.load}
      />
    );
  } else if (section === 'cron') {
    body = (
      <IcarusCronDrawer
        projectId={projectId}
        agent={session.agent}
        crons={session.crons}
        onRefresh={() => session.reloadAgent(session.agent?.id)}
      />
    );
  } else if (section === 'advanced') {
    body = <IcarusAdvancedDrawer session={session} />;
  }

  return (
    <View style={S.root}>
      {rail}
      <View style={S.main}>
        {banners}
        {body}
      </View>
    </View>
  );
}

export default IcarusShell;
