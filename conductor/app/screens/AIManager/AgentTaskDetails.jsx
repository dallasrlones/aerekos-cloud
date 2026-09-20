import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Box } from '../../components/Box/Box';
import { Button } from '../../components/Button/Button';
import { aiManagerService } from '../../services/aiManagerService';
import { useProject } from '../../contexts/ProjectContext';
import { colors } from '../../styles/theme';
import { AIManagerStyles as S } from './AIManager.styles';
import {
  progressOf, currentWork, formatPct, payloadOf, descendants, relatedPlan, DONE,
} from '../../utils/agentWorkProgress';

function ProgressBar({ pct }) {
  const width = `${Math.max(0, Math.min(100, Number(pct) || 0))}%`;
  return (
    <View style={S.progressTrack}>
      <View style={[S.progressFill, { width }]} />
    </View>
  );
}

async function findItem(projectId, taskId, agentId) {
  const agents = await aiManagerService.listAgents(projectId);
  const ordered = agentId
    ? [agents.find((a) => a.id === agentId), ...agents].filter(Boolean)
    : agents;
  const seen = new Set();
  for (const a of ordered) {
    if (!a?.id || seen.has(a.id)) continue;
    seen.add(a.id);
    const work = await aiManagerService.agentWork(projectId, a.id);
    const item = work.find((w) => w.id === taskId);
    if (item) return { agent: a, work, item };
  }
  return { agent: ordered[0] || null, work: [], item: null };
}

export function AgentTaskDetails({ navigation, route }) {
  const taskId = route?.params?.taskId;
  const routeAgentId = route?.params?.agentId || '';
  const { currentProject } = useProject();
  const projectId = currentProject?.id;

  const [agent, setAgent] = useState(null);
  const [item, setItem] = useState(null);
  const [work, setWork] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [asks, setAsks] = useState([]);
  const [plans, setPlans] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const openTask = (id) => {
    if (!id) return;
    navigation.navigate('aiAgentTask', { taskId: id, agentId: agent?.id || routeAgentId });
  };

  const load = useCallback(async () => {
    if (!projectId || !taskId) return;
    setError(null);
    try {
      const found = await findItem(projectId, taskId, routeAgentId);
      if (!found.item) {
        setItem(null);
        setAgent(found.agent);
        setWork(found.work);
        setError('Task not found.');
        return;
      }
      const [workerRows, askRows, planRows, tl] = await Promise.all([
        aiManagerService.agentWorkers(projectId, found.agent.id),
        aiManagerService.agentAsks(projectId, found.agent.id),
        aiManagerService.agentPlans(projectId, found.agent.id).catch(() => []),
        aiManagerService.agentTimeline(projectId, found.agent.id).catch(() => []),
      ]);
      setAgent(found.agent);
      setItem(found.item);
      setWork(found.work);
      setWorkers(workerRows);
      setAsks(askRows);
      setPlans(planRows || []);
      setTimeline(tl || []);
    } catch (e) {
      setError(e?.response?.data?.error?.message || e.message || 'Failed to load task');
    } finally {
      setLoading(false);
    }
  }, [projectId, taskId, routeAgentId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  const plan = relatedPlan(item, plans);
  const progress = progressOf(item, work, plan);
  const now = currentWork(workers, work);
  const kids = (work || []).filter((w) => w.parent_id === item?.id);
  const parent = (work || []).find((w) => w.id === item?.parent_id);
  const assigned = (workers || []).find((w) => w.work_item_id === item?.id || w.id === item?.assigned_worker_id);
  const related = (payloadOf(item).related || [])
    .concat((() => {
      try {
        const raw = typeof item?.relationships === 'string'
          ? JSON.parse(item.relationships || '{}') : (item?.relationships || {});
        return Array.isArray(raw) ? raw : (raw.related || []);
      } catch {
        return [];
      }
    })())
    .map((id) => work.find((w) => w.id === id))
    .filter(Boolean);
  const openAsks = (asks || []).filter((a) => a.status === 'open' && (
    payloadOf(a).task_id === item?.id || payloadOf(a).plan_id === payloadOf(item).plan_id
  ));
  const itemTimeline = (timeline || []).filter((row) => {
    const ref = row.ref_id || payloadOf(row).task_id || payloadOf(row).work_id;
    return ref === item?.id || (payloadOf(item).plan_id && ref === payloadOf(item).plan_id);
  });
  const nowOnThis = now && (now.task?.id === item?.id || descendants(work, item?.id).some((w) => w.id === now.task?.id));

  return (
    <ScrollView style={S.container} contentContainerStyle={[S.content, { maxWidth: 980 }]}>
      <TouchableOpacity style={S.breadcrumb} onPress={() => navigation.navigate('aiAgents')} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
        <Text style={S.hintText}>Agents</Text>
      </TouchableOpacity>

      <Text style={S.title}>{item?.title || 'Task'}</Text>
      <Text style={S.subtitle}>
        {(item?.kind || 'task')} · {item?.status || '—'}
        {agent ? ` · ${agent.display_name || agent.name}` : ''}
      </Text>

      {error ? <Box style={S.errorBox}><Text style={S.errorText}>{error}</Text></Box> : null}
      {loading && !item ? <ActivityIndicator size="small" color={colors.primary} /> : null}

      {item ? (
        <>
          <Box title={`${formatPct(progress)} done`}>
            <ProgressBar pct={progress.pct} />
            <Text style={[S.hintText, { marginTop: 8 }]}>
              {progress.done} of {progress.total || 0} {progress.source === 'plan' ? 'plan steps' : 'tasks'} finished
            </Text>
            <Text style={S.rowName}>
              Currently: {nowOnThis ? (now.label) : (progress.currentTitle || (DONE.has(item.status) ? 'idle — this item is finished' : 'queued'))}
            </Text>
            {nowOnThis && now.worker ? (
              <Text style={S.rowSub}>{now.worker.persona} · {now.worker.status}</Text>
            ) : null}
          </Box>

          {parent ? (
            <Box title="Parent">
              <TouchableOpacity onPress={() => openTask(parent.id)}>
                <Text style={S.rowName}>{parent.title} · {parent.status}</Text>
              </TouchableOpacity>
            </Box>
          ) : null}

          <Box title="Details">
            {item.dod ? <Text style={S.hintText}>Done when: {item.dod}</Text> : null}
            <Text style={S.rowSub}>priority {item.priority || '—'} · id {item.id}</Text>
            {assigned ? (
              <Text style={S.rowSub}>worker {assigned.persona} · {assigned.status}: {assigned.objective}</Text>
            ) : null}
            {plan ? (
              <Text style={S.rowSub}>plan {plan.origin || plan.id} · {plan.status}</Text>
            ) : null}
          </Box>

          {kids.length ? (
            <Box title="Child tasks">
              {kids.map((k) => {
                const kp = progressOf(k, work, relatedPlan(k, plans));
                return (
                  <TouchableOpacity key={k.id} style={S.row} onPress={() => openTask(k.id)} activeOpacity={0.8}>
                    <View style={S.rowMain}>
                      <Text style={S.rowName}>{k.title} · {k.status} · {formatPct(kp)}</Text>
                      {kp.currentTitle ? <Text style={S.rowSub}>working on {kp.currentTitle}</Text> : null}
                      <ProgressBar pct={kp.pct} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </Box>
          ) : null}

          {plan?.steps?.length ? (
            <Box title="Plan steps">
              {plan.steps.map((s, i) => (
                <Text key={s.id || i} style={S.rowSub}>{i + 1}. {s.title} · {s.status || 'queued'}</Text>
              ))}
            </Box>
          ) : null}

          {related.length ? (
            <Box title="Related">
              {related.map((r) => (
                <TouchableOpacity key={r.id} onPress={() => openTask(r.id)}>
                  <Text style={S.rowName}>{r.title} · {r.status}</Text>
                </TouchableOpacity>
              ))}
            </Box>
          ) : null}

          <Box title="Open ASKs">
            {openAsks.length === 0 ? <Text style={S.hintText}>None waiting.</Text> : openAsks.map((a) => (
              <Text key={a.id} style={S.rowSub}>{a.speak_text || a.text}</Text>
            ))}
          </Box>

          <Box title="Timeline">
            {(itemTimeline.length ? itemTimeline : (timeline || []).slice(-12)).length === 0 ? (
              <Text style={S.hintText}>No events yet.</Text>
            ) : (itemTimeline.length ? itemTimeline : timeline.slice(-12)).map((row) => (
              <Text key={row.id || `${row.at}-${row.summary}`} style={S.rowSub}>
                {String(row.at || '').slice(0, 19)} · {row.layer}/{row.type}: {row.summary}
              </Text>
            ))}
          </Box>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
            <Button title="Refresh" variant="secondary" onPress={load} />
            <Button title="Open chat" variant="secondary" onPress={() => navigation.navigate('aiAgents')} />
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}
