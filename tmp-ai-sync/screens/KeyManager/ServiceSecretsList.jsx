import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { secretsManagerService } from '../../services/secretsManagerService';
import { useProject } from '../../contexts/ProjectContext';
import { ServiceSecretsListStyles } from './ServiceSecretsList.styles';

export const ServiceSecretsList = ({ navigation }) => {
  const { currentProject } = useProject();
  const [secrets, setSecrets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!currentProject?.id) {
      setError('No project selected.');
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const data = await secretsManagerService.listSecrets(currentProject.id);
      setSecrets(data.secrets || []);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Failed to load secrets');
    } finally {
      setLoading(false);
    }
  }, [currentProject?.id]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={ServiceSecretsListStyles.container}
      contentContainerStyle={ServiceSecretsListStyles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={ServiceSecretsListStyles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={ServiceSecretsListStyles.backButton}
        >
          <Text style={ServiceSecretsListStyles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={ServiceSecretsListStyles.title}>Service secrets</Text>
        <View style={{ width: 60 }} />
      </View>

      <Text style={ServiceSecretsListStyles.helpText}>
        Store API tokens and other credentials for services (for example Cloudflare for tunnel and DNS
        managers). Map names to your worker environment (e.g. set CLOUDFLARE_API_TOKEN from a secret
        named cloudflare_api_token). These are encrypted by the secrets service using your key manager.
      </Text>

      {error ? <Text style={ServiceSecretsListStyles.errorText}>{error}</Text> : null}
      {loading && !error ? (
        <Text style={ServiceSecretsListStyles.loadingText}>Loading…</Text>
      ) : null}

      {!loading &&
        (secrets || []).map((s) => (
          <TouchableOpacity
            key={s.id}
            style={ServiceSecretsListStyles.row}
            onPress={() => navigation.navigate('serviceSecretDetails', { secretId: s.id })}
          >
            <Text style={ServiceSecretsListStyles.rowName}>{s.name}</Text>
            <Text style={ServiceSecretsListStyles.rowMeta}>
              {s.id} · {s.created_at ? String(s.created_at).slice(0, 10) : ''}
            </Text>
          </TouchableOpacity>
        ))}

      <TouchableOpacity
        style={ServiceSecretsListStyles.createBtn}
        onPress={() => navigation.navigate('createServiceSecret')}
      >
        <Text style={ServiceSecretsListStyles.createBtnText}>Add secret</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};
