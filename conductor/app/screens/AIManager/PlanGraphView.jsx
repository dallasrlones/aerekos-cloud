import React, { useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Platform,
} from 'react-native';
import { colors, spacing, typography } from '../../styles/theme';
import { layoutPlanGraph, statusCounts, STATUS_COLOR } from './planGraphLayout';

function StatusStrip({ tasks, gateway, readyCount }) {
  const c = statusCounts(tasks);
  const owner = (gateway?.in_flight || [])[0];
  return (
    <View style={{
      flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm, alignItems: 'center',
    }}
    >
      <Text style={typography.caption}>
        {c.running} running · {readyCount != null ? readyCount : c.ready} ready · {c.done} done
        {c.failed ? ` · ${c.failed} failed` : ''}
      </Text>
      <Text style={{ ...typography.caption, color: colors.textMuted }}>
        GPU: {owner ? `${owner.lane} · ${owner.agent_id || '—'}` : 'idle'}
        {gateway?.queued?.length != null ? ` · queue ${gateway.queued.length}` : ''}
      </Text>
    </View>
  );
}

function EdgeLegend() {
  return (
    <Text style={{ ...typography.caption, color: colors.textMuted, marginBottom: 6 }}>
      Edges: BEFORE → · PARALLEL · MUTEX · INVALIDATES
    </Text>
  );
}

/** Web SVG DAG; native falls back to status list. */
export function PlanGraphView({
  subgraph,
  gateway,
  readyCount,
  selectedId,
  onSelect,
  scrubAt,
  onScrub,
  scrubMax,
}) {
  const layout = useMemo(() => layoutPlanGraph(subgraph || {}), [subgraph]);
  const tasks = subgraph?.tasks || [];

  if (!tasks.length) {
    return (
      <View style={{ paddingVertical: spacing.md }}>
        <Text style={typography.caption}>No active plan — manager idle.</Text>
      </View>
    );
  }

  return (
    <View>
      <StatusStrip tasks={tasks} gateway={gateway} readyCount={readyCount} />
      <EdgeLegend />
      {scrubMax > 0 ? (
        <View style={{ marginBottom: spacing.sm }}>
          <Text style={typography.caption}>History scrub</Text>
          {Platform.OS === 'web' ? (
            <input
              type="range"
              min={0}
              max={scrubMax}
              value={scrubAt == null ? scrubMax : scrubAt}
              onChange={(e) => onScrub?.(Number(e.target.value))}
              style={{ width: '100%', maxWidth: 420 }}
            />
          ) : (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={() => onScrub?.(0)}>
                <Text style={typography.caption}>Start</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onScrub?.(scrubMax)}>
                <Text style={typography.caption}>Live end</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : null}

      {Platform.OS === 'web' ? (
        <ScrollView horizontal style={{ maxHeight: Math.min(layout.height + 24, 360) }}>
          <svg
            width={layout.width}
            height={layout.height}
            style={{ background: colors.surface || 'transparent', borderRadius: 8 }}
          >
            {layout.edges.map((e, i) => (
              <line
                key={`${e.from}-${e.to}-${i}`}
                x1={e.x1}
                y1={e.y1}
                x2={e.x2}
                y2={e.y2}
                stroke={e.type === 'INVALIDATES' ? STATUS_COLOR.failed : (e.type === 'MUTEX' ? STATUS_COLOR.blocked : '#555')}
                strokeWidth={e.type === 'PARALLEL' ? 1 : 1.5}
                strokeDasharray={e.type === 'PARALLEL' ? '4 3' : undefined}
              />
            ))}
            {layout.nodes.map((n) => (
              <g
                key={n.id}
                onClick={() => onSelect?.(n)}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  x={n.x}
                  y={n.y}
                  width={128}
                  height={36}
                  rx={6}
                  fill={colors.surface || '#1a1a1a'}
                  stroke={selectedId === n.id ? '#fff' : n.color}
                  strokeWidth={selectedId === n.id ? 2 : 1.5}
                />
                {n.status === 'running' ? (
                  <circle cx={n.x + 10} cy={n.y + 18} r={4} fill={n.color}>
                    <animate attributeName="opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite" />
                  </circle>
                ) : (
                  <circle cx={n.x + 10} cy={n.y + 18} r={4} fill={n.color} />
                )}
                <text
                  x={n.x + 20}
                  y={n.y + 16}
                  fill={colors.text || '#eee'}
                  fontSize="11"
                  fontFamily="system-ui, sans-serif"
                >
                  {(n.title || 'task').slice(0, 16)}
                </text>
                <text
                  x={n.x + 20}
                  y={n.y + 28}
                  fill={colors.textMuted || '#888'}
                  fontSize="9"
                  fontFamily="system-ui, sans-serif"
                >
                  {n.status}
                </text>
              </g>
            ))}
          </svg>
        </ScrollView>
      ) : (
        <ScrollView style={{ maxHeight: 280 }}>
          {layout.nodes.map((n) => (
            <TouchableOpacity
              key={n.id}
              onPress={() => onSelect?.(n)}
              style={{
                padding: spacing.sm,
                marginBottom: 4,
                borderLeftWidth: 3,
                borderLeftColor: n.color,
                backgroundColor: selectedId === n.id ? colors.surface : 'transparent',
              }}
            >
              <Text style={typography.body}>{n.title} · {n.status}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.sm }}>
        {Object.entries(STATUS_COLOR).map(([k, v]) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: v }} />
            <Text style={typography.caption}>{k}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
