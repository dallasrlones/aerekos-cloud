import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  RefreshControl
} from 'react-native';
import { secretsManagerService } from '../../services/secretsManagerService';
import { useProject } from '../../contexts/ProjectContext';
import { colors } from '../../styles/theme';
import { CreateKeyStyles } from './CreateKey.styles';
import { stackService } from '../../services/stackService';

export const ServiceSecretDetails = ({ navigation, route }) => {
  const { secretId } = route?.params || {};
  const { currentProject } = useProject();
  const [secret, setSecret] = useState(null);
  const [revealed, setRevealed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [revealLoading, setRevealLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (withReveal) => {
      if (!currentProject?.id || !secretId) {
        setError('Missing project or secret');
        setLoading(false);
        return;
      }
      try {
        setError(null);
        const res = await secretsManagerService.getSecret(currentProject.id, secretId, {
          reveal: !!withReveal
        });
        setSecret(res.secret);
        if (withReveal && res.secret?.value != null) {
          setRevealed(res.secret.value);
        } else if (!withReveal) {
          setRevealed(null);
        }
      } catch (e) {
        setError(e.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    },
    [currentProject?.id, secretId]
  );

  useEffect(() => {
    setLoading(true);
    load(false);
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(!!revealed);
    setRefreshing(false);
  };

  const doReveal = async () => {
    setRevealLoading(true);
    try {
      await load(true);
    } finally {
      setRevealLoading(false);
    }
  };

  const doUpdate = async () => {
    if (!newValue) {
      Alert.alert('Value required', 'Enter a new value to update the secret.');
      return;
    }
    setSaving(true);
    try {
      await secretsManagerService.updateSecret(currentProject.id, secretId, { value: newValue });
      setEditing(false);
      setNewValue('');
      setRevealed(null);
      await load(false);
      Alert.alert('Updated', 'Secret value updated.');
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error?.message || e.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const doDelete = () => {
    Alert.alert('Delete secret?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await secretsManagerService.deleteSecret(currentProject.id, secretId);
            await stackService.unrecord(currentProject.id, { service: 'secrets_manager', name: secret?.name });
            navigation.navigate('serviceSecretsList');
          } catch (e) {
            Alert.alert('Error', e.message || 'Delete failed');
          }
        }
      }
    ]);
  };

  if (loading && !secret) {
    return (
      <View style={CreateKeyStyles.container}>
        <Text style={{ padding: 16 }}>Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={CreateKeyStyles.container}
      contentContainerStyle={CreateKeyStyles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={CreateKeyStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={CreateKeyStyles.backButton}>
          <Text style={CreateKeyStyles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={CreateKeyStyles.title}>Secret</Text>
        <View style={{ width: 60 }} />
      </View>

      {error ? <Text style={CreateKeyStyles.errorText}>{error}</Text> : null}

      {secret && (
        <View style={{ marginBottom: 16 }}>
          <Text style={CreateKeyStyles.fieldLabel}>Name</Text>
          <Text style={{ fontSize: 16, marginBottom: 12 }}>{secret.name}</Text>
          <Text style={CreateKeyStyles.fieldLabel}>Id</Text>
          <Text style={{ fontSize: 13, color: '#666' }}>{secret.id}</Text>
        </View>
      )}

      {revealed != null && (
        <View style={{ marginBottom: 16 }}>
          <Text style={CreateKeyStyles.fieldLabel}>Value (sensitive)</Text>
          <Text
            style={{
              fontSize: 13,
              fontFamily: 'monospace',
              backgroundColor: '#f0f0f0',
              padding: 10,
              borderRadius: 6
            }}
            selectable
          >
            {revealed}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[CreateKeyStyles.button, CreateKeyStyles.submitButton, { marginBottom: 12 }]}
        onPress={doReveal}
        disabled={revealLoading}
      >
        <Text style={CreateKeyStyles.submitButtonText}>
          {revealLoading ? 'Loading…' : revealed != null ? 'Refresh value' : 'Reveal value'}
        </Text>
      </TouchableOpacity>

      {editing ? (
        <View style={{ marginBottom: 12 }}>
          <Text style={CreateKeyStyles.fieldLabel}>New value</Text>
          <TextInput
            value={newValue}
            onChangeText={setNewValue}
            placeholder="Enter new secret value"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 6,
              padding: 10,
              fontSize: 14,
              marginBottom: 8,
              backgroundColor: colors.surface,
            }}
          />
          <TouchableOpacity
            style={[CreateKeyStyles.button, CreateKeyStyles.submitButton, { marginBottom: 8 }]}
            onPress={doUpdate}
            disabled={saving}
          >
            <Text style={CreateKeyStyles.submitButtonText}>{saving ? 'Saving…' : 'Save new value'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[CreateKeyStyles.button]}
            onPress={() => { setEditing(false); setNewValue(''); }}
          >
            <Text style={{ textAlign: 'center', fontWeight: '600' }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[CreateKeyStyles.button, CreateKeyStyles.submitButton, { marginBottom: 12 }]}
          onPress={() => setEditing(true)}
        >
          <Text style={CreateKeyStyles.submitButtonText}>Update value</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[CreateKeyStyles.button, { backgroundColor: '#c62828' }]}
        onPress={doDelete}
      >
        <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '600' }}>Delete secret</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};
