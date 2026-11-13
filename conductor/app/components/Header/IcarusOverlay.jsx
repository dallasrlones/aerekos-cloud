import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../styles/theme';
import { GlobalSearchStyles as S } from '../GlobalSearch/GlobalSearch.styles';
import { useProject } from '../../contexts/ProjectContext';
import { SYSTEM_PROJECT_ID } from '../../services/projectInventory';
import { aiManagerService } from '../../services/aiManagerService';
import { computeManagerService } from '../../services/computeManagerService';
import { matchNav } from '../../utils/icarusNavCatalog';
import { toggleMic, subscribe, isListening } from '../../utils/icarusMic';

const PROD = 'ea370977-3aff-4c76-95a6-a0c50fd2bce7';

function focusAnchor(anchor) {
  if (!anchor || typeof document === 'undefined') return false;
  const el = document.querySelector(`[data-icarus-anchor="${anchor}"]`) || document.getElementById(`icarus-${anchor}`);
  if (el && el.scrollIntoView) {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    try { window.dispatchEvent(new CustomEvent('icarus:focus', { detail: { anchor } })); } catch { /* */ }
    return true;
  }
  try { window.dispatchEvent(new CustomEvent('icarus:focus', { detail: { anchor } })); } catch { /* */ }
  return false;
}

export function IcarusOverlay({ visible, onClose, navigation }) {
  const { currentProject, projects, currentEnvironment, setCurrentEnvironment } = useProject();
  const [agent, setAgent] = useState(null);
  const [pulse, setPulse] = useState(null);
  const [input, setInput] = useState('');
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [holding, setHolding] = useState(isListening());
  const [navAsk, setNavAsk] = useState(null);
  const systemPid = SYSTEM_PROJECT_ID;

  useEffect(() => subscribe(setHolding), []);

  const load = useCallback(async () => {
    try {
      const items = await aiManagerService.listAgents(systemPid);
      const hit = (items || []).find((a) => a.name === 'icarus') || items?.[0];
      setAgent(hit || null);
      if (hit) {
        const p = await aiManagerService.agentPulse(systemPid, hit.id);
        setPulse(p);
      }
    } catch {
      setAgent(null);
    }
  }, [systemPid]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const openAsk = (pulse?.open_asks || [])[0] || null;
  const pending = (pulse?.pending_asks || []).length;

  const goNav = async (hit) => {
    if (hit.env && setCurrentEnvironment) setCurrentEnvironment(hit.env);
    if (hit.screen) navigation?.navigate(hit.screen, hit.params || {});
    setTimeout(() => {
      const ok = hit.anchor ? focusAnchor(hit.anchor) : false;
      if (!ok && hit.screen) setReply(`I'm on that screen.`);
    }, 400);
  };

  const send = async (text) => {
    const t = String(text || '').trim();
    if (!t) return;
    setBusy(true);
    try {
      const hit = matchNav(t, { projects, currentProject, currentEnv: currentEnvironment });
      if (hit.kind === 'deny') {
        setReply(hit.reason);
        return;
      }
      if (hit.kind === 'nav') {
        await goNav(hit);
        setReply(hit.anchor ? `Opening ${hit.screen}.` : `I'm there.`);
        return;
      }
      if (hit.kind === 'chat' || hit.kind === 'unknown') {
        if (hit.kind === 'chat' || hit.screen === 'icarus') {
          navigation?.navigate('icarus', { section: 'chat', seed: hit.text || t, ...(hit.params || {}) });
          setReply('Opening Icarus chat with that.');
          onClose?.();
          return;
        }
        setReply('I can open Agents, IDE, Functions, API, containers, or Settings. Which?');
        return;
      }
      if (hit.kind === 'mutate') {
        if (currentProject?.id === PROD || hit.project?.id === PROD) {
          setReply('Never that on the production project.');
          return;
        }
        setNavAsk(hit);
        setReply(hit.ask);
        return;
      }
      if (!agent) {
        setReply('No system Icarus yet. Open AI Manager → Agents and run setup.');
        return;
      }
      const out = await aiManagerService.agentVoice(systemPid, agent.id, { transcript: t });
      setReply(out?.ask?.speak_text || out?.reply || '');
      if (out?.audio_base64 && typeof window !== 'undefined' && window.Audio) {
        try { new window.Audio(`data:audio/wav;base64,${out.audio_base64}`).play().catch(() => {}); } catch { /* */ }
      }
      await load();
    } catch (e) {
      setReply(e.message || 'Icarus failed');
    } finally {
      setBusy(false);
      setInput('');
    }
  };

  const approve = async (answer) => {
    if (navAsk) {
      if (!/^yes|go|ok|sound/i.test(answer)) {
        setNavAsk(null);
        setReply('Skipped.');
        return;
      }
      setBusy(true);
      try {
        const pid = navAsk.project?.id || currentProject?.id;
        const tasks = await computeManagerService.listTasks(pid, currentEnvironment);
        const rows = Array.isArray(tasks) ? tasks : (tasks?.tasks || tasks?.items || []);
        const task = (rows || []).find((x) => String(x.name || '').toLowerCase() === String(navAsk.target || '').toLowerCase());
        if (!task) {
          setReply(`I don't see container ${navAsk.target}.`);
        } else if (navAsk.action === 'compute.restart') {
          await computeManagerService.restartTask(pid, task.id);
          setReply(`Restarted ${navAsk.target}.`);
        } else if (navAsk.action === 'compute.start') {
          await computeManagerService.startTask(pid, task.id);
          setReply(`Started ${navAsk.target}.`);
        } else if (navAsk.action === 'compute.stop') {
          await computeManagerService.stopTask(pid, task.id);
          setReply(`Stopped ${navAsk.target}.`);
        }
      } catch (e) {
        setReply(e.message || 'compute call failed');
      } finally {
        setBusy(false);
        setNavAsk(null);
      }
      return;
    }
    if (!agent || !openAsk) return;
    setBusy(true);
    try {
      const out = await aiManagerService.agentApprove(systemPid, agent.id, { ask_id: openAsk.id, answer });
      setReply(out?.reply || openAsk.speak_text);
      await load();
    } catch (e) {
      setReply(e.message || 'approve failed');
    } finally { setBusy(false); }
  };

  const mic = async () => {
    const res = await toggleMic({
      onStop: async (b64) => {
        setBusy(true);
        try {
          let text = '';
          try {
            const bin = atob(b64);
            const arr = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i);
            const file = new File([arr], 'clip.webm', { type: 'audio/webm' });
            const stt = await aiManagerService.transcribeFile(file, { projectId: systemPid });
            text = String(stt?.text || stt?.transcript || '').trim();
          } catch { /* fall through to agent compose */ }
          if (text) {
            await send(text);
            return;
          }
          if (!agent) return;
          const out = await aiManagerService.agentVoice(systemPid, agent.id, { audio_base64: b64 });
          const spoken = out?.ask?.speak_text || out?.reply || '';
          const transcript = String(out?.transcript || '').trim();
          if (transcript) {
            const hit = matchNav(transcript, { projects, currentProject, currentEnv: currentEnvironment });
            if (hit.kind === 'nav' || hit.kind === 'mutate' || hit.kind === 'unknown' || hit.kind === 'deny') {
              await send(transcript);
              return;
            }
          }
          setReply(spoken);
          await load();
        } catch (e) { setReply(e.message); } finally { setBusy(false); }
      },
    });
    if (res.unsupported && input.trim()) send(input);
  };

  if (!visible) return null;
  const opts = navAsk ? ['Yes', 'No'] : (openAsk ? (typeof openAsk.options_json === 'string' ? JSON.parse(openAsk.options_json || '[]') : (openAsk.options || ['Yes', 'No'])) : []);

  return (
    <View style={S.overlay}>
      <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
      <View style={[S.panel, { maxHeight: 420 }]} onStartShouldSetResponder={() => true}>
        <View style={S.inputRow}>
          <Ionicons name="sparkles-outline" size={20} color={colors.textPrimary} />
          <TextInput
            style={S.input}
            value={input}
            onChangeText={setInput}
            placeholder="Talk to Icarus…"
            placeholderTextColor={colors.textMuted}
            onSubmitEditing={() => send(input)}
            autoFocus={Platform.OS === 'web'}
          />
          <TouchableOpacity onPress={mic} accessibilityLabel="Click to talk">
            <Ionicons name={holding ? 'mic' : 'mic-outline'} size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={colors.textPrimary} /></TouchableOpacity>
        </View>
        <ScrollView style={{ padding: 12, maxHeight: 320 }}>
          <Text style={{ color: colors.textMuted, marginBottom: 8 }}>
            System Icarus{pending ? ` · ${pending} waiting` : ''}
          </Text>
          {openAsk ? <Text style={{ color: colors.textPrimary, marginBottom: 8 }}>{openAsk.speak_text || openAsk.text}</Text> : null}
          {reply ? <Text style={{ color: colors.textPrimary, marginBottom: 8 }}>{reply}</Text> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {opts.map((o) => (
              <TouchableOpacity key={o} onPress={() => approve(o)} disabled={busy} style={{ padding: 8, borderWidth: 1, borderColor: colors.divider, borderRadius: 8 }}>
                <Text style={{ color: colors.textPrimary }}>{o}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
