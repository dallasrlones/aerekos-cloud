import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, RefreshControl } from 'react-native';
import { Box } from '../../components/Box/Box';
import { Button } from '../../components/Button/Button';
import { ServiceToggle } from '../../components/ServiceToggle/ServiceToggle';
import { ServiceSetupWizard } from '../../components/ServiceSetupWizard';
import { managerService } from '../../services/managerService';
import { setupService } from '../../services/setupService';
import api from '../../utils/api';
import { useProject } from '../../contexts/ProjectContext';
import { useToast } from '../../components/Toast/ToastProvider';
import { stackService } from '../../services/stackService';
import { ResourceCrud } from '../../components/ResourceCrud';
import { colors } from '../../styles/theme';

const BASE = '/api/services/function_manager/api/v1';

export const FunctionManager = ({ navigation }) => {
  const { currentProject } = useProject();
  const { showToast } = useToast();
  const projectId = currentProject?.id;
  const [name, setName] = useState('hello');
  const [payload, setPayload] = useState('{}');
  const [result, setResult] = useState('');
  const [fns, setFns] = useState([]);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const st = await managerService.getStatus('function_manager');
      setStatus(st);
      if (projectId && st?.enabled) {
        const res = await api.get(`${BASE}/functions`, { params: { project_id: projectId } });
        setFns(res.data?.items || []);
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
      if (enabled) await setupService.enable(projectId, 'function_manager');
      else await managerService.disable('function_manager');
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally { setBusy(false); }
  };

  const deployHello = async () => {
    setBusy(true);
    try {
      await api.post(`${BASE}/functions`, { project_id: projectId, name: name.trim() || 'hello', trigger: { queue: true } });
      await stackService.record(projectId, {
        service: 'function_manager',
        resource: { name: name.trim() || 'hello', trigger: { queue: true } },
      });
      showToast('Function + inbox queue created');
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally { setBusy(false); }
  };

  const invoke = async (type) => {
    setBusy(true);
    try {
      let body = {};
      try { body = JSON.parse(payload || '{}'); } catch { body = { raw: payload }; }
      const res = await api.post(`${BASE}/functions/${encodeURIComponent(name.trim() || 'hello')}/invoke`, {
        project_id: projectId,
        payload: body,
        invocation_type: type,
      });
      setResult(JSON.stringify(res.data, null, 2));
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally { setBusy(false); }
  };

  return (
    <ScrollView refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
      <Box title="Functions">
        <Text style={{ color: colors.textMuted, marginBottom: 8 }}>Lambda analog. Creating a function also creates {`{name}-inbox`} (standard engine) and a DLQ unless you opt out.</Text>
        <ServiceToggle enabled={!!status?.enabled} onToggle={handleToggle} loading={busy} />
        {error ? <Text style={{ color: colors.error }}>{error}</Text> : null}
      </Box>
      <ServiceSetupWizard serviceName="function_manager" navigation={navigation} onEnabled={load} />
      <Box title="Hello world">
        <TextInput value={name} onChangeText={setName} placeholder="function name" placeholderTextColor={colors.textMuted} style={{ borderWidth: 1, borderColor: colors.border, padding: 8, color: colors.textPrimary, marginBottom: 8 }} />
        <Button title="Deploy + inbox queue" onPress={deployHello} loading={busy} />
        <TextInput value={payload} onChangeText={setPayload} placeholder='{"ping":1}' placeholderTextColor={colors.textMuted} style={{ borderWidth: 1, borderColor: colors.border, padding: 8, color: colors.textPrimary, marginVertical: 8 }} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="Test invoke (sync)" onPress={() => invoke('RequestResponse')} loading={busy} />
          <Button title="Async (Event)" variant="secondary" onPress={() => invoke('Event')} loading={busy} />
        </View>
        {result ? <Text style={{ color: colors.textMuted, marginTop: 8, fontFamily: 'monospace' }}>{result}</Text> : null}
        {(fns || []).map((f) => (
          <Text key={f.id} style={{ color: colors.textPrimary, marginTop: 6 }}>{f.name} · {f.runtime} · inbox {f.inbox_queue || '—'}</Text>
        ))}
      </Box>
      <ResourceCrud serviceName="function_manager" enabled={!!status?.enabled && !!projectId} onChanged={load} />
    </ScrollView>
  );
};
