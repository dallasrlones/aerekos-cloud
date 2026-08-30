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

const BASE = '/api/services/download_manager/api/v1';

export const DownloadManager = ({ navigation }) => {
  const { currentProject } = useProject();
  const { showToast } = useToast();
  const projectId = currentProject?.id;
  const [paste, setPaste] = useState('');
  const [items, setItems] = useState([]);
  const [lists, setLists] = useState([]);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const st = await managerService.getStatus('download_manager');
      setStatus(st);
      if (projectId && st?.enabled) {
        const ls = await api.get(`${BASE}/lists`, { params: { project_id: projectId } });
        setLists(ls.data?.items || []);
        const inbox = (ls.data?.items || []).find((l) => l.name === 'inbox') || (ls.data?.items || [])[0];
        if (inbox) {
          const it = await api.get(`${BASE}/lists/${inbox.id}/items`, { params: { project_id: projectId } });
          setItems(it.data?.items || []);
        }
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
      if (enabled) await setupService.enable(projectId, 'download_manager');
      else await managerService.disable('download_manager');
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally { setBusy(false); }
  };

  const handlePaste = async () => {
    if (!projectId) return;
    const urls = paste.split(/\s+/).map((s) => s.trim()).filter(Boolean);
    if (!urls.length) return;
    setBusy(true);
    try {
      await api.post(`${BASE}/quick-add`, { project_id: projectId, urls, window: 'overnight', list: 'inbox' });
      await stackService.record(projectId, { service: 'download_manager', resource: { name: 'inbox' } });
      setPaste('');
      showToast(`Queued ${urls.length} item(s)`);
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally { setBusy(false); }
  };

  return (
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <Box title="Downloads">
        <Text style={{ color: colors.textMuted, marginBottom: 8 }}>Paste YouTube URLs or magnets. Overnight window is 10pm–6am. Jackett is optional (Advanced).</Text>
        <ServiceToggle enabled={!!status?.enabled} onToggle={handleToggle} loading={busy} />
        {error ? <Text style={{ color: colors.error }}>{error}</Text> : null}
      </Box>
      <ServiceSetupWizard serviceName="download_manager" navigation={navigation} onEnabled={load} />
      <Box title="Paste URLs">
        <TextInput
          multiline
          value={paste}
          onChangeText={setPaste}
          placeholder="https://youtu.be/…&#10;magnet:?xt=…"
          placeholderTextColor={colors.textMuted}
          style={{ minHeight: 90, borderWidth: 1, borderColor: colors.border, padding: 8, color: colors.textPrimary, marginBottom: 8 }}
        />
        <Button title="Add to inbox (overnight)" onPress={handlePaste} loading={busy} />
      </Box>
      <Box title="Inbox">
        {(items || []).length === 0 ? <Text style={{ color: colors.textMuted }}>No items yet.</Text> : items.map((it) => (
          <View key={it.id} style={{ marginBottom: 6 }}>
            <Text style={{ color: colors.textPrimary }}>{it.kind} · {it.status}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>{it.url}</Text>
          </View>
        ))}
        <Text style={{ color: colors.textMuted, marginTop: 8 }}>{lists.length} list(s)</Text>
      </Box>
      <ResourceCrud serviceName="download_manager" enabled={!!status?.enabled && !!projectId} onChanged={load} />
    </ScrollView>
  );
};
