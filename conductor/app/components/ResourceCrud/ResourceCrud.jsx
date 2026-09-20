import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, Alert, TouchableOpacity } from 'react-native';
import { Box } from '../Box/Box';
import { Button } from '../Button/Button';
import api from '../../utils/api';
import { useProject } from '../../contexts/ProjectContext';
import { stackService } from '../../services/stackService';
import { colors } from '../../styles/theme';
import { ResourceCrudStyles as S } from './ResourceCrud.styles';

function interpolate(path, projectId) {
  return String(path || '').replace(/\{projectId\}/g, projectId || '');
}

function collectionUrl(serviceName, ops, projectId) {
  const raw = ops.applyPath || ops.createPath || ops.listPath || `${ops.proxyBase}/${ops.segment}`;
  const path = interpolate(raw, projectId).replace(/\/apply$/, '');
  return `/api/services/${serviceName}${path.startsWith('/') ? path : `/${path}`}`;
}

function itemUrl(serviceName, ops, projectId, id) {
  return `${collectionUrl(serviceName, ops, projectId)}/${encodeURIComponent(String(id))}`;
}

function extractItems(data, listKey) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  if (listKey && Array.isArray(data[listKey])) return data[listKey];
  for (const k of Object.keys(data)) {
    if (Array.isArray(data[k]) && k !== 'errors') return data[k];
  }
  return [];
}

function extractCreated(data) {
  if (!data || typeof data !== 'object') return data;
  return data.item || data.key || data.bucket || data.database || data.queue
    || data.webhook || data.repository || data.secret || data.task
    || data.schedule || data.network || data.role || data.record
    || data.tunnel || data.log || data.function || Object.values(data).find((v) => v && typeof v === 'object' && !Array.isArray(v) && (v.id || v.name))
    || data;
}

function itemId(item, ops) {
  if (!item) return null;
  const field = ops.idField || 'id';
  return item[field] || item.id || item.name;
}

/**
 * Generic list / create / patch / delete for any manager in the click-ops catalog.
 * Writes every mutation into the project stack JSON.
 */
export const ResourceCrud = ({ serviceName, enabled = true, title, onChanged }) => {
  const [opsList, setOpsList] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/api/setup/click-ops/${encodeURIComponent(serviceName)}`);
        const all = res.data?.all?.length ? res.data.all : (res.data?.ops ? [res.data.ops] : []);
        if (!cancelled) {
          setOpsList(all);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error?.message || err.message || 'No click-ops catalog');
      }
    })();
    return () => { cancelled = true; };
  }, [serviceName]);

  if (!opsList.length) {
    return error ? (
      <Box title={title || 'Resources'}>
        <Text style={S.error}>{error}</Text>
      </Box>
    ) : null;
  }

  return (
    <>
      {opsList.map((ops) => (
        <ResourceCrudPanel
          key={`${serviceName}-${ops.segment || ops.stackKey}`}
          serviceName={serviceName}
          ops={ops}
          enabled={enabled}
          title={opsList.length > 1 ? `${ops.singular || ops.segment}` : title}
          onChanged={onChanged}
        />
      ))}
    </>
  );
};

const ResourceCrudPanel = ({ serviceName, ops, enabled, title, onChanged }) => {
  const { currentProject } = useProject();
  const projectId = currentProject?.id;
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!ops || !projectId || !enabled) {
      setItems([]);
      return;
    }
    try {
      const url = collectionUrl(serviceName, ops, projectId);
      const res = await api.get(url, { params: { project_id: projectId } });
      setItems(extractItems(res.data, ops.listKey));
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to list resources');
      setItems([]);
    }
  }, [ops, projectId, enabled, serviceName]);

  useEffect(() => {
    load();
  }, [load]);

  const fields = [{ key: 'name', label: 'Name', placeholder: `my-${ops?.singular || 'resource'}` }, ...(ops?.fields || [])];

  const handleSave = async () => {
    if (!projectId || !ops || !form.name) return;
    setBusy(true);
    try {
      const body = { project_id: projectId, ...ops.defaults, ...form };
      let saved;
      if (editingId && ops.allowUpdate !== false) {
        const res = await api.patch(itemUrl(serviceName, ops, projectId, editingId), body);
        saved = extractCreated(res.data) || { ...body, id: editingId };
      } else {
        const createUrl = ops.applyPath
          ? `/api/services/${serviceName}${ops.applyPath}`
          : collectionUrl(serviceName, ops, projectId);
        const res = await api.post(createUrl, body);
        saved = extractCreated(res.data) || body;
      }
      await stackService.record(projectId, {
        service: serviceName,
        key: ops.stackKey,
        resource: { name: saved.name || form.name, ...form, id: saved.id },
      });
      setForm({});
      setEditingId(null);
      await load();
      onChanged?.();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const handleEdit = (item) => {
    const next = { name: item.name || '' };
    for (const f of ops.fields || []) {
      if (item[f.key] !== undefined && item[f.key] !== null) next[f.key] = String(item[f.key]);
    }
    setForm(next);
    setEditingId(itemId(item, ops));
  };

  const analogAction = serviceName === 'schedule_manager'
    ? { label: 'Run now', suffix: '/run' }
    : serviceName === 'workflow_manager'
      ? { label: 'Run', suffix: '/run' }
      : null;

  const handleAnalog = async (item) => {
    if (!analogAction) return;
    const id = itemId(item, ops);
    setBusy(true);
    setError(null);
    try {
      await api.post(`${itemUrl(serviceName, ops, projectId, id)}${analogAction.suffix}`, { project_id: projectId });
      await load();
      onChanged?.();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || `${analogAction.label} failed`);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = (item) => {
    const id = itemId(item, ops);
    const label = item.name || id;
    Alert.alert('Delete', `Delete "${label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await api.delete(itemUrl(serviceName, ops, projectId, id), { params: { project_id: projectId } });
            if (item.name) {
              await stackService.unrecord(projectId, { service: serviceName, key: ops.stackKey, name: item.name });
            }
            await load();
            onChanged?.();
          } catch (err) {
            setError(err.response?.data?.error?.message || err.message || 'Delete failed');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  if (!ops) {
    return error ? (
      <Box title={title || 'Resources'}>
        <Text style={S.error}>{error}</Text>
      </Box>
    ) : null;
  }

  const heading = title || `${ops.singular.charAt(0).toUpperCase()}${ops.singular.slice(1)}s`;

  if (!projectId) {
    return (
      <Box title={heading}>
        <Text style={S.hint}>Select a project to manage {ops.singular}s.</Text>
      </Box>
    );
  }

  if (!enabled) {
    return (
      <Box title={heading}>
        <Text style={S.hint}>Enable the service to create and list {ops.singular}s. Changes are saved into this project’s stack JSON.</Text>
      </Box>
    );
  }

  return (
    <>
      <Box title={editingId ? `Update ${ops.singular}` : `Create ${ops.singular}`}>
        <Text style={S.hint}>Click-ops writes into the project stack JSON so apply/recreate matches the console.</Text>
        {error ? <Text style={S.error}>{error}</Text> : null}
        {fields.map((f) => (
          <View key={f.key} style={S.field}>
            <Text style={S.label}>{f.label || f.key}</Text>
            <TextInput
              style={S.input}
              placeholder={f.placeholder}
              placeholderTextColor={colors.textMuted}
              value={form[f.key] || ''}
              onChangeText={(v) => setForm((prev) => ({ ...prev, [f.key]: v }))}
              autoCapitalize="none"
              secureTextEntry={!!f.secret}
            />
          </View>
        ))}
        <Button
          title={editingId ? 'Save' : 'Create'}
          onPress={handleSave}
          loading={busy}
          disabled={!form.name}
        />
        {editingId ? (
          <Button
            title="Cancel edit"
            variant="secondary"
            onPress={() => { setEditingId(null); setForm({}); }}
          />
        ) : null}
      </Box>

      <Box title={heading}>
        {items.length === 0 ? (
          <Text style={S.hint}>No {ops.singular}s yet.</Text>
        ) : (
          items.map((item) => (
            <View key={itemId(item, ops) || item.name} style={S.row}>
              <View style={S.rowBody}>
                <Text style={S.rowName}>{item.name || item.id}</Text>
                {item.arn ? <Text style={S.rowSub} numberOfLines={1}>{item.arn}</Text> : null}
                {item.target_url ? <Text style={S.rowSub} numberOfLines={1}>{item.target_url}</Text> : null}
              </View>
              <View style={S.rowActions}>
                {analogAction ? (
                  <TouchableOpacity onPress={() => handleAnalog(item)}><Text style={S.link}>{analogAction.label}</Text></TouchableOpacity>
                ) : null}
                {ops.allowUpdate !== false ? (
                  <TouchableOpacity onPress={() => handleEdit(item)}><Text style={S.link}>Edit</Text></TouchableOpacity>
                ) : null}
                {ops.allowDelete !== false ? (
                  <TouchableOpacity onPress={() => handleDelete(item)}><Text style={S.danger}>Delete</Text></TouchableOpacity>
                ) : null}
              </View>
            </View>
          ))
        )}
      </Box>
    </>
  );
};

export default ResourceCrud;
