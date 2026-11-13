import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Platform, ActivityIndicator, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/Button/Button';
import { colors } from '../../styles/theme';
import { isPlaceholderContent, llmPhase, livePrompt } from '../../utils/icarusThink';
import { AIManagerStyles as S } from './AIManager.styles';

const MODES = [
  { id: 'ask', label: 'Ask' },
  { id: 'plan', label: 'Plan' },
  { id: 'agent', label: 'Agent' },
];

function parseAskJson(text) {
  if (!text || !String(text).includes('<<ASK_JSON>>')) return null;
  try {
    return JSON.parse(String(text).split('<<ASK_JSON>>')[1].split('<</ASK_JSON>>')[0]);
  } catch {
    return null;
  }
}

function parseBoardLink(text) {
  const m = String(text || '').match(/<<LINK\s+([^>]+)>>/);
  if (!m) return null;
  const out = {};
  for (const part of String(m[1]).trim().split(/\s+/)) {
    const [k, v] = part.split(':');
    if (k === 'plan' && v) out.plan_id = v;
    if (k === 'task' && v) out.task_id = v;
  }
  return out.plan_id || out.task_id ? out : null;
}

function displayContent(message) {
  const c = String(message.content || '');
  return c
    .replace(/<<ASK_JSON>>[\s\S]*?<<\/ASK_JSON>>/g, '')
    .replace(/<<ASK>>[\s\S]*?<<\/ASK>>/g, '')
    .replace(/<<LINK\s+[^>]+>>/g, '')
    .trim() || c;
}

function AskChips({ ask, onApprove, agentId, onOpenBoard }) {
  const [other, setOther] = useState('');
  if (!ask) return null;
  let opts = [];
  try { opts = JSON.parse(ask.options_json || '[]'); } catch { opts = []; }
  if (!opts.length) opts = ['Yes', 'No', 'Other'];
  const rec = ask.recommended;
  let payload = {};
  try { payload = typeof ask.payload === 'string' ? JSON.parse(ask.payload || '{}') : (ask.payload || {}); } catch { payload = {}; }
  const frameId = payload.frame_id;
  const frameUri = frameId && agentId
    ? `/api/services/ai_manager/api/v1/agents/${encodeURIComponent(agentId)}/browser/frames/${encodeURIComponent(frameId)}`
    : null;
  const board = (payload.plan_id || payload.task_id) ? { plan_id: payload.plan_id, task_id: payload.task_id } : null;
  const consoleErr = (payload.console || []).filter((e) => e.type === 'error' || e.type === 'pageerror' || e.type === 'requestfailed').slice(-3);
  return (
    <View style={S.gptAskCard}>
      {ask.kind === 'browse' && frameUri ? (
        <Image source={{ uri: frameUri }} style={{ width: '100%', height: 180, borderRadius: 8, marginBottom: 8, backgroundColor: '#111' }} resizeMode="contain" />
      ) : null}
      <Text style={S.rowName}>{ask.speak_text || ask.text}</Text>
      {consoleErr.length ? consoleErr.map((e, i) => (
        <Text key={i} style={S.hintText}>{e.type}: {e.text}</Text>
      )) : null}
      {board && onOpenBoard ? (
        <TouchableOpacity onPress={() => onOpenBoard(board)}>
          <Text style={S.gptBoardLink}>View in graph</Text>
        </TouchableOpacity>
      ) : null}
      <View style={S.gptAskRow}>
        {opts.filter((o) => o !== 'Other').map((o) => (
          <Button
            key={o}
            title={o === rec ? `${o} (Recommended)` : o}
            onPress={() => onApprove(ask, o)}
          />
        ))}
      </View>
      <View style={S.gptAskRow}>
        <TextInput
          style={[S.input, { minWidth: 160 }]}
          value={other}
          onChangeText={setOther}
          placeholder="Other…"
          placeholderTextColor={colors.textMuted}
        />
        <Button title="Other" variant="secondary" onPress={() => other.trim() && onApprove(ask, other.trim())} />
      </View>
    </View>
  );
}

export function AgentChat({
  agent,
  agents,
  messages,
  asks,
  chatInput,
  setChatInput,
  busy,
  stream,
  gateway,
  holding,
  onSelectAgent,
  onSend,
  onInterrupt,
  onVoice,
  onHoldStart,
  onHoldEnd,
  onApprove,
  onMode,
  onOpenBoard,
}) {
  const scroller = useRef(null);

  useEffect(() => {
    const id = setTimeout(() => scroller.current?.scrollToEnd?.({ animated: true }), 40);
    return () => clearTimeout(id);
  }, [messages, stream?.partial, stream?.phase, stream?.status, asks]);

  const openAsks = (asks || []).filter((a) => a.status === 'open');
  const visible = (messages || []).filter((m) => {
    if (m.layer === 'inter' || m.role === 'system') return false;
    if (m.role === 'assistant' && isPlaceholderContent(m.content)) return false;
    return true;
  });
  const askById = Object.fromEntries((asks || []).map((a) => [a.id, a]));
  const phase = llmPhase(stream, gateway);
  const live = livePrompt(phase.phase, stream?.partial);
  const modeLabel = (MODES.find((m) => m.id === agent.mode) || {}).label || agent.mode || 'Ask';

  return (
    <View style={S.gptShell}>
      <View style={S.gptHeader}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={S.gptTitle} numberOfLines={2}>{agent.display_name || agent.name}</Text>
          <Text style={S.gptSub}>{modeLabel} · Icarus</Text>
        </View>
        <View style={S.gptModes}>
          {MODES.map((m) => (
            <TouchableOpacity
              key={m.id}
              onPress={() => onMode(m.id)}
              style={[S.selectChip, agent.mode === m.id && S.selectChipActive]}
            >
              <Text style={S.selectChipText}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {(agents || []).length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.gptAgentRow}>
          {agents.map((a) => (
            <TouchableOpacity key={a.id} onPress={() => onSelectAgent(a)} style={[S.selectChip, agent.id === a.id && S.selectChipActive]}>
              <Text style={S.selectChipText}>{a.display_name || a.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}

      <ScrollView
        ref={scroller}
        style={S.gptThread}
        contentContainerStyle={S.gptThreadInner}
        keyboardShouldPersistTaps="handled"
      >
        {visible.length === 0 ? (
          <View style={S.gptEmpty}>
            <Text style={S.gptEmptyTitle}>What can I help with?</Text>
            <Text style={S.hintText}>Ask is hangout. Plan and Agent confirm a brief, then preview. Browse shows a screenshot and waits.</Text>
          </View>
        ) : visible.map((m, i) => {
          const mine = m.role === 'user';
          const ask = !mine && (askById[m.ask_id] || parseAskJson(m.content));
          return (
            <View key={m.id || i} style={[S.gptRow, mine ? S.gptRowMine : S.gptRowTheirs]}>
              <View style={[S.gptBubble, mine ? S.gptBubbleMine : S.gptBubbleTheirs]}>
                <Text style={[S.gptBubbleText, mine && S.gptBubbleTextMine]} selectable>
                  {displayContent(m)}
                </Text>
                {!mine && parseBoardLink(m.content) && onOpenBoard ? (
                  <TouchableOpacity onPress={() => onOpenBoard(parseBoardLink(m.content))}>
                    <Text style={S.gptBoardLink}>View in graph</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {ask && ask.status === 'open' ? <AskChips ask={ask} onApprove={onApprove} agentId={agent.id} onOpenBoard={onOpenBoard} /> : null}
            </View>
          );
        })}

        {phase.phase !== 'idle' ? (
          <View style={[S.gptRow, S.gptRowTheirs]}>
            <View style={[S.gptBubble, S.gptBubbleTheirs, S.llmLiveRow]}>
              {phase.phase !== 'done' ? (
                <ActivityIndicator size="small" color={colors.textMuted} />
              ) : null}
              <Text style={S.gptBubbleText} selectable>{live || phase.label}</Text>
            </View>
          </View>
        ) : null}

        {openAsks.filter((a) => !visible.some((m) => m.ask_id === a.id)).map((a) => (
          <AskChips key={a.id} ask={a} onApprove={onApprove} agentId={agent.id} onOpenBoard={onOpenBoard} />
        ))}
      </ScrollView>

      <View style={S.gptComposer}>
        <TextInput
          style={[S.input, S.gptInput]}
          value={chatInput}
          onChangeText={setChatInput}
          placeholder="Message Icarus…"
          placeholderTextColor={colors.textMuted}
          multiline
          onSubmitEditing={Platform.OS === 'web' ? undefined : onSend}
        />
        <View style={S.gptComposerActions}>
          <TouchableOpacity
            onPress={onVoice}
            style={[S.iconBtn, holding && { opacity: 0.6 }]}
            accessibilityLabel="Click to talk"
          >
            <Ionicons name={holding ? 'mic' : 'mic-outline'} size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Button title="Stop" variant="secondary" onPress={() => onInterrupt(true)} />
          <Button title="Send" onPress={onSend} loading={busy} disabled={!chatInput.trim() || busy} style={S.sendBtn} />
        </View>
      </View>
    </View>
  );
}
