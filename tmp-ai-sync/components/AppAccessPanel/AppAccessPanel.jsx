import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, ActivityIndicator, Platform, Alert,
} from 'react-native';
import { Box } from '../Box/Box';
import { Button } from '../Button/Button';
import { authManagerService } from '../../services/authManagerService';
import { colors } from '../../styles/theme';
import { AppAccessPanelStyles as S } from './AppAccessPanel.styles';

function copyToClipboard(text) {
  if (Platform.OS === 'web' && navigator?.clipboard) {
    navigator.clipboard.writeText(text);
    return;
  }
  Alert.alert('Copied', 'Copied to clipboard');
}

/**
 * Reusable app-credentials panel for manager resource screens.
 */
export const AppAccessPanel = ({
  projectId,
  apiBase,
  title = 'App access',
  hint,
  resources = [],
  scopes = [],
  defaultScopes = [],
  invokeCurl,
}) => {
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [credName, setCredName] = useState('');
  const [credArns, setCredArns] = useState([]);
  const [credScopes, setCredScopes] = useState(defaultScopes);
  const [creating, setCreating] = useState(false);
  const [newSecret, setNewSecret] = useState(null);

  const loadCredentials = useCallback(async () => {
    if (!projectId) {
      setCredentials([]);
      return;
    }
    setLoading(true);
    try {
      setCredentials(await authManagerService.listCredentials(projectId));
    } catch {
      setCredentials([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadCredentials();
  }, [loadCredentials]);

  const toggleArn = (arn) => {
    setCredArns((prev) => (prev.includes(arn) ? prev.filter((a) => a !== arn) : [...prev, arn]));
  };

  const toggleScope = (scopeId) => {
    setCredScopes((prev) => (prev.includes(scopeId) ? prev.filter((s) => s !== scopeId) : [...prev, scopeId]));
  };

  const handleCreate = async () => {
    if (!projectId || !credName.trim()) return;
    setCreating(true);
    setNewSecret(null);
    try {
      const out = await authManagerService.createCredential(projectId, {
        name: credName.trim(),
        allowed_resources: credArns,
        scopes: credScopes,
      });
      setNewSecret(out);
      setCredName('');
      setCredArns([]);
      await loadCredentials();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error?.message || err.message || 'Failed to create credential');
    } finally {
      setCreating(false);
    }
  };

  const handleRotate = async (id) => {
    if (!projectId) return;
    try {
      const out = await authManagerService.rotateCredential(projectId, id);
      setNewSecret(out);
      await loadCredentials();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error?.message || err.message || 'Rotate failed');
    }
  };

  const handleDelete = async (id, name) => {
    if (!projectId) return;
    const run = async () => {
      try {
        await authManagerService.deleteCredential(projectId, id);
        await loadCredentials();
      } catch (err) {
        Alert.alert('Error', err.response?.data?.error?.message || err.message || 'Delete failed');
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete credential "${name}"?`)) run();
    } else {
      Alert.alert('Delete credential', `Remove "${name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: run },
      ]);
    }
  };

  if (!projectId) {
    return (
      <Box title={title}>
        <Text style={S.hint}>Select a project to manage app credentials.</Text>
      </Box>
    );
  }

  return (
    <>
      <Box title={title}>
        {hint ? <Text style={S.hint}>{hint}</Text> : null}
        <Button title="Create credential" onPress={handleCreate} loading={creating} disabled={!credName.trim()} />
        <Text style={S.label}>Name</Text>
        <TextInput
          style={S.input}
          placeholder="my-backend"
          placeholderTextColor={colors.textMuted}
          value={credName}
          onChangeText={setCredName}
          autoCapitalize="none"
        />
        {resources.length > 0 && (
          <>
            <Text style={S.label}>Allowed resources</Text>
            <View style={S.chipRow}>
              {resources.map((r) => (
                <Button
                  key={r.arn || r.id}
                  title={r.name || r.label || r.arn}
                  variant={credArns.includes(r.arn) ? 'primary' : 'secondary'}
                  onPress={() => toggleArn(r.arn)}
                  style={S.chip}
                />
              ))}
            </View>
            {resources.filter((r) => r.prettyUrl).map((r) => (
              <View key={`url-${r.arn}`} style={S.urlBlock}>
                <Text style={S.label}>{r.name} — pretty invoke URL</Text>
                <Text style={S.mono} selectable>{r.prettyUrl}</Text>
                <Button title="Copy URL" variant="secondary" onPress={() => copyToClipboard(r.prettyUrl)} style={S.chip} />
              </View>
            ))}
          </>
        )}
        {scopes.length > 0 && (
          <>
            <Text style={S.label}>Scopes</Text>
            <View style={S.chipRow}>
              {scopes.map((s) => (
                <Button
                  key={s.id}
                  title={s.label || s.id}
                  variant={credScopes.includes(s.id) ? 'primary' : 'secondary'}
                  onPress={() => toggleScope(s.id)}
                  style={S.chip}
                />
              ))}
            </View>
          </>
        )}
      </Box>

      {newSecret?.client_secret ? (
        <Box title="Save these values — secret shown once">
          <Text style={S.mono}>client_id: {newSecret.client_id}</Text>
          <Text style={S.mono}>client_secret: {newSecret.client_secret}</Text>
          <Button title="Copy client_secret" variant="secondary" onPress={() => copyToClipboard(newSecret.client_secret)} />
        </Box>
      ) : null}

      <Box title="Credentials">
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : credentials.length === 0 ? (
          <Text style={S.hint}>No app credentials yet.</Text>
        ) : (
          credentials.map((c) => (
            <View key={c.id} style={S.row}>
              <View style={S.rowMain}>
                <Text style={S.rowName}>{c.name}</Text>
                <Text style={S.rowSub}>{c.client_id} · {(c.scopes || []).join(', ') || 'no scopes'}</Text>
                <Text style={S.rowSub}>{(c.allowed_resources || []).length} resource(s)</Text>
              </View>
              <View style={S.rowActions}>
                <Button title="Rotate" variant="secondary" onPress={() => handleRotate(c.id)} style={S.chip} />
                <Button title="Delete" variant="secondary" onPress={() => handleDelete(c.id, c.name)} style={S.chip} />
              </View>
            </View>
          ))
        )}
      </Box>

      {invokeCurl ? (
        <Box title="Quick start (curl)">
          <Text style={S.mono}>{invokeCurl}</Text>
          <Button title="Copy curl" variant="secondary" onPress={() => copyToClipboard(invokeCurl)} />
        </Box>
      ) : null}
    </>
  );
};
