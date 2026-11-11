import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Button } from '../../components/Button/Button';
import { aiManagerService } from '../../services/aiManagerService';
import { colors, spacing, typography } from '../../styles/theme';
import { STATUS_COLOR } from './planGraphLayout';

export function TaskInspector({
  projectId,
  task,
  liveTools = [],
  onOpenFull,
  onClose,
}) {
  const [trace, setTrace] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!projectId || !task?.id) return;
    setLoading(true);
    setError(null);
    try {
      const t = await aiManagerService.icarusTaskTrace(projectId, task.id, {
        agent_id: task.agent_id || '',
      });
      setTrace(t);
    } catch (e) {
      setError(e?.response?.data?.error?.message || e.message || 'trace failed');
    } finally {
      setLoading(false);
    }
  }, [projectId, task?.id, task?.agent_id]);

  useEffect(() => { load(); }, [load]);

  if (!task) {
    return (
      <View style={{ padding: spacing.md }}>
        <Text style={typography.caption}>Select a task node to inspect chat and tools.</Text>
      </View>
    );
  }

  const color = STATUS_COLOR[task.status] || STATUS_COLOR.pending;
  const tools = [
    ...(liveTools || []).filter((t) => t.task_id === task.id),
    ...((trace?.tools || []).filter((t) => !(liveTools || []).some((l) => l.id === t.id))),
  ];
  const messages = trace?.messages || [];

  return (
    <View style={{
      borderWidth: 1,
      borderColor: colors.divider,
      borderRadius: 8,
      padding: spacing.sm,
      minHeight: 200,
      maxHeight: 420,
    }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...typography.body, fontWeight: '600' }}>{task.title}</Text>
          <Text style={{ ...typography.caption, color }}>
            {task.status}
            {task.agent_id ? ` · agent ${String(task.agent_id).slice(0, 8)}` : ''}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {onOpenFull ? (
            <Button title="Full" variant="secondary" onPress={() => onOpenFull(task.id)} />
          ) : null}
          {onClose ? (
            <TouchableOpacity onPress={onClose}>
              <Text style={typography.caption}>Close</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 12 }} /> : null}
      {error ? <Text style={{ ...typography.caption, color: colors.danger || '#c23b22' }}>{error}</Text> : null}

      {trace?.why?.summary ? (
        <Text style={{ ...typography.caption, marginTop: 8, color: colors.textMuted }}>
          Why: {trace.why.summary}
        </Text>
      ) : null}

      <Text style={{ ...typography.caption, fontWeight: '600', marginTop: 12 }}>Tools</Text>
      <ScrollView style={{ maxHeight: 120 }}>
        {tools.length === 0 ? (
          <Text style={typography.caption}>No tool calls yet for this task.</Text>
        ) : tools.slice(0, 40).map((t) => (
          <Text key={t.id || `${t.tool}-${t.created_at}`} style={typography.caption}>
            {t.ok === false ? '✗' : '·'} {t.summary || t.tool}
            {t.created_at ? ` · ${new Date(t.created_at).toLocaleTimeString()}` : ''}
          </Text>
        ))}
      </ScrollView>

      <Text style={{ ...typography.caption, fontWeight: '600', marginTop: 12 }}>Chat</Text>
      <ScrollView style={{ maxHeight: 140 }}>
        {messages.length === 0 ? (
          <Text style={typography.caption}>No task-tagged messages yet (live tools still stream above).</Text>
        ) : messages.slice(-30).map((m) => (
          <Text key={m.id || `${m.role}-${m.created_at}`} style={typography.caption}>
            {m.role}: {String(m.content || '').slice(0, 160)}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}
