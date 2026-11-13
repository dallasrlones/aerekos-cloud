import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Button } from '../../components/Button/Button';
import { aiManagerService } from '../../services/aiManagerService';
import { colors, spacing, typography } from '../../styles/theme';
import { STATUS_COLOR } from '../AIManager/planGraphLayout';

const TABS_BY_KIND = {
  agent: ['Chat', 'Children', 'Parents', 'Tools'],
  plan: ['Children', 'Parents', 'Tools'],
  task: ['Status', 'ASKs', 'Children', 'Parents', 'Tools', 'Trace'],
  worker: ['Tools', 'Parents', 'Timeline'],
};

function kindOf(node) {
  if (!node) return 'task';
  if (node.kind) return node.kind;
  if (node.persona || node.role === 'worker') return 'worker';
  if (node.tasks && !node.title) return 'plan';
  return 'task';
}

export function IcarusNodeDetail({
  projectId,
  node,
  agents = [],
  workers = [],
  asks = [],
  messages = [],
  liveTools = [],
  liveGraph,
  onClose,
  onSelectChild,
  onFocusChat,
  onShowRelatedChat,
}) {
  const kind = kindOf(node);
  const tabs = TABS_BY_KIND[kind] || TABS_BY_KIND.task;
  const [tab, setTab] = useState(tabs[0]);
  const [trace, setTrace] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTab(tabs[0]);
  }, [node?.id, kind]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!projectId || !node?.id || (kind !== 'task' && tab !== 'Trace' && tab !== 'Tools')) return;
      if (kind === 'task' && (tab === 'Trace' || tab === 'Tools' || tab === 'Status')) {
        setLoading(true);
        try {
          const t = await aiManagerService.icarusTaskTrace(projectId, node.id, {
            agent_id: node.agent_id || '',
          });
          if (!cancelled) setTrace(t);
        } catch {
          if (!cancelled) setTrace(null);
        } finally {
          if (!cancelled) setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [projectId, node?.id, node?.agent_id, kind, tab]);

  const tools = useMemo(() => {
    const live = (liveTools || []).filter((t) => (
      t.task_id === node?.id || t.agent_id === node?.id || t.worker_id === node?.id
    ));
    const fromTrace = (trace?.tools || []).filter((t) => !live.some((l) => l.id === t.id));
    return [...live, ...fromTrace];
  }, [liveTools, trace, node?.id]);

  const children = useMemo(() => {
    if (kind === 'plan') return liveGraph?.tasks || [];
    if (kind === 'task') {
      return (workers || []).filter((w) => w.task_id === node.id || w.parent_id === node.id);
    }
    if (kind === 'agent') {
      return (workers || []).concat((liveGraph?.tasks || []).filter((t) => t.agent_id === node.id));
    }
    return [];
  }, [kind, liveGraph, workers, node?.id]);

  const parents = useMemo(() => {
    const out = [];
    if (kind === 'task' && (liveGraph?.plan_id || node.plan_id)) {
      out.push({
        id: liveGraph?.plan_id || node.plan_id,
        kind: 'plan',
        title: 'Plan',
        status: liveGraph?.status || 'running',
      });
    }
    if (kind === 'worker') {
      const task = (liveGraph?.tasks || []).find((t) => t.id === node.task_id);
      if (task) out.push({ ...task, kind: 'task' });
      const mgr = agents.find((a) => a.id === node.agent_id || a.id === node.parent_id);
      if (mgr) out.push({ ...mgr, kind: 'agent', title: mgr.display_name || mgr.name });
    }
    if (kind === 'task' && node.agent_id) {
      const a = agents.find((x) => x.id === node.agent_id);
      if (a) out.push({ ...a, kind: 'agent', title: a.display_name || a.name });
    }
    return out;
  }, [kind, liveGraph, node, agents]);

  const linkedAsks = (asks || []).filter((a) => {
    let payload = {};
    try {
      payload = typeof a.payload === 'string' ? JSON.parse(a.payload || '{}') : (a.payload || {});
    } catch { /* */ }
    return payload.task_id === node?.id || a.task_id === node?.id;
  });

  const agentMessages = (messages || []).filter((m) => {
    if (kind !== 'agent') return false;
    return true;
  }).slice(-40);

  if (!node) return null;

  const color = STATUS_COLOR[node.status] || colors.textMuted;
  const isFriend = kind === 'agent';

  return (
    <View style={{
      borderTopWidth: 1,
      borderColor: colors.divider,
      padding: spacing.sm,
      maxHeight: 320,
      backgroundColor: colors.surface,
    }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ ...typography.caption, color: colors.textMuted }}>
            Icarus
            {parents[0] ? ` → ${parents[0].title || parents[0].kind}` : ''}
            {` → ${node.title || node.name || kind}`}
          </Text>
          <Text style={{ ...typography.body, fontWeight: '600' }} numberOfLines={2}>
            {node.title || node.display_name || node.name || node.id}
          </Text>
          <Text style={{ ...typography.caption, color }}>
            {kind}
            {node.status ? ` · ${node.status}` : ''}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {isFriend && onFocusChat ? (
            <Button title="Focus chat" variant="secondary" onPress={() => onFocusChat(node)} />
          ) : null}
          {!isFriend && onShowRelatedChat ? (
            <Button title="Related chat" variant="secondary" onPress={() => onShowRelatedChat(node)} />
          ) : null}
          {onClose ? (
            <TouchableOpacity onPress={onClose}>
              <Text style={typography.caption}>Close</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
        {tabs.map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              marginRight: 6,
              borderRadius: 6,
              backgroundColor: tab === t ? colors.border : 'transparent',
            }}
          >
            <Text style={typography.caption}>{t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? <ActivityIndicator /> : null}

      <ScrollView style={{ maxHeight: 180 }}>
        {tab === 'Chat' ? (
          agentMessages.length ? agentMessages.map((m) => (
            <Text key={m.id} style={typography.caption} numberOfLines={3}>
              {m.role}: {String(m.content || '').slice(0, 200)}
            </Text>
          )) : <Text style={typography.caption}>No messages on this agent yet.</Text>
        ) : null}

        {tab === 'Status' ? (
          <View>
            <Text style={typography.caption}>{node.description || node.objective || 'No description.'}</Text>
            {trace?.why?.summary ? (
              <Text style={{ ...typography.caption, marginTop: 6 }}>Why: {trace.why.summary}</Text>
            ) : null}
          </View>
        ) : null}

        {tab === 'ASKs' ? (
          linkedAsks.length ? linkedAsks.map((a) => (
            <Text key={a.id} style={typography.caption}>{a.status}: {a.speak_text || a.text}</Text>
          )) : <Text style={typography.caption}>No ASKs linked to this task.</Text>
        ) : null}

        {tab === 'Children' ? (
          children.length ? children.map((c) => (
            <TouchableOpacity key={c.id} onPress={() => onSelectChild?.({ ...c, kind: c.kind || (c.persona ? 'worker' : 'task') })}>
              <Text style={typography.caption}>
                {c.title || c.persona || c.name || c.id}
                {c.status ? ` · ${c.status}` : ''}
              </Text>
            </TouchableOpacity>
          )) : <Text style={typography.caption}>No children.</Text>
        ) : null}

        {tab === 'Parents' ? (
          parents.length ? parents.map((p) => (
            <TouchableOpacity key={p.id} onPress={() => onSelectChild?.(p)}>
              <Text style={typography.caption}>
                {p.title || p.name || p.id}
                {` · ${p.kind}`}
              </Text>
            </TouchableOpacity>
          )) : <Text style={typography.caption}>No parents.</Text>
        ) : null}

        {(tab === 'Tools' || tab === 'Trace') ? (
          <View>
            {tab === 'Trace' && trace?.why?.summary ? (
              <Text style={{ ...typography.caption, marginBottom: 6 }}>{trace.why.summary}</Text>
            ) : null}
            {tools.length ? tools.slice(0, 40).map((t) => (
              <Text key={t.id || `${t.tool}-${t.created_at}`} style={typography.caption}>
                {t.ok === false ? '✗' : '·'} {t.summary || t.tool}
              </Text>
            )) : <Text style={typography.caption}>No tool calls yet.</Text>}
          </View>
        ) : null}

        {tab === 'Timeline' ? (
          (node.timeline || tools).slice?.(0, 30)?.map?.((t, i) => (
            <Text key={t.id || i} style={typography.caption}>
              {t.summary || t.tool || t.event || JSON.stringify(t).slice(0, 80)}
            </Text>
          )) || <Text style={typography.caption}>No timeline.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

export default IcarusNodeDetail;
