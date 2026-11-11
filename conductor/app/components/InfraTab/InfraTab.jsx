import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Box } from '../Box/Box';
import { Button } from '../Button/Button';
import { FormSheet } from '../ui/FormSheet';
import { stackService } from '../../services/stackService';
import { colors, spacing, borderRadius, typography } from '../../styles/theme';

/**
 * The Infra tab — a project's infrastructure as one version-controlled
 * file (infra.json), in plain language:
 *
 *   Update from live   capture the running system into the file (revision + commit)
 *   edit (devices)     declare intent: where each service should run, what's in the file
 *   Save file          commit the edited file (revision)
 *   Apply to devices   make reality match the file (auto = most free disk), bake
 *                      resolved devices back in, provision resources, commit
 *   Down / Down+delete tear it back down (soft keeps the file, hard resets it)
 *   History            every change is a revision — browse and roll any back
 *
 * When the project is hooked up to git, the file lives in its infra repo and
 * every change is a commit; otherwise it lives in the conductor's store.
 */

const RES_LABELS = {
  buckets: 'Buckets',
  databases: 'Databases',
  keys: 'Keys',
  secrets: 'Secrets',
  containers: 'Containers',
  functions: 'Functions',
  schedules: 'Schedules',
};

const fmtGb = (n) => (n == null ? null : `${Math.round(n)}GB`);
const fmtTs = (t) => (t ? new Date(t).toLocaleString() : '—');
const clone = (o) => JSON.parse(JSON.stringify(o || {}));
const errMsg = (err) => (err && err.response && err.response.data && err.response.data.error && err.response.data.error.message) || (err && err.message) || 'Failed';

export const InfraTab = ({ projectId, placements, onRefresh }) => {
  const [data, setData] = useState(null); // { file, devices, hookup, revision, status, generated_at }
  const [file, setFile] = useState({}); // editable copy of data.file
  const [touched, setTouched] = useState(false); // local edits since last load
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { ok, text }
  const [sheet, setSheet] = useState(null); // 'add' | 'device' | 'history' | 'view' | 'edit'
  const [deviceFor, setDeviceFor] = useState(null);
  const [localDev, setLocalDev] = useState('auto');
  const [addName, setAddName] = useState(null);
  const [addDevice, setAddDevice] = useState('auto');
  const [history, setHistory] = useState([]);
  const [editText, setEditText] = useState('');
  const [applyResult, setApplyResult] = useState(null);

  const devices = (data && data.devices) || [];
  const fileServices = file && Array.isArray(file.services) ? file.services : [];
  // dirty = the user edited the local copy (device pins, add/remove, raw
  // edit) since the last load — comparison alone can't tell an empty local
  // file ({}) apart from "no file yet" (null).
  const dirty = touched;

  const autoPick = useMemo(() => {
    const online = devices.filter((d) => d.status === 'online');
    const pool = online.length ? online : devices;
    if (!pool.length) return null;
    return pool.slice().sort((a, b) => ((b.disk_free_gb == null ? -1 : b.disk_free_gb) - (a.disk_free_gb == null ? -1 : a.disk_free_gb)))[0];
  }, [devices]);

  const catalogEntries = useMemo(() => {
    const have = new Set(fileServices.map((s) => s.name));
    return Object.entries(placements || {}).filter(([name]) => !have.has(name));
  }, [placements, fileServices]);

  const resourceGroups = useMemo(() => {
    const res = (file && file.resources) || {};
    return Object.keys(res)
      .filter((k) => Array.isArray(res[k]) && res[k].length)
      .map((k) => [RES_LABELS[k] || k, res[k]]);
  }, [file]);

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      const d = await stackService.infra(projectId);
      setData(d);
      setFile(clone(d.file || {}));
      setTouched(false);
      setApplyResult(null);
    } catch (err) {
      setMsg({ ok: false, text: errMsg(err) });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const act = async (fn, okText) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fn();
      await load();
      if (onRefresh) onRefresh();
      setMsg({ ok: true, text: typeof okText === 'function' ? okText(r) : okText });
      return r;
    } catch (err) {
      setMsg({ ok: false, text: errMsg(err) });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const updateFromLive = () => act(
    () => stackService.exportInfra(projectId),
    (r) => {
      const rev = (r && r.revision) || (r && r.file && r.file.revision) || 'saved';
      const note = r && r.unchanged ? ' (unchanged — no new revision)' : '';
      return `File updated from live — rev ${rev}${note}${r && r.repo && r.repo.committed ? ' · committed' : ''}`;
    },
  );

  const saveFile = () => act(
    () => stackService.putInfra(projectId, file),
    (r) => {
      setTouched(false);
      const rev = (r && r.revision) ? ` — rev ${r.revision}` : '';
      const commit = r && r.repo ? (r.repo.committed ? ' · committed' : ` · not committed (${r.repo.reason || 'no infra repo'})`) : '';
      return `File saved${rev}${commit}`;
    },
  );

  const applyFile = () => {
    const wanted = new Set([
      ...fileServices.map((s) => s.name),
      ...((file && Array.isArray(file.wanted)) ? file.wanted : []),
    ]);
    if (!wanted.size) {
      return Alert.alert('Apply to devices', 'The file has no services yet — add some, or "Update from live" first.');
    }
    const plan = [...wanted].map((n) => {
      const s = fileServices.find((x) => x.name === n);
      const d = (s && s.device) || 'auto';
      return `${n} → ${d === 'auto' ? `auto${autoPick ? ` (${autoPick.name})` : ''}` : d}`;
    }).join('\n');
    Alert.alert(
      'Apply to devices?',
      `Enable the file's services (auto = online device with the most free disk), provision its resources, then save the file with the resolved devices:\n\n${plan}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply',
          onPress: async () => {
            const r = await act(
              () => stackService.applyInfra(projectId, {}),
              (res) => {
                if (res && Array.isArray(res.services)) setApplyResult(res.services);
                const bad = ((res && res.services) || []).filter((x) => x.status !== 'ok');
                return bad.length
                  ? `Applied with ${bad.length} error(s): ${bad.map((b) => b.name).join(', ')}`
                  : `Applied — everything ok (rev ${(res && res.revision) || ''}${res && res.repo ? ' · committed' : ''})`;
              },
            );
            if (r && Array.isArray(r.services)) setApplyResult(r.services);
          },
        },
      ],
    );
  };

  const down = (hard) => Alert.alert(
    hard ? 'Down + delete resources?' : 'Down (soft)?',
    hard
      ? 'Detaches every service in the file AND deletes every resource it lists. The file is reset to empty and committed.'
      : 'Detaches every service in the file. Shared managers keep running, resources stay. The file is kept, so Apply brings everything back.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: hard ? 'Down + delete' : 'Down',
        style: 'destructive',
        onPress: () => act(
          () => stackService.downInfra(projectId, { hard }),
          hard ? 'Downed and resources deleted — file reset' : 'Downed (soft) — Apply to bring it back',
        ),
      },
    ],
  );

  const syncResources = () => act(
    () => stackService.sync(projectId),
    'Resources re-synced from the live managers',
  );

  const openHistory = async () => {
    setSheet('history');
    setBusy(true);
    try {
      const rows = await stackService.revisions(projectId);
      setHistory(Array.isArray(rows) ? rows : (rows && rows.revisions) || []);
    } catch (err) {
      setMsg({ ok: false, text: errMsg(err) });
      setSheet(null);
    } finally {
      setBusy(false);
    }
  };

  const rollbackTo = (rev) => Alert.alert(
    `Roll back to revision ${rev}?`,
    'The file is restored to that revision and committed. The running system is not touched — press "Apply to devices" to realize it.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Roll back',
        onPress: () => act(() => stackService.rollback(projectId, { revision: rev }), `Rolled back to rev ${rev}`),
      },
    ],
  );

  const openDevice = (s) => {
    setDeviceFor(s.name);
    setLocalDev(s.device || 'auto');
    setSheet('device');
  };

  const setServiceDevice = () => {
    if (!deviceFor) return;
    setFile({
      ...file,
      services: fileServices.map((s) => (s.name === deviceFor ? { ...s, device: localDev } : s)),
    });
    setTouched(true);
    setSheet(null);
  };

  const removeService = (name) => {
    setFile({
      ...file,
      services: fileServices.filter((s) => s.name !== name),
      wanted: [...new Set([...(file.wanted || fileServices.map((s) => s.name))].filter((n) => n !== name))],
    });
    setTouched(true);
  };

  const openAdd = () => {
    setAddName(null);
    setAddDevice('auto');
    setSheet('add');
  };

  const addService = () => {
    if (!addName) return;
    setFile({
      ...file,
      services: [...fileServices, { name: addName, device: addDevice }],
      wanted: [...new Set([...(file.wanted || fileServices.map((s) => s.name)), addName])],
    });
    setTouched(true);
    setSheet(null);
  };

  const openView = () => {
    setEditText(JSON.stringify(file, null, 2));
    setSheet('view');
  };

  const openEdit = () => {
    setEditText(JSON.stringify(file, null, 2));
    setSheet('edit');
  };

  const saveEdit = () => {
    let parsed;
    try {
      parsed = JSON.parse(editText);
    } catch (e) {
      setMsg({ ok: false, text: `Not valid JSON: ${e.message}` });
      return;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setMsg({ ok: false, text: 'The file must be a JSON object' });
      return;
    }
    setFile({ ...clone(data && data.file), ...parsed });
    setTouched(true);
    setSheet(null);
    setMsg({ ok: true, text: 'File updated — press "Save file" to commit it' });
  };

  const copyFile = async () => {
    const text = JSON.stringify(file, null, 2);
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        setMsg({ ok: true, text: 'File copied to the clipboard' });
        return;
      } catch { /* fall through to the sheet */ }
    }
    Alert.alert('Infra file', text, [{ text: 'OK' }]);
  };

  const deviceOptions = (selected, onPick) => (
    <>
      <TouchableOpacity style={[S.opt, selected === 'auto' && S.optSel]} onPress={() => onPick('auto')}>
        <Text style={S.optTitle}>auto</Text>
        <Text style={S.optSub}>{autoPick ? `resolves to ${autoPick.name}${autoPick.disk_free_gb != null ? ` (${fmtGb(autoPick.disk_free_gb)} free)` : ''}` : 'online device with the most free disk'}</Text>
      </TouchableOpacity>
      {devices.map((d) => (
        <TouchableOpacity key={d.id} style={[S.opt, selected === d.name && S.optSel]} onPress={() => onPick(d.name)}>
          <View style={S.optRow}>
            <View style={[S.dot, { backgroundColor: d.status === 'online' ? colors.success : colors.border }]} />
            <Text style={S.optTitle}>{d.name}</Text>
          </View>
          <Text style={S.optSub}>
            {d.status}{d.disk_free_gb != null ? ` · ${fmtGb(d.disk_free_gb)} free / ${fmtGb(d.disk_total_gb)}` : ''}
          </Text>
        </TouchableOpacity>
      ))}
      {devices.length === 0 && <Text style={S.empty}>No devices registered</Text>}
    </>
  );

  if (loading && !data) {
    return (
      <View style={S.loading}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={S.desc}>Loading infra…</Text>
      </View>
    );
  }

  const hookup = (data && data.hookup) || {};
  const hookMode = hookup.mode;
  const hooked = !!(hookMode === 'git' || hookMode === 'conductor');
  const hookLabel = hookMode
    ? `${hookMode}${hookup.repo ? ` · ${hookup.repo}` : ''}${hookup.missing && hookup.missing.length ? ` · ${hookup.missing.join(', ')} missing` : ''}`
    : 'not hooked up';

  const noFile = !data || data.revision === 0;
  return (
    <>
      <Box title="Infra">
        <Text style={S.desc}>
          This project's services, devices and resources as one version-controlled file.
          Every change is a revision{hooked ? ' and a commit to its infra repo' : ''}.
        </Text>
        {!noFile ? (
          <View style={S.metaRow}>
            <Text style={S.meta}>rev {data.revision} · {data.status || 'draft'}</Text>
            {data.generated_at ? <Text style={S.meta}>{fmtTs(data.generated_at)}</Text> : null}
            <Text style={S.meta}>{hookLabel}</Text>
          </View>
        ) : (
          <Text style={S.desc}>No file yet — capture the current live state, or start from an empty file and add services. {hookLabel}.</Text>
        )}
        {msg ? <Text style={[S.msg, !msg.ok && S.msgErr]}>{msg.text}</Text> : null}

        <View style={S.actions}>
          <Button title="Update from live" variant="primary" loading={busy} onPress={updateFromLive} />
          <Button title="Save file" variant="primary" disabled={!dirty || busy} onPress={saveFile} />
          <Button title="Apply to devices" variant="primary" disabled={busy} onPress={applyFile} />
        </View>
        <View style={S.actions}>
          <Button title="Down" variant="secondary" disabled={busy || noFile} onPress={() => down(false)} />
          <Button title="Down + delete" variant="secondary" disabled={busy || noFile} onPress={() => down(true)} />
          <Button title="History" variant="secondary" disabled={busy} onPress={openHistory} />
          <Button title="View file" variant="secondary" disabled={busy} onPress={openView} />
          <Button title="Edit file" variant="secondary" disabled={busy} onPress={openEdit} />
        </View>
        {applyResult ? (
          <View style={S.results}>
            <Text style={S.label}>Apply results</Text>
            {applyResult.map((r) => (
              <View key={r.name} style={S.resultRow}>
                <Ionicons name={r.status === 'ok' ? 'checkmark-circle' : 'alert-circle'} size={15} color={r.status === 'ok' ? colors.success : colors.error} />
                <Text style={S.resultText}>{r.name} → {r.device || '?'}{r.error ? ` — ${r.error}` : ''}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </Box>

      <Box title={`Services (${fileServices.length})`}>
        {fileServices.length ? fileServices.map((s) => {
          const pinned = s.device || 'auto';
          const live = s.live_device;
          return (
            <TouchableOpacity key={s.name} style={S.row} activeOpacity={0.8} onPress={() => openDevice(s)}>
              <View style={[S.dot, { backgroundColor: live ? colors.success : colors.border }]} />
              <View style={S.rowText}>
                <Text style={S.rowTitle}>{s.name}</Text>
                <Text style={S.rowSub}>
                  {live
                    ? (live === pinned ? `running on ${live}` : `running on ${live} — file says ${pinned}`)
                    : 'pending (not running)'}
                </Text>
              </View>
              <View style={S.chip}>
                <Text style={S.chipText}>{pinned}</Text>
                <Ionicons name="chevron-down" size={13} color={colors.textMuted} />
              </View>
              <TouchableOpacity
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={S.rowX}
                onPress={(e) => { e && e.stopPropagation && e.stopPropagation(); removeService(s.name); }}
              >
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }) : (
          <Text style={S.empty}>No services in the file — add one, or "Update from live".</Text>
        )}
        <View style={S.actions}>
          <Button title="+ Add service" variant="secondary" disabled={!catalogEntries.length} onPress={openAdd} />
        </View>
      </Box>

      {resourceGroups.length > 0 && (
        <Box title="Resources">
          {resourceGroups.map(([label, rows]) => (
            <Text key={label} style={S.rowSub}>
              {label} ({rows.length}): {rows.map((r) => r.name || r.id || '?').slice(0, 8).join(', ')}{rows.length > 8 ? '…' : ''}
            </Text>
          ))}
          <View style={S.actions}>
            <Button title="Sync from live" variant="secondary" disabled={busy} onPress={syncResources} />
          </View>
        </Box>
      )}

      <Box title={`Devices (${devices.length})`}>
        {devices.map((d) => {
          const here = fileServices.filter((s) => (s.device || '') === d.name || s.live_device === d.name).length;
          return (
            <View key={d.id} style={S.row}>
              <View style={[S.dot, { backgroundColor: d.status === 'online' ? colors.success : colors.border }]} />
              <View style={S.rowText}>
                <Text style={S.rowTitle}>{d.name}</Text>
                <Text style={S.rowSub}>
                  {d.status}{d.disk_free_gb != null ? ` · ${fmtGb(d.disk_free_gb)} free / ${fmtGb(d.disk_total_gb)}` : ''}{here ? ` · ${here} service${here > 1 ? 's' : ''} here` : ''}
                </Text>
              </View>
            </View>
          );
        })}
        {devices.length === 0 && <Text style={S.empty}>No devices registered</Text>}
      </Box>

      <FormSheet
        visible={sheet === 'device'}
        title={deviceFor ? `Device for ${deviceFor}` : 'Device'}
        onClose={() => setSheet(null)}
        footer={<Button title="Set device" variant="primary" onPress={setServiceDevice} />}
      >
        <Text style={S.desc}>Where this service should run. Saving updates the file — Apply makes it real.</Text>
        {deviceOptions(localDev, setLocalDev)}
      </FormSheet>

      <FormSheet
        visible={sheet === 'add'}
        title="Add service to file"
        onClose={() => setSheet(null)}
        footer={<Button title="Add to file" variant="primary" disabled={!addName} onPress={addService} />}
      >
        <Text style={S.desc}>Pick a service, then where it should run. Save the file, then Apply.</Text>
        {catalogEntries.map(([name, svc]) => (
          <TouchableOpacity key={name} style={[S.opt, addName === name && S.optSel]} onPress={() => setAddName(name)}>
            <Text style={S.optTitle}>{name}</Text>
            {svc && svc.description ? <Text style={S.optSub}>{String(svc.description)}</Text> : null}
          </TouchableOpacity>
        ))}
        {catalogEntries.length === 0 && <Text style={S.empty}>Everything is already in the file</Text>}
        <Text style={[S.label, S.topMargin]}>Device</Text>
        {deviceOptions(addDevice, setAddDevice)}
      </FormSheet>

      <FormSheet visible={sheet === 'history'} title="Revisions" onClose={() => setSheet(null)}>
        <Text style={S.desc}>Every change to the file is a revision. Roll one back, then Apply to realize it.</Text>
        {history.length ? history.map((r) => (
          <View key={r.id} style={S.row}>
            <View style={S.rowText}>
              <Text style={S.rowTitle}>
                rev {r.revision}{data && data.revision === r.revision ? ' (current)' : ''}
              </Text>
              <Text style={S.rowSub}>{r.status || ''} · {fmtTs(r.created_at)}</Text>
            </View>
            {!(data && data.revision === r.revision) && (
              <Button title="Roll back" variant="secondary" style={S.minBtn} onPress={() => rollbackTo(r.revision)} />
            )}
          </View>
        )) : <Text style={S.empty}>No revisions yet</Text>}
      </FormSheet>

      <FormSheet
        visible={sheet === 'view' || sheet === 'edit'}
        title={sheet === 'edit' ? 'Edit file (JSON)' : 'Infra file'}
        onClose={() => setSheet(null)}
        footer={
          <View style={S.footerRow}>
            <Button title="Copy" variant="secondary" style={S.minBtn} onPress={copyFile} />
            {sheet === 'edit' ? <Button title="Update" variant="primary" style={S.minBtn} onPress={saveEdit} /> : null}
          </View>
        }
      >
        {sheet === 'edit' ? (
          <TextInput
            style={S.editor}
            value={editText}
            onChangeText={setEditText}
            multiline
            numberOfLines={14}
            autoCorrect={false}
            autoCapitalize="none"
          />
        ) : (
          <ScrollView style={S.jsonWrap}>
            <Text style={S.json}>{editText}</Text>
          </ScrollView>
        )}
      </FormSheet>
    </>
  );
};

const S = StyleSheet.create({
  loading: { padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  desc: { ...typography.caption, marginBottom: spacing.sm },
  topMargin: { marginTop: spacing.md },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.sm },
  meta: { ...typography.caption, color: colors.textSecondary },
  msg: { ...typography.caption, color: colors.success, marginBottom: spacing.sm },
  msgErr: { color: colors.error },
  label: { ...typography.label, marginBottom: spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginVertical: spacing.xs },
  results: { marginTop: spacing.sm, gap: spacing.xs },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  resultText: { ...typography.caption, color: colors.textSecondary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...typography.body, fontSize: 14, fontWeight: '400' },
  rowSub: { ...typography.caption },
  rowX: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { ...typography.caption, color: colors.textPrimary },
  opt: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs,
    gap: 2,
  },
  optSel: { borderColor: colors.accent, backgroundColor: colors.surface },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  optTitle: { ...typography.body, fontSize: 14, fontWeight: '400' },
  optSub: { ...typography.caption },
  empty: { ...typography.caption, paddingVertical: spacing.xs },
  footerRow: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
  minBtn: { minHeight: 40 },
  editor: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    fontSize: 12,
    color: colors.textPrimary,
  },
  jsonWrap: { maxHeight: 360 },
  json: { fontFamily: Platform.OS === 'web' ? 'monospace' : undefined, fontSize: 12, color: colors.textSecondary },
});

export default InfraTab;
