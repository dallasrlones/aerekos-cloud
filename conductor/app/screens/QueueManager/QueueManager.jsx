import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, RefreshControl } from 'react-native';
import { Box } from '../../components/Box/Box';
import { Button } from '../../components/Button/Button';
import { ServiceToggle } from '../../components/ServiceToggle/ServiceToggle';
import { ServiceSetupWizard } from '../../components/ServiceSetupWizard';
import { ManagerAppAccessSection } from '../../components/ManagerAppAccessSection';
import { managerService } from '../../services/managerService';
import { setupService } from '../../services/setupService';
import api from '../../utils/api';
import { useProject } from '../../contexts/ProjectContext';
import { useToast } from '../../components/Toast/ToastProvider';
import { colors } from '../../styles/theme';
import { IntegrationHubStyles as S } from '../IntegrationHub/IntegrationHub.styles';
import { ServiceGuide } from '../../components/ServiceGuide/ServiceGuide';
import { useServiceGuideDeps } from '../../hooks/useServiceGuideDeps';

const BASE = '/api/services/queue_manager/api/v1';
const ENGINES = ['standard', 'fifo', 'rabbitmq', 'redis_stream'];

export const QueueManager = ({ navigation }) => {
  const { currentProject } = useProject();
  const { showToast } = useToast();
  const projectId = currentProject?.id;
  const [status, setStatus] = useState(null);
  const [queues, setQueues] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [name, setName] = useState('');
  const [engine, setEngine] = useState('standard');
  const [dlq, setDlq] = useState('');
  const [selected, setSelected] = useState('');
  const [body, setBody] = useState('{"ping":1}');
  const [received, setReceived] = useState('');
  const { guideDeps, openDep, enableAllDeps, onSetup } = useServiceGuideDeps(
    'queue_manager',
    navigation,
    status?.enabled,
  );

  const load = useCallback(async () => {
    try {
      const st = await managerService.getStatus('queue_manager');
      setStatus(st);
      if (projectId && st?.enabled) {
        const res = await api.get(`${BASE}/queues`, { params: { project_id: projectId } });
        setQueues(res.data?.queues || []);
      }
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (enabled) => {
    setBusy(true);
    try {
      if (enabled) await setupService.enable(projectId, 'queue_manager');
      else await managerService.disable('queue_manager');
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally { setBusy(false); }
  };

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api.post(`${BASE}/queues`, {
        project_id: projectId,
        name: name.trim(),
        engine,
        dlq: dlq.trim() || undefined,
      });
      showToast(`Queue ${name.trim()} (${engine}) created`);
      setName('');
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally { setBusy(false); }
  };

  const send = async () => {
    const q = selected || name.trim();
    if (!q) return;
    setBusy(true);
    try {
      let parsed = body;
      try { parsed = JSON.parse(body); } catch { /* raw string */ }
      const res = await api.post(`${BASE}/queues/${encodeURIComponent(q)}/messages`, {
        project_id: projectId,
        body: parsed,
      });
      showToast(`Sent ${res.data?.MessageId || q}`);
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally { setBusy(false); }
  };

  const receive = async () => {
    const q = selected || name.trim();
    if (!q) return;
    setBusy(true);
    try {
      const res = await api.post(`${BASE}/queues/${encodeURIComponent(q)}/messages/receive`, {
        project_id: projectId,
        max_number_of_messages: 1,
      });
      const msgs = res.data?.Messages || [];
      setReceived(JSON.stringify(msgs, null, 2));
      if (!msgs.length) showToast('Queue empty');
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally { setBusy(false); }
  };

  const ackLast = async () => {
    const q = selected || name.trim();
    let msgs = [];
    try { msgs = JSON.parse(received || '[]'); } catch { return; }
    const handle = msgs[0]?.ReceiptHandle || msgs[0]?.MessageId;
    if (!q || !handle) return;
    setBusy(true);
    try {
      await api.delete(`${BASE}/queues/${encodeURIComponent(q)}/messages/${encodeURIComponent(handle)}`, {
        params: { project_id: projectId },
      });
      showToast('Deleted (acked)');
      setReceived('');
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally { setBusy(false); }
  };

  const remove = async (qName) => {
    setBusy(true);
    try {
      await api.delete(`${BASE}/queues/${encodeURIComponent(qName)}`, { params: { project_id: projectId } });
      if (selected === qName) setSelected('');
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally { setBusy(false); }
  };

  return (
    <ScrollView
      style={S.container}
      contentContainerStyle={S.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    >
      <Text style={S.title}>Message Queues</Text>
      <Text style={S.subtitle}>SQS analog. standard/fifo are SQLite; rabbitmq is AMQP; redis_stream is Redis Streams.</Text>

      <ServiceGuide
        title="Message queues guide"
        analogue="Amazon SQS"
        blurb="Project-scoped queues with standard, FIFO, RabbitMQ, or Redis Streams engines. Pair with function_manager for inbox + DLQ fan-out."
        whenToUse={[
          'Async work behind function_manager handlers',
          'Webhook and event_manager fan-out targets',
          'DLQ-backed retries for poison messages',
        ]}
        prerequisites={[
          'Select a project — queues are project-scoped',
          'Enable auth_manager for queue:Send and queue:Receive',
        ]}
        examples={[
          {
            label: 'Create queue',
            code: `POST /api/services/queue_manager/api/v1/queues\n{ "project_id": "{projectId}", "name": "jobs", "engine": "standard" }`,
          },
          {
            label: 'Send message',
            code: `POST .../queues/jobs/messages\n{ "project_id": "{projectId}", "body": { "ping": 1 } }`,
          },
        ]}
        deps={guideDeps}
        onSetupDep={openDep}
        onEnableAllDeps={enableAllDeps}
        onSetup={onSetup}
      />

      {error ? <Box><Text style={S.error}>{error}</Text></Box> : null}

      <Box title="Service">
        <ServiceToggle enabled={!!status?.enabled} onToggle={handleToggle} loading={busy} />
      </Box>
      <ServiceSetupWizard serviceName="queue_manager" navigation={navigation} onEnabled={load} />

      <Box title="Create queue">
        <Text style={S.label}>Name</Text>
        <TextInput value={name} onChangeText={setName} placeholder="jobs" placeholderTextColor={colors.textMuted} style={S.input} />
        <Text style={[S.label, { marginTop: 8 }]}>Engine</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          {ENGINES.map((e) => (
            <Button key={e} title={e} variant={engine === e ? 'primary' : 'secondary'} onPress={() => setEngine(e)} />
          ))}
        </View>
        <Text style={S.label}>DLQ (optional)</Text>
        <TextInput value={dlq} onChangeText={setDlq} placeholder="jobs-dlq" placeholderTextColor={colors.textMuted} style={S.input} />
        <Button title="Create" onPress={create} loading={busy} />
      </Box>

      <Box title="Queues">
        {(queues || []).length === 0 ? <Text style={S.hint}>No queues in this project.</Text> : null}
        {(queues || []).map((q) => (
          <View key={q.id || q.name} style={S.row}>
            <Text style={S.rowName} onPress={() => { setSelected(q.name); setName(q.name); }}>{q.name}</Text>
            <Text style={S.rowSub}>
              {q.engine || 'standard'} · depth {q.depth ?? 0}
              {q.dlq ? ` · dlq ${q.dlq}` : ''}
              {selected === q.name ? ' · selected' : ''}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
              <Button title="Select" variant="secondary" onPress={() => { setSelected(q.name); setName(q.name); }} />
              <Button title="Delete" variant="secondary" onPress={() => remove(q.name)} />
            </View>
          </View>
        ))}
      </Box>

      <Box title="Send / receive">
        <Text style={S.hint}>Selected: {selected || name || '—'}</Text>
        <TextInput value={body} onChangeText={setBody} placeholder='{"ping":1}' placeholderTextColor={colors.textMuted} style={[S.input, { marginVertical: 8 }]} multiline />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Button title="Send" onPress={send} loading={busy} />
          <Button title="Receive" variant="secondary" onPress={receive} loading={busy} />
          <Button title="Ack / delete" variant="secondary" onPress={ackLast} loading={busy} />
        </View>
        {received ? <Text style={{ color: colors.textMuted, marginTop: 8, fontFamily: 'monospace' }}>{received}</Text> : null}
      </Box>

      {status?.enabled ? (
        <Box title="App access">
          <ManagerAppAccessSection serviceName="queue_manager" />
        </Box>
      ) : null}
    </ScrollView>
  );
};
