import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { Box } from '../Box/Box';
import { Button } from '../Button/Button';
import { FormSheet } from '../ui/FormSheet';
import { stackService } from '../../services/stackService';
import { useProject } from '../../contexts/ProjectContext';
import { colors } from '../../styles/theme';

export const StackJsonPanel = () => {
  const { currentProject } = useProject();
  const projectId = currentProject?.id;
  const [raw, setRaw] = useState('');
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

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
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Stack action failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box title="Project stack JSON">
      <Text style={{ color: colors.textMuted, marginBottom: 8, fontSize: 13 }}>
        Code-as-infra for this project. Click-ops upsert here.
        {meta ? ` Revision ${meta.revision} · ${meta.status}` : ''}
      </Text>
      {error ? <Text style={{ color: colors.error, marginBottom: 8 }}>{error}</Text> : null}
      <Button title="Edit stack" onPress={() => setOpen(true)} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        <Button title="Apply" variant="secondary" loading={busy} onPress={() => run(() => stackService.apply(projectId))} />
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
    </Box>
  );
};
