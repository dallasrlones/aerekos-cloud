import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Box } from '../../components/Box/Box';
import { Button } from '../../components/Button/Button';
import { authManagerService } from '../../services/authManagerService';
import { useProject } from '../../contexts/ProjectContext';
import { colors } from '../../styles/theme';
import { ProviderFormStyles as S } from './ProviderForm.styles';

const PROVIDER_TYPES = ['oidc', 'oauth2', 'google', 'github', 'okta', 'auth0', 'azure_ad', 'saml'];

/**
 * Create OR edit an identity provider. Edit mode is active when route params
 * include a providerId (loads existing values, saves via PATCH, supports delete).
 */
export const ProviderForm = ({ navigation, route }) => {
  const providerId = route?.params?.providerId;
  const isEdit = !!providerId;
  const { currentProject } = useProject();
  const projectId = currentProject?.id;

  const [form, setForm] = useState({
    name: '',
    provider_type: 'oidc',
    issuer: '',
    client_id: '',
    config_json: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);

  const loadProvider = useCallback(async () => {
    if (!isEdit || !projectId) return;
    try {
      const p = await authManagerService.getProvider(projectId, providerId);
      setForm({
        name: p.name || '',
        provider_type: p.provider_type || 'oidc',
        issuer: p.issuer || '',
        client_id: p.client_id || '',
        config_json: p.config_json || '',
      });
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error?.message || err.message || 'Failed to load provider');
    } finally {
      setFetching(false);
    }
  }, [isEdit, projectId, providerId]);

  useEffect(() => { loadProvider(); }, [loadProvider]);

  const update = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Provider name is required';
    if (form.config_json.trim()) {
      try { JSON.parse(form.config_json); } catch (_) { e.config_json = 'Must be valid JSON'; }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!projectId) {
      Alert.alert('No project', 'Select a project before adding a provider.');
      return;
    }
    if (!validate()) return;

    setLoading(true);
    try {
      const data = {
        name: form.name.trim(),
        provider_type: form.provider_type,
        issuer: form.issuer.trim(),
        client_id: form.client_id.trim(),
        config_json: form.config_json.trim(),
      };
      if (isEdit) {
        await authManagerService.updateProvider(projectId, providerId, data);
      } else {
        await authManagerService.createProvider(projectId, data);
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error?.message || error.message || 'Failed to save provider');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete provider', `Delete "${form.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await authManagerService.deleteProvider(projectId, providerId);
            navigation.goBack();
          } catch (err) {
            Alert.alert('Error', err.response?.data?.error?.message || err.message || 'Failed to delete provider');
          }
        },
      },
    ]);
  };

  if (fetching) {
    return (
      <View style={[S.container, S.center]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={S.container} contentContainerStyle={S.content}>
      <Text style={S.title}>{isEdit ? 'Edit provider' : 'Add identity provider'}</Text>
      <Text style={S.subtitle}>OIDC/OAuth provider metadata. Store the client secret in Secrets Manager.</Text>

      <Box title="Provider">
        <View style={S.field}>
          <Text style={S.label}>Name *</Text>
          <TextInput
            style={[S.input, errors.name && S.inputError]}
            value={form.name}
            onChangeText={(v) => update('name', v)}
            placeholder="google-workspace"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {errors.name && <Text style={S.errorText}>{errors.name}</Text>}
        </View>

        <View style={S.field}>
          <Text style={S.label}>Type</Text>
          <View style={S.chips}>
            {PROVIDER_TYPES.map((t) => (
              <Button
                key={t}
                title={t}
                onPress={() => update('provider_type', t)}
                variant={form.provider_type === t ? 'primary' : 'secondary'}
                style={S.chip}
              />
            ))}
          </View>
        </View>
      </Box>

      <Box title="Connection">
        <View style={S.field}>
          <Text style={S.label}>Issuer URL</Text>
          <TextInput
            style={S.input}
            value={form.issuer}
            onChangeText={(v) => update('issuer', v)}
            placeholder="https://accounts.google.com"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={S.field}>
          <Text style={S.label}>Client ID</Text>
          <TextInput
            style={S.input}
            value={form.client_id}
            onChangeText={(v) => update('client_id', v)}
            placeholder="xxxxxxxx.apps.googleusercontent.com"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={S.field}>
          <Text style={S.label}>Config (JSON)</Text>
          <TextInput
            style={[S.input, S.multiline, errors.config_json && S.inputError]}
            value={form.config_json}
            onChangeText={(v) => update('config_json', v)}
            placeholder={'{\n  "scopes": ["openid", "email"]\n}'}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
          />
          {errors.config_json && <Text style={S.errorText}>{errors.config_json}</Text>}
          <Text style={S.help}>Optional extra settings (scopes, redirect URIs, …).</Text>
        </View>
      </Box>

      <View style={S.buttons}>
        <Button title={isEdit ? 'Save changes' : 'Add provider'} onPress={handleSubmit} loading={loading} disabled={loading} />
        {isEdit && <Button title="Delete provider" onPress={handleDelete} variant="danger" style={S.cancel} />}
        <Button title="Cancel" onPress={() => navigation.goBack()} variant="secondary" style={S.cancel} />
      </View>
    </ScrollView>
  );
};
