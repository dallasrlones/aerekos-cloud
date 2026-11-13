import { useCallback, useEffect, useRef, useState } from 'react';
import { aiManagerService } from '../../services/aiManagerService';
import websocketService from '../../services/websocketService';
import { toggleMic, subscribe, isListening } from '../../utils/icarusMic';

/**
 * Project-scoped Icarus talk + plan graph session (sacred chat path).
 */
export function useIcarusSession(projectId) {
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
  const [crons, setCrons] = useState([]);
  const [connectors, setConnectors] = useState([]);
  const [kinds, setKinds] = useState([]);
  const [skills, setSkills] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [brainOffline, setBrainOffline] = useState(false);
  const [pulseLive, setPulseLive] = useState(null);
  const [stream, setStream] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [holding, setHolding] = useState(isListening());
  const [liveGraph, setLiveGraph] = useState(null);
  const [liveTools, setLiveTools] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [readyCount, setReadyCount] = useState(null);
  const [icarusPlanId, setIcarusPlanId] = useState('');
  const [icarusBench, setIcarusBench] = useState(null);
  const [handoff, setHandoff] = useState(null);
  const [fs, setFs] = useState({ entries: [], path: '.' });
  const [termOut, setTermOut] = useState('');
  const streamDoneTimer = useRef(null);
  const defaultedAsk = useRef(false);

  useEffect(() => subscribe(setHolding), []);
  useEffect(() => () => {
    if (streamDoneTimer.current) clearTimeout(streamDoneTimer.current);
  }, []);

  const err = (e) => setError(e?.response?.data?.error?.message || e.message);

  const reloadAgent = useCallback(async (id) => {
    if (!projectId || !id) return;
    const [item, msgs, askRows, workRows, workerRows, pinRows, rollMap, cronRows, tl] = await Promise.all([
      aiManagerService.getAgent(projectId, id),
      aiManagerService.agentMessages(projectId, id),
      aiManagerService.agentAsks(projectId, id),
      aiManagerService.agentWork(projectId, id),
      aiManagerService.agentWorkers(projectId, id),
      aiManagerService.agentPins(projectId, id),
      aiManagerService.agentRolls(projectId, id),
      aiManagerService.agentCron(projectId, id),
      aiManagerService.agentTimeline(projectId, id).catch(() => []),
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
    try {
      const sk = await aiManagerService.agentSkills?.(projectId, id);
      if (sk) setSkills(Array.isArray(sk) ? sk : (sk.items || sk.skills || []));
    } catch { /* optional */ }
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
      setFleet(fl);
      setKinds(kindsRows);
      setConnectors(connRows);
      let llmReachable = null;
      try {
        const llm = await aiManagerService.llmStatus({ projectId });
        llmReachable = llm?.reachable;
      } catch { llmReachable = false; }
      const gw = fl?.gateway || st?.gateway || st?.brain;
      const offline = st?.ok === false
        || llmReachable === false
        || gw?.reachable === false
        || gw?.status === 'offline';
      setBrainOffline(Boolean(offline));
      const next = list.find((a) => a.id === agent?.id) || list.find((a) => /icarus/i.test(a.name)) || list[0];
      if (next) {
        await reloadAgent(next.id);
        // Once per project session: land Chat in Ask so "hi" is friend talk, not shop.
        if (!defaultedAsk.current && next.mode && next.mode !== 'ask') {
          defaultedAsk.current = true;
          try {
            const updated = await aiManagerService.updateAgent(projectId, next.id, { mode: 'ask' });
            setAgent(updated || { ...next, mode: 'ask' });
          } catch { /* */ }
        } else {
          defaultedAsk.current = true;
        }
      } else setAgent(null);
    } catch (e) { err(e); }
  }, [projectId, agent?.id, reloadAgent]);

  useEffect(() => {
    defaultedAsk.current = false;
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const hydrateLiveGraph = useCallback(async () => {
    if (!projectId) return;
    try {
      let rows = await aiManagerService.icarusPlans(projectId);
      rows = (rows || []).filter((p) => !['done', 'cancelled'].includes(p.status));
      if (!rows.length) rows = await aiManagerService.icarusPlans(projectId);
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
    } catch { /* graph optional */ }
  }, [projectId]);

  useEffect(() => { hydrateLiveGraph(); }, [hydrateLiveGraph]);

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
      if (payload?.pulse?.handed_off || payload?.pulse?.manager) {
        setHandoff({ at: Date.now(), ...(payload.pulse.manager || {}), label: 'talking to manager…' });
      }
    });
    const offGraph = websocketService.on('ai:icarus.graph', (payload) => {
      if (!payload) return;
      if (payload.project_id && payload.project_id !== projectId) return;
      setLiveGraph(payload);
      if (payload.plan_id) setIcarusPlanId(payload.plan_id);
      setHandoff((h) => h || { at: Date.now(), label: 'manager plan updating…' });
    });
    const offTask = websocketService.on('ai:icarus.task', (payload) => {
      if (!payload?.task_id) return;
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
      setSelectedNode((cur) => (
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
      if (job.route === 'MANAGER' || job.gate === 'MANAGER' || job.handed_off) {
        setHandoff({ at: Date.now(), jobId: job.id, label: 'talking to manager…' });
      }
      if (['queued', 'running'].includes(job.status)) {
        setStream((cur) => ({
          jobId: job.id,
          status: job.status,
          phase: job.status === 'queued' ? 'called' : 'waiting',
          partial: cur?.jobId === job.id ? (cur.partial || '') : '',
          route: job.route || job.gate || cur?.route,
        }));
      }
      if (['succeeded', 'failed', 'cancelled'].includes(job.status)) {
        setStream((cur) => ({
          jobId: job.id,
          status: job.status,
          phase: 'done',
          // Keep streamed text until history reload lands (avoids flash-empty chat).
          partial: job.status === 'succeeded'
            ? (cur?.jobId === job.id ? (cur.partial || job.partial || '') : (job.partial || ''))
            : '',
          route: job.route || job.gate || cur?.route,
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
        hydrateLiveGraph();
      }
    });
    const offToken = websocketService.on('ai:job.token', (payload) => {
      if (!payload?.job_id || !payload.partial) return;
      setStream((cur) => ({
        jobId: payload.job_id,
        status: 'running',
        phase: 'waiting',
        partial: payload.partial,
        route: cur?.route,
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
    const offDone = websocketService.on('ai:agent.done', () => {
      if (agent?.id) reloadAgent(agent.id);
      hydrateLiveGraph();
    });
    return () => {
      offPulse?.(); offGraph?.(); offTask?.(); offTool?.(); offBench?.();
      offJob?.(); offToken?.(); offAsk?.(); offAns?.(); offDone?.();
    };
  }, [projectId, agent?.id, reloadAgent, hydrateLiveGraph]);

  const runSetup = async (name = 'icarus') => {
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
    setStream({ jobId: 'pending', status: 'queued', phase: 'called', partial: '' });
    try {
      const out = await aiManagerService.agentChat(projectId, agent.id, { content });
      if (out?.handed_off || out?.route === 'MANAGER' || out?.gate === 'MANAGER') {
        setHandoff({ at: Date.now(), label: 'talking to manager…', ...(out || {}) });
      }
      if (out?.job_id) {
        setStream({
          jobId: out.job_id,
          status: 'queued',
          phase: 'called',
          partial: '',
          route: out.route || out.gate,
        });
      } else {
        setStream(null);
      }
      await reloadAgent(agent.id);
      hydrateLiveGraph();
    } catch (e) {
      err(e);
      setStream(null);
    } finally { setBusy(false); }
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
    await aiManagerService.agentInterrupt(projectId, agent.id, {
      content: stop ? 'stop' : chatInput || 'more context',
      stop,
    });
    setStream(null);
    await reloadAgent(agent.id);
  };

  const sendVoice = async () => {
    if (!agent) return;
    const res = await toggleMic({
      onStop: async (b64) => {
        setBusy(true);
        try {
          const out = await aiManagerService.agentVoice(projectId, agent.id, { audio_base64: b64 });
          if (out?.job_id) {
            setStream({ jobId: out.job_id, status: 'queued', phase: 'called', partial: '' });
          }
          await reloadAgent(agent.id);
        } catch (e) { err(e); } finally { setBusy(false); }
      },
    });
    if (res?.unsupported && chatInput.trim()) {
      setBusy(true);
      try {
        const out = await aiManagerService.agentVoice(projectId, agent.id, { transcript: chatInput.trim() });
        setChatInput('');
        if (out?.job_id) {
          setStream({ jobId: out.job_id, status: 'queued', phase: 'called', partial: '' });
        }
        await reloadAgent(agent.id);
      } catch (e) { err(e); } finally { setBusy(false); }
    }
  };

  const openFs = async (rel = '.') => {
    if (!agent) return;
    const data = await aiManagerService.agentFs(projectId, agent.id, rel);
    setFs(data);
  };

  const runTerm = async (cmd) => {
    if (!agent || !cmd?.trim()) return;
    const out = await aiManagerService.agentTerm(projectId, agent.id, cmd.trim());
    setTermOut(typeof out === 'string' ? out : JSON.stringify(out, null, 2));
  };

  const selectAgent = async (a) => {
    if (!a?.id) return;
    await reloadAgent(a.id);
  };

  const focusGraphNode = (nodeOrLink) => {
    if (!nodeOrLink) return;
    if (nodeOrLink.task_id || nodeOrLink.plan_id) {
      const task = (liveGraph?.tasks || []).find((t) => t.id === nodeOrLink.task_id);
      if (task) {
        setSelectedNode({ ...task, kind: 'task' });
        return;
      }
      if (nodeOrLink.plan_id) {
        setSelectedNode({
          id: nodeOrLink.plan_id,
          kind: 'plan',
          title: 'Plan',
          status: 'running',
        });
        setIcarusPlanId(nodeOrLink.plan_id);
        hydrateLiveGraph();
      }
      return;
    }
    setSelectedNode(nodeOrLink);
  };

  const openAsks = (asks || []).filter((a) => a.status === 'open');
  const gateway = pulseLive?.gateway || fleet?.gateway || setup?.gateway;
  const needsSetup = !agent && setup && setup.ok !== true;

  return {
    projectId,
    agents,
    agent,
    setup,
    settings,
    messages,
    asks,
    openAsks,
    work,
    workers,
    fleet,
    pins,
    rolls,
    crons,
    connectors,
    kinds,
    skills,
    chatInput,
    setChatInput,
    busy,
    error,
    brainOffline,
    pulseLive,
    stream,
    timeline,
    holding,
    liveGraph,
    liveTools,
    selectedNode,
    setSelectedNode: focusGraphNode,
    clearSelectedNode: () => setSelectedNode(null),
    readyCount,
    icarusPlanId,
    icarusBench,
    handoff,
    fs,
    termOut,
    gateway,
    needsSetup,
    load,
    runSetup,
    sendChat,
    setMode,
    approve,
    interrupt,
    sendVoice,
    selectAgent,
    openFs,
    runTerm,
    hydrateLiveGraph,
    reloadAgent,
  };
}

export default useIcarusSession;
