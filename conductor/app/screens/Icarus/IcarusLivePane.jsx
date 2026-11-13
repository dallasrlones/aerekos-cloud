import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { llmPhase } from '../../utils/icarusThink';
import { spacing } from '../../styles/theme';
import { ICARUS_TRON as T } from './Icarus.styles';

const LAYER = {
  user: { label: 'You', tint: T.text, ring: T.muted },
  icarus: { label: 'Icarus', tint: T.line, ring: T.line },
  manager: { label: 'Manager', tint: T.wash, ring: T.lineDim },
  planning: { label: 'Planning', tint: '#9ad4ff', ring: T.lineDim },
  worker: { label: 'Worker', tint: T.ok, ring: 'rgba(93,255,176,0.4)' },
  specialist: { label: 'Specialist', tint: T.wash, ring: T.lineDim },
  task: { label: 'Task', tint: T.muted, ring: '#333' },
  ask: { label: 'Ask', tint: T.wait, ring: T.lineDim },
};

function isEngaged(status) {
  const s = String(status || '').toLowerCase();
  if (!s) return false;
  if (s.includes('pause') || s.includes('idle') || s.includes('ready') || s.includes('done')
    || s.includes('complete') || s.includes('cancel') || s.includes('success')) {
    return false;
  }
  return s.includes('run') || s.includes('active') || s.includes('busy') || s.includes('stream')
    || s.includes('think') || s.includes('tool') || s.includes('wait') || s.includes('pending')
    || s.includes('queued') || s.includes('hold') || s.includes('ask') || s.includes('spawn');
}

function FlowNode({
  kind,
  title,
  subtitle,
  status,
  lit,
  thinking = false,
  onPress,
}) {
  const meta = LAYER[kind] || LAYER.task;
  const active = lit || thinking;
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      {...(Platform.OS === 'web' && title ? { 'data-icarus-anchor': `flow-${kind}-${String(title).slice(0, 24)}` } : {})}
      style={{
        borderWidth: 1,
        borderColor: active ? T.line : T.lineDim,
        backgroundColor: active ? 'rgba(0,195,255,0.12)' : T.surface,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 2,
        minWidth: 140,
        maxWidth: 220,
        opacity: active ? 1 : 0.72,
        overflow: 'hidden',
        position: 'relative',
        ...(Platform.OS === 'web' ? {
          transform: lit ? 'perspective(600px) rotateX(4deg)' : 'none',
          boxShadow: active ? `0 0 16px ${T.line}66` : 'none',
          transition: 'box-shadow 180ms ease, border-color 180ms ease, opacity 180ms ease',
          animation: thinking
            ? 'icarusNodeThink 1.1s ease-in-out infinite'
            : lit
              ? 'icarusNodePulse 1.6s ease-in-out infinite'
              : undefined,
        } : {}),
      }}
    >
      {Platform.OS === 'web' && thinking ? (
        <View
          // eslint-disable-next-line react-native/no-inline-styles
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: 2,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: 2,
              width: '40%',
              backgroundColor: T.line,
              // web scan
              ...(Platform.OS === 'web' ? { animation: 'icarusNodeScan 1.4s linear infinite' } : {}),
            }}
          />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <View style={{
          width: 8,
          height: 8,
          borderRadius: 1,
          backgroundColor: active ? T.line : '#333',
          ...(Platform.OS === 'web' && thinking ? {
            animation: 'icarusDotBlink 0.7s ease-in-out infinite',
          } : {}),
        }}
        />
        <Text style={{
          fontFamily: T.fontDisplay,
          fontSize: 10,
          color: active ? meta.tint : T.muted,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
        }}
        >
          {meta.label}
        </Text>
        {thinking ? (
          <Text style={{
            fontFamily: T.fontBody,
            fontSize: 10,
            color: T.line,
            letterSpacing: 2,
            ...(Platform.OS === 'web' ? { animation: 'icarusEllipsis 1.2s steps(4, end) infinite' } : {}),
          }}
          >
            ···
          </Text>
        ) : null}
      </View>
      <Text style={{ fontFamily: T.fontBody, color: active ? T.text : T.muted, fontSize: 13 }} numberOfLines={1}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ fontFamily: T.fontBody, fontSize: 11, color: T.muted, marginTop: 2 }} numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

function Edge({ lit }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 4 }}>
      <View style={{
        width: 1,
        height: 14,
        backgroundColor: lit ? T.line : T.lineDim,
        ...(Platform.OS === 'web' && lit ? { boxShadow: `0 0 6px ${T.line}` } : {}),
      }}
      />
      <Text style={{ color: lit ? T.line : '#334', fontSize: 10 }}>↓</Text>
    </View>
  );
}

function Row({ children }) {
  return (
    <View style={{
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      justifyContent: 'center',
      paddingHorizontal: spacing.sm,
    }}
    >
      {children}
    </View>
  );
}

/**
 * Live flow — only nodes in play. Single cyan light on the active hop.
 */
export function IcarusLivePane({
  session,
  onSelectNode,
  compact = false,
}) {
  const hud = llmPhase(session.stream, session.gateway);
  const agents = session.agents || [];
  const workers = session.workers || [];
  const asks = session.openAsks || session.asks?.filter?.((a) => a.status === 'open') || [];
  const tasks = session.liveGraph?.tasks || session.liveGraph?.nodes || [];
  const tools = session.liveTools || [];
  const streaming = !!(session.stream?.text || session.stream?.partial || (hud.phase && hud.phase !== 'idle'));
  const handoff = session.handoff;
  const route = String(session.stream?.route || handoff?.route || handoff?.gate || '').toUpperCase();

  const icarus = useMemo(
    () => agents.find((a) => String(a.name || '').toLowerCase().includes('icarus')) || session.agent || agents[0],
    [agents, session.agent],
  );

  const activeWorkers = useMemo(
    () => (workers || []).filter((w) => isEngaged(w.status || 'running')),
    [workers],
  );

  const activeTasks = useMemo(
    () => (tasks || []).filter((t) => isEngaged(t.status)),
    [tasks],
  );

  const activeSpecialists = useMemo(
    () => (agents || []).filter((a) => {
      if (!a || a.id === icarus?.id) return false;
      const role = String(a.role || a.kind || '').toLowerCase();
      if (role.includes('worker')) return false;
      // Only when this specialist is the focused chat mid-stream / engaged status
      if (a.id === session.agent?.id && streaming) return true;
      return isEngaged(a.status);
    }),
    [agents, icarus?.id, session.agent?.id, streaming],
  );

  const showManager = !!(handoff || route.includes('MANAGER') || activeWorkers.length || activeTasks.length
    || activeSpecialists.length);

  // One lit node — current hop only
  let lit = 'icarus';
  if (asks.length && !streaming && !session.busy) lit = 'ask';
  else if (activeWorkers.length || activeTasks.some((t) => !String(t.kind || t.type || '').toLowerCase().includes('plan'))) {
    lit = 'worker';
  } else if (activeSpecialists.length || activeTasks.some((t) => String(t.kind || t.type || t.title || '').toLowerCase().includes('plan'))) {
    lit = 'specialist';
  } else if (showManager && (handoff || route.includes('MANAGER'))) lit = 'manager';
  else if (streaming || session.stream?.jobId) lit = 'icarus';
  else if (session.busy) lit = 'user';
  else lit = 'icarus';

  const openNode = (node) => onSelectNode?.(node);

  const openAgent = (a, kind = 'agent') => {
    if (!a) return;
    openNode({
      id: a.id || a.agent_id,
      agent_id: a.id || a.agent_id,
      kind,
      title: a.name || a.title || a.id,
      status: a.status || (streaming ? 'running' : 'ready'),
      name: a.name,
    });
  };

  const recentTools = tools.slice(0, 6);
  const horiz = compact;
  const planTasks = activeTasks.filter((t) => String(t.kind || t.type || t.title || '').toLowerCase().includes('plan'));
  const workTasks = activeTasks.filter((t) => !String(t.kind || t.type || '').toLowerCase().includes('plan'));

  const userNode = (
    <FlowNode
      kind="user"
      title="You"
      subtitle={session.busy ? 'sending' : null}
      status={session.busy ? 'waiting' : 'idle'}
      lit={lit === 'user'}
      thinking={lit === 'user' && !!session.busy}
      onPress={() => {}}
    />
  );

  const icarusNode = (
    <FlowNode
      kind="icarus"
      title={icarus?.name || 'Icarus'}
      subtitle={streaming ? (hud.label || 'thinking') : null}
      status={streaming ? 'running' : (session.brainOffline ? 'offline' : 'idle')}
      lit={lit === 'icarus'}
      thinking={lit === 'icarus' && (streaming || !!session.stream?.jobId)}
      onPress={() => openAgent(icarus, 'agent')}
    />
  );

  const managerNode = showManager ? (
    <FlowNode
      kind="manager"
      title="Manager"
      subtitle={handoff?.label || 'routing'}
      status="running"
      lit={lit === 'manager'}
      thinking={lit === 'manager'}
      onPress={() => openAgent(icarus, 'agent')}
    />
  ) : null;

  return (
    <View style={{ flex: 1, minHeight: 0, backgroundColor: T.void }}>
      {Platform.OS === 'web' ? (
        <style>{`
          @keyframes icarusNodePulse {
            0%, 100% { box-shadow: 0 0 8px ${T.line}33; }
            50% { box-shadow: 0 0 18px ${T.line}88; }
          }
          @keyframes icarusNodeThink {
            0%, 100% { box-shadow: 0 0 10px ${T.line}44; border-color: ${T.line}; }
            50% { box-shadow: 0 0 22px ${T.line}aa, inset 0 0 12px ${T.line}22; border-color: ${T.wash}; }
          }
          @keyframes icarusNodeScan {
            0% { transform: translateX(-100%); opacity: 0.3; }
            40% { opacity: 1; }
            100% { transform: translateX(280%); opacity: 0.3; }
          }
          @keyframes icarusDotBlink {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.35; transform: scale(1.35); }
          }
          @keyframes icarusEllipsis {
            0% { opacity: 0.2; letter-spacing: 1px; }
            50% { opacity: 1; letter-spacing: 3px; }
            100% { opacity: 0.2; letter-spacing: 1px; }
          }
          @media (prefers-reduced-motion: reduce) {
            * { animation: none !important; transition: none !important; }
          }
        `}</style>
      ) : null}
      <View style={{
        paddingHorizontal: spacing.sm,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: T.lineDim,
        gap: 4,
      }}
      >
        <Text style={{
          fontFamily: T.fontDisplay,
          fontSize: 11,
          color: T.line,
          letterSpacing: 2,
          textTransform: 'uppercase',
        }}
        >
          Live
        </Text>
        <Text style={{ fontFamily: T.fontBody, fontSize: 12, color: T.muted }} numberOfLines={2}>
          {streaming ? hud.label : (handoff?.label || 'Idle — graph grows when work starts')}
          {asks.length ? ` · ${asks.length} ask` : ''}
          {activeWorkers.length ? ` · ${activeWorkers.length} worker` : ''}
        </Text>
      </View>

      <ScrollView
        horizontal={horiz}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingVertical: horiz ? 10 : 16,
          paddingHorizontal: horiz ? 8 : 0,
          alignItems: 'center',
          gap: horiz ? 8 : 0,
          flexDirection: horiz ? 'row' : 'column',
        }}
      >
        {horiz ? (
          <>
            {userNode}
            <Text style={{ color: lit === 'user' || lit === 'icarus' ? T.line : T.lineDim }}>→</Text>
            {icarusNode}
            {managerNode ? (
              <>
                <Text style={{ color: lit === 'manager' ? T.line : T.lineDim }}>→</Text>
                {managerNode}
              </>
            ) : null}
            {activeSpecialists.slice(0, 4).map((a) => (
              <FlowNode
                key={a.id}
                kind="specialist"
                title={a.name || a.id}
                subtitle={a.status || 'active'}
                status={a.status || 'running'}
                lit={lit === 'specialist' && a.id === session.agent?.id}
                thinking={lit === 'specialist' && a.id === session.agent?.id}
                onPress={() => openAgent(a, 'specialist')}
              />
            ))}
            {activeWorkers.slice(0, 6).map((w) => (
              <FlowNode
                key={w.id || w.agent_id}
                kind="worker"
                title={w.name || w.agent_name || 'Worker'}
                subtitle={w.status}
                status={w.status || 'running'}
                lit={lit === 'worker'}
                thinking={lit === 'worker'}
                onPress={() => openNode({
                  id: w.agent_id || w.id,
                  agent_id: w.agent_id || w.id,
                  kind: 'worker',
                  title: w.name || w.agent_name || 'Worker',
                  status: w.status,
                })}
              />
            ))}
            {asks.slice(0, 3).map((a) => (
              <FlowNode
                key={a.id}
                kind="ask"
                title={a.question || a.prompt || 'Ask'}
                subtitle="waiting"
                status="waiting"
                lit={lit === 'ask'}
                thinking={lit === 'ask'}
                onPress={() => openNode({ ...a, kind: 'ask' })}
              />
            ))}
          </>
        ) : (
          <>
            <Row>{userNode}</Row>
            <Edge lit={lit === 'user' || lit === 'icarus'} />
            <Row>{icarusNode}</Row>
            {managerNode ? (
              <>
                <Edge lit={lit === 'manager' || lit === 'worker' || lit === 'specialist'} />
                <Row>{managerNode}</Row>
              </>
            ) : null}

            {(activeSpecialists.length > 0 || planTasks.length > 0) ? (
              <>
                <Edge lit={lit === 'specialist'} />
                <Row>
                  {activeSpecialists.slice(0, 8).map((a) => (
                    <FlowNode
                      key={a.id}
                      kind="specialist"
                      title={a.name || a.id}
                      subtitle={a.status || 'active'}
                      status={a.status || 'running'}
                      lit={lit === 'specialist' && (a.id === session.agent?.id || activeSpecialists.length === 1)}
                      thinking={lit === 'specialist' && (a.id === session.agent?.id || activeSpecialists.length === 1)}
                      onPress={() => openAgent(a, 'specialist')}
                    />
                  ))}
                  {planTasks.slice(0, 4).map((t) => (
                    <FlowNode
                      key={t.id}
                      kind="planning"
                      title={t.title || t.name || 'Plan'}
                      subtitle={t.status}
                      status={t.status}
                      lit={lit === 'specialist'}
                      thinking={lit === 'specialist'}
                      onPress={() => openNode({
                        ...t,
                        kind: 'plan',
                        plan_id: t.plan_id || t.id,
                        agent_id: t.agent_id,
                      })}
                    />
                  ))}
                </Row>
              </>
            ) : null}

            {(activeWorkers.length > 0 || workTasks.length > 0) ? (
              <>
                <Edge lit={lit === 'worker'} />
                <Row>
                  {activeWorkers.slice(0, 12).map((w) => (
                    <FlowNode
                      key={w.id || w.agent_id}
                      kind="worker"
                      title={w.name || w.agent_name || w.title || 'Worker'}
                      subtitle={w.task_title || w.status}
                      status={w.status || 'running'}
                      lit={lit === 'worker'}
                      thinking={lit === 'worker'}
                      onPress={() => openNode({
                        id: w.agent_id || w.id,
                        agent_id: w.agent_id || w.id,
                        kind: 'worker',
                        title: w.name || w.agent_name || 'Worker',
                        status: w.status,
                        task_id: w.task_id,
                      })}
                    />
                  ))}
                  {workTasks.slice(0, 10).map((t) => (
                    <FlowNode
                      key={`task-${t.id}`}
                      kind="task"
                      title={t.title || t.name || 'Task'}
                      subtitle={t.status}
                      status={t.status}
                      lit={lit === 'worker'}
                      thinking={lit === 'worker'}
                      onPress={() => openNode({
                        ...t,
                        kind: 'task',
                        task_id: t.id,
                        agent_id: t.agent_id,
                      })}
                    />
                  ))}
                </Row>
              </>
            ) : null}

            {asks.length > 0 ? (
              <>
                <Edge lit={lit === 'ask'} />
                <Row>
                  {asks.slice(0, 6).map((a) => (
                    <FlowNode
                      key={a.id}
                      kind="ask"
                      title={a.question || a.prompt || a.title || 'Ask'}
                      subtitle={a.agent_name || 'waiting'}
                      status="waiting"
                      lit={lit === 'ask'}
                      thinking={lit === 'ask'}
                      onPress={() => openNode({ ...a, kind: 'ask' })}
                    />
                  ))}
                </Row>
              </>
            ) : null}
          </>
        )}
      </ScrollView>

      {recentTools.length ? (
        <View style={{
          borderTopWidth: 1,
          borderTopColor: T.lineDim,
          paddingHorizontal: spacing.sm,
          paddingVertical: 6,
          maxHeight: 72,
        }}
        >
          <Text style={{
            fontFamily: T.fontDisplay,
            fontSize: 9,
            letterSpacing: 1.5,
            color: T.muted,
            marginBottom: 4,
            textTransform: 'uppercase',
          }}
          >
            Tools
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {recentTools.map((t, i) => (
              <Text
                key={t.id || i}
                style={{
                  fontFamily: T.fontBody,
                  fontSize: 11,
                  color: T.wash,
                  marginRight: 12,
                }}
                numberOfLines={1}
              >
                {t.name || t.tool || t.type || 'tool'}
              </Text>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

export default IcarusLivePane;
