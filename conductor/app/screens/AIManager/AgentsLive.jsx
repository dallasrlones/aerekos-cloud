import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { colors, spacing, typography } from '../../styles/theme';

function NodeCard({ title, sub, meta, onPress, accent }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        minWidth: 160,
        maxWidth: 220,
        padding: spacing.sm,
        margin: 4,
        borderWidth: 1,
        borderColor: accent || colors.divider,
        borderRadius: 8,
        backgroundColor: colors.surface,
      }}
    >
      <Text style={{ ...typography.body, fontWeight: '600' }}>{title}</Text>
      {sub ? <Text style={{ ...typography.caption, marginTop: 2 }}>{sub}</Text> : null}
      {meta ? <Text style={{ ...typography.caption, marginTop: 4, color: colors.textMuted }}>{meta}</Text> : null}
    </TouchableOpacity>
  );
}

export function AgentsLive({ fleet, jobs = [], onSelectAgent, onSelectJob }) {
  const gw = fleet?.gateway || {};
  const inflight = gw.in_flight || [];
  const queued = gw.queued || [];
  const owner = inflight[0];

  return (
    <View>
      <Text style={{ ...typography.caption, marginBottom: spacing.sm }}>
        Gateway max {gw.max_concurrent || 1}. GPU owner: {owner ? `${owner.lane} · agent ${owner.agent_id || '—'}` : 'idle'}.
        Queue {queued.length}.
      </Text>
      <ScrollView horizontal style={{ marginBottom: spacing.md }}>
        {(fleet?.agents || []).map((a) => (
          <View key={a.id} style={{ marginRight: spacing.md }}>
            <NodeCard
              title={a.name}
              sub={`${a.mode} · ${a.status}`}
              meta={`manager work ${a.layers?.manager?.work || 0}`}
              accent={colors.primary}
              onPress={() => onSelectAgent?.(a)}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginLeft: 12 }}>
              <NodeCard title="user" sub="friend" meta="human I/O only" onPress={() => onSelectAgent?.(a)} />
              <NodeCard title="manager" sub="PM" meta={`${a.layers?.manager?.work || 0} active`} onPress={() => onSelectAgent?.(a)} />
              {(a.layers?.workers || []).map((w) => (
                <NodeCard
                  key={w.id}
                  title={w.persona || 'worker'}
                  sub={w.status}
                  meta={w.objective}
                  onPress={() => onSelectAgent?.(a)}
                />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
      <Text style={{ ...typography.body, fontWeight: '600', marginBottom: 6 }}>LLM jobs</Text>
      {(jobs || []).slice(0, 12).map((j) => (
        <TouchableOpacity key={j.id} onPress={() => onSelectJob?.(j)} style={{ paddingVertical: 6 }}>
          <Text style={typography.body}>{j.intelligence} · {j.status}</Text>
          <Text style={typography.caption}>{j.request?.lane || '—'} · {j.id}</Text>
        </TouchableOpacity>
      ))}
      {(jobs || []).length === 0 ? <Text style={typography.caption}>No intelligence jobs in this project yet.</Text> : null}
    </View>
  );
}
