import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Alert,
} from 'react-native';
import { Box } from '../../components/Box/Box';
import { Button } from '../../components/Button/Button';
import { ConsoleGuide } from '../../components/ConsoleGuide/ConsoleGuide';
import { ActionBar } from '../../components/ActionBar/ActionBar';
import { ScreenTabs } from '../../components/ScreenTabs/ScreenTabs';
import { aiManagerService } from '../../services/aiManagerService';
import websocketService from '../../services/websocketService';
import { AI_GUIDES } from './guides';
import { AgentChat } from './AgentChat';
import { PlansBoard } from './PlansBoard';
import { IcarusVisual } from './IcarusVisual';
import { AIManagerStyles as S } from './AIManager.styles';
import { toggleMic, subscribe, isListening } from '../../utils/icarusMic';
import { progressOf, currentWork, formatPct, relatedPlan } from '../../utils/agentWorkProgress';

const PANES = [
  { id: 'chat', label: 'Chat' },
  { id: 'plans', label: 'Plans' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'connectors', label: 'Connectors' },
  { id: 'settings', label: 'Settings' },
];

export function AgentsWorkspace({ projectId, jobs = [], navigation }) {
  const [pane, setPane] = useState('chat');
  const [agents, setAgents] = useState([]);
  const [agent, setAgent] = useState(null);
  const [setup, setSetup] = useState(null);
  const [settings, setSettings] = useState(null);
  const [messages, setMessages] = useState([]);
  const [asks, setAsks] = useState([]);
  const [work, setWork] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [fleet, setFleet] = useState(null);
  const [pins, setPins] = useState([]);
  const [rolls, setRolls] = useState({});
  const [fs, setFs] = useState({ entries: [], path: '.' });
  const [editor, setEditor] = useState({ path: '', content: '', dirty: false });
  const [diff, setDiff] = useState(null);
  const [termOut, setTermOut] = useState('');
  const [termCmd, setTermCmd] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [name, setName] = useState('icarus');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [connectors, setConnectors] = useState([]);
  const [kinds, setKinds] = useState([]);
  const [connForm, setConnForm] = useState({ name: 'mail', kind: 'gmail', secret_ref: '' });
  const [settingsForm, setSettingsForm] = useState({});
  const [cronName, setCronName] = useState('monday-inbox');
  const [cronSched, setCronSched] = useState('0 9 * * 1');
  const [cronObj, setCronObj] = useState('count inbox');
  const [crons, setCrons] = useState([]);
  const [pulseLive, setPulseLive] = useState(null);
  const [stream, setStream] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [plans, setPlans] = useState([]);
  const [boardTab, setBoardTab] = useState('current');
  const [boardFocus, setBoardFocus] = useState(null);
  const [prompts, setPrompts] = useState({ overrides: {}, effective: {}, defaults: {} });
  const [holding, setHolding] = useState(isListening());
  const [liveGraph, setLiveGraph] = useState(null);
  const [liveTools, setLiveTools] = useState([]);
  const [selectedGraphTask, setSelectedGraphTask] = useState(null);
  const [readyCount, setReadyCount] = useState(null);
  const [scrubAt, setScrubAt] = useState(null);
  const [scrubMax, setScrubMax] = useState(0);
  const [icarusPlanId, setIcarusPlanId] = useState('');
  const [icarusBench, setIcarusBench] = useState(null);
  const streamDoneTimer = useRef(null);

  useEffect(() => subscribe(setHolding), []);
  useEffect(() => () => {
    if (streamDoneTimer.current) clearTimeout(streamDoneTimer.current);
  }, []);

  const err = (e) => setError(e?.response?.data?.error?.message || e.message);

  const reloadAgent = useCallback(async (id) => {
    if (!projectId || !id) return;
    const [item, msgs, askRows, workRows, workerRows, pinRows, rollMap, cronRows, tl, planRows] = await Promise.all([
      aiManagerService.getAgent(projectId, id),
      aiManagerService.agentMessages(projectId, id),
      aiManagerService.agentAsks(projectId, id),
      aiManagerService.agentWork(projectId, id),
      aiManagerService.agentWorkers(projectId, id),
      aiManagerService.agentPins(projectId, id),
      aiManagerService.agentRolls(projectId, id),
      aiManagerService.agentCron(projectId, id),
      aiManagerService.agentTimeline(projectId, id).catch(() => []),
      aiManagerService.agentPlans(projectId, id).catch(() => []),
    ]);
    setAgent(item);
    setMessages(msgs);
    setAsks(askRows);
    setWork(workRows);
    setWorkers(workerRows);
    setPins(pinRows);
    setRolls(rollMap);
    setCrons(cronRows);
    setTimeline(tl || []);
    setPlans(planRows || []);
    try {
      const p = await aiManagerService.getAgentPrompts(projectId, id);
      setPrompts(p || { overrides: {}, effective: {}, defaults: {} });
    } catch { /* */ }
  }, [projectId]);

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      const [list, st, set, fl, kindsRows, connRows] = await Promise.all([
        aiManagerService.listAgents(projectId),
        aiManagerService.agentSetupStatus(projectId),
        aiManagerService.getAgentSettings(projectId),
        aiManagerService.agentFleet(projectId),
        aiManagerService.listConnectorKinds(projectId),
        aiManagerService.listConnectors(projectId),
      ]);
      setAgents(list);
      setSetup(st);
      setSettings(set);
      setSettingsForm(set || {});
      setFleet(fl);
      setKinds(kindsRows);
      setConnectors(connRows);
      const next = list.find((a) => a.id === agent?.id) || list[0];
      if (next) await reloadAgent(next.id);
    } catch (e) { err(e); }
  }, [projectId, agent?.id, reloadAgent]);

  useEffect(() => { load(); }, [load]);

  const scrubRangeRef = useRef({ min: 0, max: 0 });

  const hydrateLiveGraph = useCallback(async (preferHistory = false) => {
    if (!projectId) return;
    try {
      let rows = await aiManagerService.icarusPlans(projectId, {
        status: preferHistory ? 'done' : undefined,
      });
      if (!preferHistory) {
        rows = (rows || []).filter((p) => !['done', 'cancelled'].includes(p.status));
        if (!rows.length) rows = await aiManagerService.icarusPlans(projectId);
      }
      const plan = rows?.[0];
      if (!plan?.id) {
        setLiveGraph(null);
        setIcarusPlanId('');
        setReadyCount(0);
        return;
      }
      setIcarusPlanId(plan.id);
      const sub = await aiManagerService.icarusSubgraph(projectId, plan.id);
      setLiveGraph(sub);
      const ready = await aiManagerService.icarusReady(projectId, plan.id).catch(() => []);
      setReadyCount(ready.length);
      const times = (sub.tasks || []).flatMap((t) => (t.status_history || []).map((h) => h.at));
      const maxT = times.length ? Math.max(...times) : Date.now();
      const minT = times.length ? Math.min(...times) : maxT;
      scrubRangeRef.current = { min: minT, max: maxT };
      setScrubMax(preferHistory ? 100 : 0);
      setScrubAt(preferHistory ? 100 : null);
    } catch { /* graph optional until Neo4j/memory */ }
  }, [projectId]);

  useEffect(() => {
    if (pane === 'plans') hydrateLiveGraph(boardTab === 'history');
  }, [pane, boardTab, hydrateLiveGraph]);

  useEffect(() => {
    if (!projectId) return undefined;
    const room = `ai:live:${projectId}`;
    websocketService.subscribeRoom(room, { projectId });
    const offPulse = websocketService.on('ai:agent.pulse', (payload) => {
      if (payload?.pulse) setPulseLive(payload.pulse);
      if (payload?.pulse?.agent?.id && payload.pulse.agent.id === agent?.id) {
        if (payload.pulse.open_asks) setAsks(payload.pulse.open_asks);
        if (payload.pulse.work) setWork(payload.pulse.work);
        if (payload.pulse.workers) setWorkers(payload.pulse.workers);
      }
    });
    const offGraph = websocketService.on('ai:icarus.graph', (payload) => {
      if (!payload || boardTab === 'history') return;
      if (payload.project_id && payload.project_id !== projectId) return;
      setLiveGraph(payload);
      if (payload.plan_id) setIcarusPlanId(payload.plan_id);
    });
    const offTask = websocketService.on('ai:icarus.task', (payload) => {
      if (!payload?.task_id || boardTab === 'history') return;
      setLiveGraph((cur) => {
        if (!cur?.tasks) return cur;
        const tasks = cur.tasks.map((t) => (
          t.id === payload.task_id
            ? {
              ...t,
              status: payload.status || t.status,
              title: payload.title || t.title,
              agent_id: payload.agent_id || t.agent_id,
            }
            : t
        ));
        return { ...cur, tasks };
      });
      setSelectedGraphTask((cur) => (
        cur?.id === payload.task_id
          ? { ...cur, status: payload.status || cur.status, ...(payload.task || {}) }
          : cur
      ));
    });
    const offTool = websocketService.on('ai:icarus.tool', (payload) => {
      if (!payload) return;
      setLiveTools((cur) => [{ ...payload, created_at: payload.at || Date.now() }, ...cur].slice(0, 200));
    });
    const offBench = websocketService.on('ai:icarus.bench', (payload) => {
      if (!payload) return;
      if (payload.project_id && payload.project_id !== projectId) return;
      setIcarusBench(payload);
    });
    const offJob = websocketService.on('ai:job', (payload) => {
      const job = payload?.job;
      if (!job?.id) return;
      if (job.agent_id && agent?.id && job.agent_id !== agent.id) return;
      if (['queued', 'running'].includes(job.status)) {
        setStream((cur) => ({
          jobId: job.id,
          status: job.status,
          phase: job.status === 'queued' ? 'called' : 'waiting',
          partial: cur?.jobId === job.id ? (cur.partial || '') : '',
        }));
      }
      if (['succeeded', 'failed', 'cancelled'].includes(job.status)) {
        setStream((cur) => ({
          jobId: job.id,
          status: job.status,
          phase: 'done',
          partial: job.status === 'succeeded'
            ? (cur?.jobId === job.id ? (cur.partial || job.partial || '') : (job.partial || ''))
            : '',
        }));
        if (streamDoneTimer.current) clearTimeout(streamDoneTimer.current);
        streamDoneTimer.current = setTimeout(() => {
          setStream((cur) => (cur?.jobId === job.id && cur.phase === 'done' ? null : cur));
        }, 4000);
        if (agent?.id) {
          Promise.resolve(reloadAgent(agent.id)).finally(() => {
            setStream((cur) => {
              if (!cur || cur.jobId !== job.id || cur.phase !== 'done') return cur;
              return { ...cur, partial: '' };
            });
          });
        }
      }
    });
    const offToken = websocketService.on('ai:job.token', (payload) => {
      if (!payload?.job_id || !payload.partial) return;
      setStream((cur) => ({
        jobId: payload.job_id,
        status: 'running',
        phase: 'waiting',
        partial: payload.partial,
      }));
    });
    const offAsk = websocketService.on('ai:agent.ask', (payload) => {
      if (payload?.ask) setAsks((prev) => {
        const rest = prev.filter((a) => a.id !== payload.ask.id);
        return [...rest, payload.ask];
      });
    });
    const offAns = websocketService.on('ai:agent.ask.answered', (payload) => {
      if (payload?.ask) setAsks((prev) => prev.map((a) => (a.id === payload.ask.id ? payload.ask : a)));
    });
    return () => {
      offPulse?.(); offGraph?.(); offTask?.(); offTool?.(); offBench?.();
      offJob?.(); offToken?.(); offAsk?.(); offAns?.();
    };
  }, [projectId, agent?.id, boardTab, reloadAgent]);

  useEffect(() => {
    if (typeof window === 'undefined' || !agent?.id || !projectId) return undefined;
    const post = (ev) => {
      aiManagerService.agentConsoleEvents(projectId, agent.id, [ev]).catch(() => {});
    };
    const onErr = (e) => post({
      type: 'error', text: e.message || String(e), url: window.location?.href || '', at: Date.now(),
    });
    const onRej = (e) => post({
      type: 'unhandledrejection', text: String(e.reason || e), url: window.location?.href || '', at: Date.now(),
    });
    window.addEventListener('error', onErr);
    window.addEventListener('unhandledrejection', onRej);
    return () => {
      window.removeEventListener('error', onErr);
      window.removeEventListener('unhandledrejection', onRej);
    };
  }, [projectId, agent?.id]);

  const runSetup = async () => {
    setBusy(true); setError(null);
    try {
      await aiManagerService.agentSetup(projectId, { name, timezone: 'America/Los_Angeles' });
      await load();
    } catch (e) { err(e); } finally { setBusy(false); }
  };

  const sendChat = async () => {
    if (!agent || !chatInput.trim()) return;
    const content = chatInput.trim();
    setChatInput('');
    setBusy(true); setError(null);
    setMessages((prev) => [...prev, { id: `local-${Date.now()}`, role: 'user', content, layer: 'user' }]);
    if (agent.mode === 'ask') {
      setStream({ jobId: 'pending', status: 'queued', phase: 'called', partial: '' });
    }
    try {
      const out = await aiManagerService.agentChat(projectId, agent.id, { content });
      if (out?.job_id) {
        setStream({ jobId: out.job_id, status: 'queued', phase: 'called', partial: '' });
      } else {
        setStream(null);
      }
      await reloadAgent(agent.id);
    } catch (e) { err(e); } finally { setBusy(false); }
  };

  const setMode = async (mode) => {
    if (!agent) return;
    const next = await aiManagerService.updateAgent(projectId, agent.id, { mode });
    setAgent(next);
  };

  const approve = async (ask, answer) => {
    setBusy(true);
    try {
      await aiManagerService.agentApprove(projectId, agent.id, { ask_id: ask.id, answer });
      await reloadAgent(agent.id);
    } catch (e) { err(e); } finally { setBusy(false); }
  };

  const interrupt = async (stop) => {
    if (!agent) return;
    await aiManagerService.agentInterrupt(projectId, agent.id, { content: stop ? 'stop' : chatInput || 'more context', stop });
    setStream(null);
    await reloadAgent(agent.id);
  };

  const openPath = async (rel) => {
    const data = await aiManagerService.agentFs(projectId, agent.id, rel);
    if (data.file) {
      setEditor({ path: rel, content: data.content || '', dirty: false });
      setDiff(null);
    } else {
      setFs(data);
    }
  };

  const proposeWrite = () => {
    if (!editor.path) return;
    setDiff({ path: editor.path, content: editor.content });
  };

  const applyDiff = async () => {
    if (!diff) return;
    setBusy(true);
    try {
      const out = await aiManagerService.agentFsWrite(projectId, agent.id, { path: diff.path, content: diff.content });
      if (out.pending) {
        Alert.alert('ASK', out.ask?.text || 'Write needs approval');
      }
      setDiff(null);
      await reloadAgent(agent.id);
    } catch (e) { err(e); } finally { setBusy(false); }
  };

  const runTerm = async () => {
    if (!termCmd.trim() || !agent) return;
    setBusy(true);
    try {
      const out = await aiManagerService.agentTerm(projectId, agent.id, termCmd.trim());
      setTermOut(JSON.stringify(out.result || out, null, 2));
      if (out.pending) Alert.alert('ASK', out.ask?.text || 'Command needs approval');
      await reloadAgent(agent.id);
    } catch (e) { err(e); } finally { setBusy(false); }
  };

  const playAudio = (b64) => {
    if (!b64 || typeof window === 'undefined' || !window.Audio) return;
    try {
      const audio = new window.Audio(`data:audio/wav;base64,${b64}`);
      audio.play().catch(() => {});
    } catch { /* */ }
  };

  const sendVoice = async (body) => {
    if (!agent) return;
    setBusy(true);
    try {
      const out = await aiManagerService.agentVoice(projectId, agent.id, body);
      if (out?.audio_base64) playAudio(out.audio_base64);
      if (out?.job_id) {
        setStream({ jobId: out.job_id, status: 'queued', phase: 'called', partial: '' });
      } else if (agent.mode === 'ask') {
        setStream(null);
      }
      await reloadAgent(agent.id);
    } catch (e) { err(e); } finally { setBusy(false); }
  };

  const voice = async () => {
    if (!agent) return;
    const res = await toggleMic({
      onStop: async (b64) => { await sendVoice({ audio_base64: b64 }); },
    });
    if (res.unsupported) {
      if (chatInput.trim()) {
        await sendVoice({ transcript: chatInput.trim() });
        setChatInput('');
      }
    }
  };

  const goals = work.filter((w) => w.kind === 'goal');
  const tasksOf = (gid) => work.filter((w) => w.parent_id === gid);
  const now = currentWork(workers, work);
  const liveGoal = goals.find((g) => ['running', 'accepted', 'queued', 'waiting_ask'].includes(g.status)) || goals[0];
  const liveProg = liveGoal ? progressOf(liveGoal, work, relatedPlan(liveGoal, plans)) : null;
  const openTask = (taskId) => {
    if (!taskId || !navigation) return;
    navigation.navigate('aiAgentTask', { taskId, agentId: agent?.id || '' });
  };

  return (
    <>
      <ActionBar actions={[
        { title: 'Setup Icarus', onPress: runSetup, loading: busy },
        { title: 'Refresh', variant: 'secondary', onPress: load },
        { title: 'Resume', variant: 'secondary', onPress: () => aiManagerService.agentResume(projectId).then(load).catch(err) },
      ]} />
      {error ? <Box style={S.errorBox}><Text style={S.errorText}>{error}</Text></Box> : null}

      <Box title="Fabric">
        <Text style={S.hintText}>
          Topology: {setup?.topology?.ai || 'orin'} brain · {setup?.topology?.computer || 'prod-mini'} computer
          · jail {setup?.topology?.workspace_root || '/home/aerekos/work'}
        </Text>
        <Text style={S.hintText}>
          Ready: {setup?.ready ? 'yes' : 'not yet'} · queued intelligence {setup?.checks?.intelligence_queued ? 'ok' : 'missing'}
          · memory {setup?.checks?.memory ? 'ok' : 'missing'}
        </Text>
        {!setup?.ready ? (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' }}>
            <TextInput style={S.input} value={name} onChangeText={setName} placeholder="agent name" />
            <Button title="Run setup" onPress={runSetup} loading={busy} />
          </View>
        ) : null}
      </Box>

      {liveProg || now ? (
        <Box title={liveGoal ? `${liveGoal.title} · ${formatPct(liveProg)}` : 'In flight'}>
          <View style={S.progressTrack}>
            <View style={[S.progressFill, { width: `${Math.max(0, Math.min(100, liveProg?.pct || 0))}%` }]} />
          </View>
          <TouchableOpacity onPress={() => openTask(now?.task?.id || liveGoal?.id)} activeOpacity={0.8}>
            <Text style={[S.rowName, { marginTop: 8 }]}>
              Currently: {now?.label || liveProg?.currentTitle || 'idle'}
            </Text>
            <Text style={S.rowSub}>
              {now?.worker ? `${now.worker.persona} · ${now.worker.status}` : (agent?.mode || 'ask')}
              {liveGoal ? ' · tap for details' : ''}
            </Text>
          </TouchableOpacity>
        </Box>
      ) : null}

      <ScreenTabs tabs={PANES} active={pane} onChange={setPane} />

      {pane === 'chat' ? (
        agent ? (
          <>
            <IcarusVisual pulse={pulseLive || { work, workers, open_asks: asks, gateway: fleet?.gateway }} stream={stream} timeline={timeline} />
            <AgentChat
              agent={agent}
              agents={agents}
              messages={messages}
              asks={asks}
              chatInput={chatInput}
              setChatInput={setChatInput}
              busy={busy}
              stream={stream}
              gateway={pulseLive?.gateway || fleet?.gateway}
              holding={holding}
              onSelectAgent={(a) => reloadAgent(a.id)}
              onSend={sendChat}
              onInterrupt={interrupt}
              onVoice={voice}
              onHoldStart={undefined}
              onHoldEnd={undefined}
              onApprove={approve}
              onMode={setMode}
              onOpenBoard={(ref) => {
                setBoardFocus(ref);
                setBoardTab('current');
                setPane('plans');
              }}
            />
          </>
        ) : (
          <Box title="Chat">
            <Text style={S.hintText}>No agents yet. Run setup, then this becomes a ChatGPT-style window.</Text>
          </Box>
        )
      ) : null}

      {pane === 'plans' ? (
        <PlansBoard
          plans={plans}
          work={work}
          workers={workers}
          asks={asks}
          timeline={timeline}
          boardTab={boardTab}
          setBoardTab={setBoardTab}
          focus={boardFocus}
          onOpenChat={() => setPane('chat')}
          onOpenTask={openTask}
          projectId={projectId}
          liveGraph={liveGraph}
          liveTools={liveTools}
          gateway={pulseLive?.gateway || fleet?.gateway}
          readyCount={readyCount}
          selectedGraphTask={selectedGraphTask}
          onSelectGraphTask={setSelectedGraphTask}
          scrubAt={scrubAt}
          scrubMax={scrubMax}
          bench={icarusBench}
          onScrub={async (pct) => {
            setScrubAt(pct);
            if (!icarusPlanId || boardTab !== 'history') return;
            const { min, max } = scrubRangeRef.current;
            const at = min + ((max - min) * (Number(pct) || 0)) / 100;
            try {
              const sub = await aiManagerService.icarusScrub(projectId, icarusPlanId, at);
              setLiveGraph(sub);
            } catch { /* */ }
          }}
        />
      ) : null}

      {pane === 'connectors' ? (
        <Box title="Connectors">
          <Text style={S.hintText}>Shared per project. Friend memory stays per agent. Not email_manager.</Text>
          {(kinds || []).map((k) => (
            <Text key={k.name} style={S.rowSub}>{k.name} · {k.auth} · {(k.tools || []).map((t) => t.name).join(', ')}</Text>
          ))}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            <TextInput style={S.input} value={connForm.name} onChangeText={(v) => setConnForm({ ...connForm, name: v })} placeholder="name" />
            <TextInput style={S.input} value={connForm.kind} onChangeText={(v) => setConnForm({ ...connForm, kind: v })} placeholder="kind" />
            <TextInput style={S.input} value={connForm.secret_ref} onChangeText={(v) => setConnForm({ ...connForm, secret_ref: v })} placeholder="secret_ref" />
            <Button title="Connect" onPress={async () => {
              try {
                await aiManagerService.createConnector(projectId, connForm);
                setConnectors(await aiManagerService.listConnectors(projectId));
              } catch (e) { err(e); }
            }} />
          </View>
          {(connectors || []).map((c) => (
            <View key={c.id} style={S.row}>
              <View style={S.rowMain}>
                <Text style={S.rowName}>{c.name} · {c.kind}</Text>
                <Text style={S.rowSub}>{c.status} · {c.arn}</Text>
              </View>
              {c.status === 'needs_auth' || c.status === 'expired' ? (
                <Button title="Reconnect" variant="secondary" onPress={() => Alert.alert('OAuth', `Set secret_ref on ${c.name} then PATCH status connected.`)} />
              ) : null}
            </View>
          ))}
        </Box>
      ) : null}

      {pane === 'settings' ? (
        <Box title="Project agent settings">
          <Text style={S.hintText}>Every knob is also on API + SDK. Default concurrency 1. Writes ASK.</Text>
          {['llm_max_concurrent', 'workspace_root', 'workspace_worker_id', 'write_policy', 'notify_on_ask', 'notify_on_done', 'lane_min_interval_ms'].map((k) => (
            <View key={k} style={{ marginBottom: 8 }}>
              <Text style={S.rowSub}>{k}</Text>
              <TextInput
                style={S.input}
                value={String(settingsForm?.[k] ?? '')}
                onChangeText={(v) => setSettingsForm({ ...settingsForm, [k]: v })}
              />
            </View>
          ))}
          <Button title="Save settings" onPress={async () => {
            const next = await aiManagerService.updateAgentSettings(projectId, {
              ...settingsForm,
              llm_max_concurrent: Number(settingsForm.llm_max_concurrent || 1),
              lane_min_interval_ms: Number(settingsForm.lane_min_interval_ms || 0),
              compact_pct: undefined,
            });
            setSettings(next);
            const pct = Number(settingsForm.compact_pct || 65);
            if (agent?.intelligence) {
              try {
                const items = await aiManagerService.listIntelligence(projectId);
                const ep = (items || []).find((i) => i.name === agent.intelligence) || items?.[0];
                if (ep?.id) {
                  const opts = typeof ep.options === 'string' ? JSON.parse(ep.options || '{}') : (ep.options || {});
                  const ratio = Math.min(0.95, Math.max(0.2, (Number.isFinite(pct) ? pct : 65) / 100));
                  await aiManagerService.updateIntelligence(projectId, ep.id, {
                    options: { ...opts, compact: { ...(opts.compact || {}), enabled: true, threshold_ratio: ratio } },
                  });
                }
              } catch (e) { err(e); }
            }
          }} />
          <View style={{ marginTop: 8 }}>
            <Text style={S.rowSub}>Compact at % of the brain window</Text>
            <TextInput
              style={S.input}
              value={String(settingsForm?.compact_pct ?? '65')}
              onChangeText={(v) => setSettingsForm({ ...settingsForm, compact_pct: v })}
              keyboardType="numeric"
            />
          </View>
          {agent ? (
            <View style={{ marginTop: 16 }}>
              <Text style={S.rowName}>This agent</Text>
              <Text style={S.hintText}>{agent.arn}</Text>
              <Text style={S.hintText}>tz {agent.timezone} · intel {agent.intelligence || '—'} · memory {agent.memory || '—'}</Text>
              <Button title="Refresh rolls" variant="secondary" onPress={() => aiManagerService.agentRefreshRolls(projectId, agent.id).then(setRolls)} style={{ marginTop: 8, alignSelf: 'flex-start' }} />
              <Button title="Export memory" variant="secondary" onPress={() => aiManagerService.agentExportMemory(projectId, agent.id).then((d) => Alert.alert('Export', `${(d.pins || []).length} pins`))} style={{ marginTop: 8, alignSelf: 'flex-start' }} />
              <Button title="Wipe memory" variant="secondary" onPress={() => aiManagerService.agentWipeMemory(projectId, agent.id).then(() => reloadAgent(agent.id))} style={{ marginTop: 8, alignSelf: 'flex-start' }} />
              <Text style={[S.rowName, { marginTop: 16 }]}>Prompts</Text>
              <Text style={S.hintText}>Empty = bundled default. Hard denies stay in code even if you paste “ignore all rules.”</Text>
              {['user', 'manager', 'worker'].map((k) => (
                <View key={k} style={{ marginBottom: 8 }}>
                  <Text style={S.rowSub}>{k}</Text>
                  <TextInput
                    style={[S.input, { minHeight: 80 }]}
                    multiline
                    value={String(prompts.overrides?.[k] ?? prompts.effective?.[k] ?? '')}
                    onChangeText={(v) => setPrompts({
                      ...prompts,
                      overrides: { ...(prompts.overrides || {}), [k]: v },
                    })}
                  />
                </View>
              ))}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Button title="Save prompts" onPress={async () => {
                  const next = await aiManagerService.patchAgentPrompts(projectId, agent.id, prompts.overrides || {});
                  setPrompts(next);
                }} />
                <Button title="Reset prompts" variant="secondary" onPress={async () => {
                  const next = await aiManagerService.resetAgentPrompts(projectId, agent.id);
                  setPrompts(next);
                }} />
              </View>
            </View>
          ) : null}
        </Box>
      ) : null}

      {pane === 'workspace' ? (
        <>
          <Box title="Agents">
            {agents.length === 0 ? <Text style={S.hintText}>No agents. Run setup.</Text> : agents.map((a) => (
              <TouchableOpacity key={a.id} style={S.row} onPress={() => reloadAgent(a.id)} activeOpacity={0.8}>
                <View style={S.rowMain}>
                  <Text style={S.rowName}>{a.display_name || a.name}{agent?.id === a.id ? ' · open' : ''}</Text>
                  <Text style={S.rowSub}>{a.mode} · {a.arn}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </Box>

          {agent ? (
            <>
              <Box title={`${agent.display_name || agent.name} · ${agent.mode}`}>
                <Text style={S.hintText}>Chat lives on the Chat tab. This pane is files, goals, and memory.</Text>
                <Button title="Open chat" variant="secondary" onPress={() => setPane('chat')} style={{ marginTop: 8, alignSelf: 'flex-start' }} />
              </Box>

              <Box title="Goals">
                {goals.length === 0 ? <Text style={S.hintText}>No work graph yet. Plan or Agent mode hands off.</Text> : goals.map((g) => {
                  const gp = progressOf(g, work, relatedPlan(g, plans));
                  return (
                  <View key={g.id} style={{ marginBottom: 8 }}>
                    <TouchableOpacity onPress={() => openTask(g.id)} activeOpacity={0.8}>
                      <Text style={S.rowName}>{g.title} · {g.status} · {formatPct(gp)}</Text>
                      <View style={S.progressTrack}>
                        <View style={[S.progressFill, { width: `${Math.max(0, Math.min(100, gp.pct))}%` }]} />
                      </View>
                    </TouchableOpacity>
                    {tasksOf(g.id).map((t) => {
                      const tp = progressOf(t, work, relatedPlan(t, plans));
                      return (
                      <View key={t.id} style={{ marginTop: 4 }}>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                          <TouchableOpacity onPress={() => openTask(t.id)} style={{ flex: 1 }}>
                            <Text style={S.rowSub}>{t.title} · {t.status} · {formatPct(tp)} · p{t.priority}</Text>
                          </TouchableOpacity>
                          <Button title="Now" variant="secondary" onPress={async () => {
                            await aiManagerService.patchAgentWork(projectId, agent.id, t.id, { priority: '1' });
                            reloadAgent(agent.id);
                          }} />
                          <Button title="Next" variant="secondary" onPress={async () => {
                            await aiManagerService.patchAgentWork(projectId, agent.id, t.id, { priority: '2' });
                            reloadAgent(agent.id);
                          }} />
                          <Button title="Later" variant="secondary" onPress={async () => {
                            await aiManagerService.patchAgentWork(projectId, agent.id, t.id, { priority: '5' });
                            reloadAgent(agent.id);
                          }} />
                        </View>
                        {work.filter((w) => w.kind === 'task' && w.parent_id === t.id).map((st) => (
                          <TouchableOpacity key={st.id} onPress={() => openTask(st.id)}>
                            <Text style={S.rowSub}>    {st.title} · {st.status}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      );
                    })}
                  </View>
                  );
                })}
                {workers.map((w) => (
                  <TouchableOpacity key={w.id} onPress={() => openTask(w.work_item_id)}>
                    <Text style={S.rowSub}>{w.persona} {w.status}: {w.objective}</Text>
                  </TouchableOpacity>
                ))}
              </Box>

              <Box title="Computer">
                <Text style={S.hintText}>Jail {settings?.workspace_root}. Reads run; writes ASK.</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <Button title="List ." variant="secondary" onPress={() => openPath('.')} />
                  {(fs.entries || []).map((e) => (
                    <TouchableOpacity key={e.name} onPress={() => openPath(`${fs.path === '.' ? '' : `${fs.path}/`}${e.name}`)}>
                      <Text style={S.rowSub}>{e.dir ? '▸' : ''} {e.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {editor.path ? (
                  <>
                    <Text style={S.rowName}>{editor.path}</Text>
                    <TextInput
                      style={[S.input, { minHeight: 120 }]}
                      multiline
                      value={editor.content}
                      onChangeText={(v) => setEditor({ ...editor, content: v, dirty: true })}
                    />
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                      <Button title="Propose diff" variant="secondary" onPress={proposeWrite} />
                      {diff ? (
                        <>
                          <Button title="Apply" onPress={applyDiff} />
                          <Button title="Reject" variant="secondary" onPress={() => setDiff(null)} />
                        </>
                      ) : null}
                    </View>
                  </>
                ) : null}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' }}>
                  <TextInput style={S.input} value={termCmd} onChangeText={setTermCmd} placeholder="ls" onSubmitEditing={runTerm} />
                  <Button title="Run" variant="secondary" onPress={runTerm} />
                </View>
                {termOut ? <Text style={S.hintText} selectable>{termOut}</Text> : null}
              </Box>

              <Box title="Memory + routines">
                <Text style={S.hintText}>Today: {rolls.today?.body || '—'}</Text>
                {pins.map((p) => (
                  <View key={p.key} style={S.row}>
                    <Text style={S.rowMain}>{p.key} = {p.value}</Text>
                    <Button title="Forget" variant="secondary" onPress={() => aiManagerService.agentForget(projectId, agent.id, p.key).then(() => reloadAgent(agent.id))} />
                  </View>
                ))}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  <TextInput style={S.input} value={cronName} onChangeText={setCronName} placeholder="cron name" />
                  <TextInput style={S.input} value={cronSched} onChangeText={setCronSched} placeholder="cron" />
                  <TextInput style={S.input} value={cronObj} onChangeText={setCronObj} placeholder="handoff" />
                  <Button title="Add cron" variant="secondary" onPress={async () => {
                    await aiManagerService.agentCreateCron(projectId, agent.id, { name: cronName, schedule: cronSched, handoff: { objective: cronObj } });
                    await reloadAgent(agent.id);
                  }} />
                </View>
                {crons.map((c) => (
                  <View key={c.id} style={S.row}>
                    <Text style={S.rowMain}>{c.name} · {c.schedule}</Text>
                    <Button title="Fire" variant="secondary" onPress={() => aiManagerService.agentFireCron(projectId, agent.id, c.id).then(() => reloadAgent(agent.id))} />
                  </View>
                ))}
              </Box>
            </>
          ) : null}
        </>
      ) : null}

      <ConsoleGuide title={AI_GUIDES.agents.title} steps={AI_GUIDES.agents.steps} />
    </>
  );
}
