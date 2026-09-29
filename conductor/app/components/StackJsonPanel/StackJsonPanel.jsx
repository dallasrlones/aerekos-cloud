import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, Alert, Platform } from 'react-native';
import { Box } from '../Box/Box';
import { Button } from '../Button/Button';
import { FormSheet } from '../ui/FormSheet';
import { stackService } from '../../services/stackService';
import { useProject } from '../../contexts/ProjectContext';
import { colors } from '../../styles/theme';

function copyText(text) {
  if (Platform.OS === 'web' && navigator?.clipboard) {
    navigator.clipboard.writeText(text);
  }
  Alert.alert('Copied', 'Copied to clipboard');
}

export const StackJsonPanel = () => {
  const { currentProject } = useProject();
  const projectId = currentProject?.id;
  const [raw, setRaw] = useState('');
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportRaw, setExportRaw] = useState('');

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await stackService.current(projectId);
      setMeta({ revision: data.revision, status: data.status });
      setRaw(JSON.stringify(data.stack || {}, null, 2));
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load stack');
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  if (!projectId) return null;

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const message = await fn();
      setNotice(typeof message === 'string' && message ? message : 'Done');
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Stack action failed');
    } finally {
      setBusy(false);
    }
  };

  const doExport = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const data = await stackService.exportInfra(projectId);
      setExportRaw(JSON.stringify(data.file || data, null, 2));
      setExportOpen(true);
      const committed = data.repo && data.repo.committed ? ` \u00b7 committed to ${data.repo.repo?.name || 'infra repo'}` : '';
      setNotice(`Infra file exported (rev ${data.revision ?? '?'})${committed}`);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Export failed');
    } finally {
      setBusy(false);
    }
  };

  const doApply = () => run(async () => {
    const data = await stackService.applyInfra(projectId, {});
    const services = data.services || [];
    const ok = services.filter((s) => s.status === 'ok').length;
    const bad = services.filter((s) => s.status !== 'ok').map((s) => `${s.name}${s.error ? ` (${s.error})` : ''}`);
    let msg = `Applied: ${ok}/${services.length} services on their devices`;
    if (bad.length) msg += ` \u00b7 issues: ${bad.slice(0, 3).join('; ')}${bad.length > 3 ? ` +${bad.length - 3} more` : ''}`;
    return msg;
  });

  const doDown = (hard) => {
    const go = () => run(async () => {
      const data = await stackService.downInfra(projectId, { hard });
      const det = (data.disabled || []).length;
      const msg = hard ? `Down (hard): detached ${det} services, deleted resources` : `Down (soft): detached ${det} services, resources kept`;
      return msg;
    });
    if (hard) {
      Alert.alert('Down hard', 'Detaches the services AND deletes this project\'s resources (buckets, keys, databases, \u2026).', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Down hard', style: 'destructive', onPress: go },
      ]);
    } else {
      go();
    }
  };

  return (
    <Box title="Project stack JSON">
      <Text style={{ color: colors.textMuted, marginBottom: 8, fontSize: 13 }}>
        Code-as-infra for this project. Click-ops upsert here; the infra file (infra.json)
        is committed to this project&apos;s infra repo.
        {meta ? ` Revision ${meta.revision} \u00b7 ${meta.status}` : ''}
      </Text>
      {error ? <Text style={{ color: colors.error, marginBottom: 8 }}>{error}</Text> : null}
      {notice ? <Text style={{ color: colors.textMuted, marginBottom: 8, fontSize: 12 }}>{notice}</Text> : null}
      <Button title="Edit stack" onPress={() => setOpen(true)} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        <Button title="Export infra.json" variant="secondary" loading={busy} onPress={doExport} />
        <Button title="Apply (devices)" variant="secondary" loading={busy} onPress={doApply} />
        <Button title="Down" variant="secondary" loading={busy} onPress={() => doDown(false)} />
        <Button title="Down hard" variant="secondary" loading={busy} onPress={() => doDown(true)} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        <Button title="Apply stack" variant="secondary" loading={busy} onPress={() => run(() => stackService.apply(projectId))} />
        <Button title="Sync from live" variant="secondary" loading={busy} onPress={() => run(() => stackService.sync(projectId))} />
        <Button title="Rollback" variant="secondary" loading={busy} onPress={() => run(() => stackService.rollback(projectId))} />
      </View>
      <FormSheet
        visible={open}
        title="Edit stack JSON"
        onClose={() => setOpen(false)}
        footer={(
          <Button
            title="Save draft"
            loading={busy}
            onPress={() => run(async () => {
              const parsed = JSON.parse(raw);
              await stackService.put(projectId, parsed);
              setOpen(false);
            })}
          />
        )}
      >
        <TextInput
          multiline
          value={raw}
          onChangeText={setRaw}
          style={{
            minHeight: 280,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 8,
            color: colors.textPrimary,
            fontFamily: 'monospace',
            fontSize: 13,
          }}
        />
      </FormSheet>
      <FormSheet
        visible={exportOpen}
        title="Infra file (infra.json)"
        onClose={() => setExportOpen(false)}
        footer={(
          <Button
            title="Copy JSON"
            variant="secondary"
            onPress={() => copyText(exportRaw)}
          />
        )}
      >
        <TextInput
          multiline
          value={exportRaw}
          editable={false}
          style={{
            minHeight: 280,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 8,
            color: colors.textPrimary,
            fontFamily: 'monospace',
            fontSize: 13,
          }}
        />
      </FormSheet>
    </Box>
  );
};
