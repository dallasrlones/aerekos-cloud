import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Box } from '../../components/Box/Box';
import { Button } from '../../components/Button/Button';
import { AIManagerStyles as S } from './AIManager.styles';
import { progressOf, currentWork, formatPct, relatedPlan } from '../../utils/agentWorkProgress';
import { PlanGraphView } from './PlanGraphView';
import { TaskInspector } from './TaskInspector';

function ProgressBar({ pct }) {
  const width = `${Math.max(0, Math.min(100, Number(pct) || 0))}%`;
  return (
    <View style={S.progressTrack}>
      <View style={[S.progressFill, { width }]} />
    </View>
  );
}

const CURRENT = new Set(['proposed', 'asking', 'accepted', 'running', 'drafting']);
const HISTORY = new Set(['done', 'cancelled', 'superseded']);

function payloadOf(row) {
  try {
    return typeof row?.payload === 'string' ? JSON.parse(row.payload || '{}') : (row?.payload || {});
  } catch {
    return {};
  }
}

function relatedOf(row) {
  try {
    const raw = typeof row?.relationships === 'string' ? JSON.parse(row.relationships || '{}') : (row?.relationships || {});
    if (Array.isArray(raw)) return raw;
    return [].concat(raw.related || []);
  } catch {
    return [];
  }
}

function TaskTree({ tasks, work, workers, asks, plans, depth = 0, focusId, onFocus, onOpenTask }) {
  return tasks.map((t) => {
    const kids = work.filter((w) => w.kind === 'task' && w.parent_id === t.id);
    const worker = workers.find((w) => w.work_item_id === t.id || w.id === t.assigned_worker_id);
    const related = relatedOf(t)
      .map((id) => work.find((w) => w.id === id))
      .filter(Boolean);
    const openAsks = asks.filter((a) => a.status === 'open' && payloadOf(a).task_id === t.id);
    const focused = focusId && (focusId === t.id || payloadOf(t).plan_id === focusId);
    const prog = progressOf(t, work, relatedPlan(t, plans));
    return (
      <View key={t.id} style={{ marginLeft: depth * 12, marginTop: 6 }}>
        <TouchableOpacity onPress={() => {
          onFocus?.({ task_id: t.id, plan_id: payloadOf(t).plan_id });
          onOpenTask?.(t.id);
        }}>
          <Text style={[S.rowName, focused && { textDecorationLine: 'underline' }]}>
            {t.title} · {t.status} · {formatPct(prog)}{worker ? ` · ${worker.persona} ${worker.status}` : ''}
          </Text>
          <ProgressBar pct={prog.pct} />
        </TouchableOpacity>
        {related.length ? (
          <Text style={S.rowSub}>related to {related.map((r) => r.title).join(', ')}</Text>
        ) : null}
        {openAsks.map((a) => (
          <Text key={a.id} style={S.rowSub}>ASK: {a.speak_text || a.text}</Text>
        ))}
        {kids.length ? (
          <TaskTree tasks={kids} work={work} workers={workers} asks={asks} plans={plans} depth={depth + 1} focusId={focusId} onFocus={onFocus} onOpenTask={onOpenTask} />
        ) : null}
      </View>
    );
  });
}

export function PlansBoard({
  plans = [],
  work = [],
  workers = [],
  asks = [],
  timeline = [],
  boardTab = 'current',
  setBoardTab,
  focus,
  onOpenChat,
  onOpenTask,
  projectId,
  liveGraph,
  liveTools = [],
  gateway,
  readyCount,
  selectedGraphTask,
  onSelectGraphTask,
  scrubAt,
  onScrub,
  scrubMax,
}) {
  const currentPlans = plans.filter((p) => CURRENT.has(p.status));
  const historyPlans = plans.filter((p) => HISTORY.has(p.status));
  const goals = work.filter((w) => w.kind === 'goal');
  const shownPlans = boardTab === 'history' ? historyPlans : currentPlans;
  const focusId = focus?.plan_id || focus?.task_id || '';
  const now = currentWork(workers, work);

  return (
    <>
      <Box title="Plans">
        <Text style={S.hintText}>Live task graph is the truth board. Current = real time; History + scrub = what we were doing. Chat stays the voice surface.</Text>
        {now ? (
          <TouchableOpacity onPress={() => now.task?.id && onOpenTask?.(now.task.id)}>
            <Text style={[S.rowName, { marginTop: 8 }]}>Currently: {now.label}</Text>
            <Text style={S.rowSub}>{now.worker.persona} · {now.worker.status}{now.task ? ` · ${now.task.title}` : ''}</Text>
          </TouchableOpacity>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          <Button title="Current" variant={boardTab === 'current' ? 'primary' : 'secondary'} onPress={() => setBoardTab('current')} />
          <Button title="History" variant={boardTab === 'history' ? 'primary' : 'secondary'} onPress={() => setBoardTab('history')} />
          {onOpenChat ? <Button title="Open chat" variant="secondary" onPress={onOpenChat} /> : null}
        </View>
      </Box>

      <Box title={boardTab === 'history' ? 'Task graph (history)' : 'Task graph (live)'}>
        <PlanGraphView
          subgraph={liveGraph}
          gateway={gateway}
          readyCount={readyCount}
          selectedId={selectedGraphTask?.id}
          onSelect={onSelectGraphTask}
          scrubAt={scrubAt}
          onScrub={onScrub}
          scrubMax={boardTab === 'history' ? scrubMax : 0}
        />
        <View style={{ marginTop: 12 }}>
          <TaskInspector
            projectId={projectId}
            task={selectedGraphTask}
            liveTools={liveTools}
            onOpenFull={onOpenTask}
            onClose={() => onSelectGraphTask?.(null)}
          />
        </View>
      </Box>

      {shownPlans.length === 0 && boardTab === 'current' && goals.length === 0 ? (
        <Box title="Nothing in flight"><Text style={S.hintText}>Accept a plan in chat and it shows up here with tasks and workers.</Text></Box>
      ) : null}

      {shownPlans.map((p) => {
        const linked = work.filter((w) => payloadOf(w).plan_id === p.id);
        const goal = linked.find((w) => w.kind === 'goal') || goals.find((g) => payloadOf(g).plan_id === p.id);
        const topTasks = work.filter((w) => w.kind === 'task' && w.parent_id === (goal?.id || '') && payloadOf(w).plan_id === p.id);
        const planAsks = asks.filter((a) => a.status === 'open' && payloadOf(a).plan_id === p.id);
        const focused = focusId === p.id;
        const prog = progressOf(goal || { id: p.id, kind: 'goal', status: p.status }, work, p);
        return (
          <Box key={p.id} title={`${p.origin || 'Plan'} · ${p.status} · ${formatPct(prog)}${focused ? ' · focused' : ''}`}>
            <ProgressBar pct={prog.pct} />
            {(p.steps || []).map((s, i) => (
              <Text key={s.id || i} style={S.rowSub}>{i + 1}. {s.title} · {s.status || 'queued'}</Text>
            ))}
            {planAsks.map((a) => (
              <Text key={a.id} style={S.rowSub}>Open ASK: {a.speak_text || a.text}</Text>
            ))}
            {goal ? (
              <TouchableOpacity onPress={() => onOpenTask?.(goal.id)}>
                <Text style={[S.rowName, { marginTop: 8 }]}>{goal.title} · {goal.status} · {formatPct(prog)}</Text>
              </TouchableOpacity>
            ) : null}
            <TaskTree
              tasks={topTasks}
              work={work}
              workers={workers}
              asks={asks}
              plans={plans}
              focusId={focusId}
              onOpenTask={onOpenTask}
            />
          </Box>
        );
      })}

      {boardTab === 'current' ? goals.filter((g) => !payloadOf(g).plan_id).map((g) => {
        const topTasks = work.filter((w) => w.kind === 'task' && w.parent_id === g.id);
        const prog = progressOf(g, work);
        return (
          <Box key={g.id} title={`${g.title} · ${g.status} · ${formatPct(prog)}`}>
            <TouchableOpacity onPress={() => onOpenTask?.(g.id)}>
              <ProgressBar pct={prog.pct} />
            </TouchableOpacity>
            <TaskTree tasks={topTasks} work={work} workers={workers} asks={asks} plans={plans} focusId={focusId} onOpenTask={onOpenTask} />
          </Box>
        );
      }) : null}

      {boardTab === 'history' ? (
        <Box title="Timeline">
          {timeline.length === 0 ? <Text style={S.hintText}>No timeline yet.</Text> : (
            <ScrollView style={{ maxHeight: 360 }}>
              {timeline.map((row) => (
                <Text key={row.id || `${row.at}-${row.summary}`} style={S.rowSub}>
                  {String(row.at || '').slice(0, 19)} · {row.layer}/{row.type}: {row.summary}
                </Text>
              ))}
            </ScrollView>
          )}
        </Box>
      ) : null}
    </>
  );
}
