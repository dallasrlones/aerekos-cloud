import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { containerService } from '../../services/containerService';
import { useTheme } from '../../contexts/ThemeContext';

export function DeviceContainers({ deviceId }) {
  const { colors, animus } = useTheme();
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [logs, setLogs] = useState('');
  const [execCmd, setExecCmd] = useState('sh -c "ls -la"');
  const [execOut, setExecOut] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (opts = {}) => {
    if (!deviceId) return;
    if (!opts.silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const rows = await containerService.list(deviceId);
      setContainers(rows.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) {
      setError(e?.response?.data?.error?.message || e.message || 'Failed to load containers');
    } finally {
      if (!opts.silent) setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    void load();
    const id = setInterval(() => { void load({ silent: true }); }, 8000);
    return () => clearInterval(id);
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
      <View style={{ padding: 24, alignItems: 'center' }}>
        <ActivityIndicator color={animus.gold} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, gap: 12 }}>
      {error ? <Text style={{ color: colors.error, marginBottom: 8 }}>{error}</Text> : null}
      <ScrollView style={{ maxHeight: 320 }}>
        {containers.map((c) => (
          <View
            key={c.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Pressable style={{ flex: 1 }} onPress={() => void showLogs(c)}>
              <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 13 }}>
                {c.name || c.id.slice(0, 12)}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                {c.image} · {c.state}
                {c.cpu_percent != null ? ` · ${c.cpu_percent}% CPU` : ''}
                {c.mem_mb != null ? ` · ${c.mem_mb} MB` : ''}
              </Text>
            </Pressable>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {c.state !== 'running' ? (
                <Pressable disabled={busy} onPress={() => void act(() => containerService.start(deviceId, c.id))}>
                  <Text style={{ color: animus.gold, fontSize: 12, fontWeight: '600' }}>Start</Text>
                </Pressable>
              ) : (
                <Pressable disabled={busy} onPress={() => void act(() => containerService.stop(deviceId, c.id))}>
                  <Text style={{ color: colors.error, fontSize: 12, fontWeight: '600' }}>Stop</Text>
                </Pressable>
              )}
              <Pressable disabled={busy} onPress={() => void showLogs(c)}>
                <Text style={{ color: animus.gold, fontSize: 12, fontWeight: '600' }}>Logs</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>

      {selected ? (
        <View style={{ marginTop: 8, gap: 8 }}>
          <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{selected.name}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 11 }}>Logs (tail)</Text>
          <ScrollView style={{ maxHeight: 160, backgroundColor: colors.surface, padding: 8, borderRadius: 4 }}>
            <Text style={{ color: colors.textPrimary, fontFamily: animus.mono, fontSize: 11 }}>{logs || '(empty)'}</Text>
          </ScrollView>
          <Text style={{ color: colors.textMuted, fontSize: 11 }}>Exec</Text>
          <TextInput
            style={{ borderWidth: 1, borderColor: colors.border, color: colors.textPrimary, padding: 8, borderRadius: 4 }}
            value={execCmd}
            onChangeText={setExecCmd}
            placeholder='sh -c "whoami"'
            placeholderTextColor={colors.textMuted}
          />
          <Pressable
            style={{
              alignSelf: 'flex-start',
              backgroundColor: animus.gold,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 4,
            }}
            disabled={busy}
            onPress={() => void runExec()}
          >
            <Text style={{ color: colors.onAccent || '#10131A', fontWeight: '600' }}>Run</Text>
          </Pressable>
          {execOut ? (
            <ScrollView style={{ maxHeight: 160, backgroundColor: colors.surface, padding: 8, borderRadius: 4 }}>
              <Text style={{ color: colors.textPrimary, fontFamily: animus.mono, fontSize: 11 }}>{execOut}</Text>
            </ScrollView>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default DeviceContainers;
