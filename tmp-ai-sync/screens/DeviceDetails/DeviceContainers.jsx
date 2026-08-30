import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { containerService } from '../../services/containerService';
import { colors } from '../../styles/theme';

export function DeviceContainers({ deviceId }) {
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [logs, setLogs] = useState('');
  const [execCmd, setExecCmd] = useState('sh -c "ls -la"');
  const [execOut, setExecOut] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!deviceId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await containerService.list(deviceId);
      setContainers(rows.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) {
      setError(e?.response?.data?.error?.message || e.message || 'Failed to load containers');
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (fn) => {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e?.response?.data?.error?.message || e.message);
    } finally {
      setBusy(false);
    }
  };

  const showLogs = async (c) => {
    setSelected(c);
    setBusy(true);
    setError(null);
    try {
      const text = await containerService.logs(deviceId, c.id, 300);
      setLogs(text);
    } catch (e) {
      setError(e?.response?.data?.error?.message || e.message);
    } finally {
      setBusy(false);
    }
  };

  const runExec = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const r = await containerService.exec(deviceId, selected.id, execCmd);
      setExecOut(r.output || '');
    } catch (e) {
      setError(e?.response?.data?.error?.message || e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={S.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={S.wrap}>
      {error ? <Text style={S.error}>{error}</Text> : null}
      <ScrollView style={S.list}>
        {containers.map((c) => (
          <View key={c.id} style={S.row}>
            <Pressable style={S.nameCol} onPress={() => void showLogs(c)}>
              <Text style={S.name}>{c.name || c.id.slice(0, 12)}</Text>
              <Text style={S.meta}>{c.image} · {c.state}</Text>
            </Pressable>
            <View style={S.actions}>
              {c.state !== 'running' ? (
                <Pressable disabled={busy} onPress={() => void act(() => containerService.start(deviceId, c.id))}>
                  <Text style={S.btn}>Start</Text>
                </Pressable>
              ) : (
                <Pressable disabled={busy} onPress={() => void act(() => containerService.stop(deviceId, c.id))}>
                  <Text style={S.btnDanger}>Stop</Text>
                </Pressable>
              )}
              <Pressable disabled={busy} onPress={() => void showLogs(c)}>
                <Text style={S.btn}>Logs</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>

      {selected ? (
        <View style={S.panel}>
          <Text style={S.panelTitle}>{selected.name}</Text>
          <Text style={S.panelLabel}>Logs (tail)</Text>
          <ScrollView style={S.logBox}>
            <Text style={S.logText}>{logs || '(empty)'}</Text>
          </ScrollView>
          <Text style={S.panelLabel}>Exec</Text>
          <TextInput
            style={S.input}
            value={execCmd}
            onChangeText={setExecCmd}
            placeholder='sh -c "whoami"'
            placeholderTextColor={colors.textMuted}
          />
          <Pressable style={S.execBtn} disabled={busy} onPress={() => void runExec()}>
            <Text style={S.execBtnText}>Run</Text>
          </Pressable>
          {execOut ? (
            <ScrollView style={S.logBox}>
              <Text style={S.logText}>{execOut}</Text>
            </ScrollView>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const S = StyleSheet.create({
  wrap: { flex: 1, gap: 12 },
  center: { padding: 24, alignItems: 'center' },
  error: { color: colors.danger, marginBottom: 8 },
  list: { maxHeight: 320 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.border },
  nameCol: { flex: 1 },
  name: { color: colors.text, fontWeight: '600', fontSize: 13 },
  meta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 12 },
  btn: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  btnDanger: { color: colors.danger, fontSize: 12, fontWeight: '600' },
  panel: { marginTop: 8, gap: 8 },
  panelTitle: { color: colors.text, fontWeight: '700' },
  panelLabel: { color: colors.textMuted, fontSize: 11 },
  logBox: { maxHeight: 160, backgroundColor: colors.panel, padding: 8, borderRadius: 4 },
  logText: { color: colors.text, fontFamily: 'monospace', fontSize: 11 },
  input: { borderWidth: 1, borderColor: colors.border, color: colors.text, padding: 8, borderRadius: 4 },
  execBtn: { alignSelf: 'flex-start', backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 4 },
  execBtnText: { color: colors.onAccent, fontWeight: '600' },
});
