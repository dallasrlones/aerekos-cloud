import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { secretsManagerService } from '../../services/secretsManagerService';
import { useProject } from '../../contexts/ProjectContext';
import { ServiceSecretsListStyles } from './ServiceSecretsList.styles';
import { ResourceCrud } from '../../components/ResourceCrud';
import { EnvSwitcher } from '../../components/EnvSwitcher/EnvSwitcher';
import { NextSteps } from '../../components/NextSteps/NextSteps';
import { ServiceGuide } from '../../components/ServiceGuide/ServiceGuide';
import { useServiceGuideDeps } from '../../hooks/useServiceGuideDeps';

export const ServiceSecretsList = ({ navigation }) => {
  const { currentProject, currentEnvironment } = useProject();
  const [secrets, setSecrets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const { guideDeps, openDep, enableAllDeps, onSetup } = useServiceGuideDeps('secrets_manager', navigation);

  const load = useCallback(async () => {
    if (!currentProject?.id) {
      setError('No project selected.');
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const data = await secretsManagerService.listSecrets(currentProject.id, currentEnvironment);
      setSecrets(data.secrets || []);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Failed to load secrets');
    } finally {
      setLoading(false);
    }
  }, [currentProject?.id, currentEnvironment]);

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

      <EnvSwitcher />
      <NextSteps navigation={navigation} filter={['fill_secret']} />

      <ServiceGuide
        title="Secrets Manager guide"
        analogue="AWS Secrets Manager"
        blurb="Project-scoped API tokens and integration credentials — encrypted at rest with key_manager envelopes and mapped to worker environment variables."
        whenToUse={[
          'Provider API keys for ai_manager and edge_manager',
          'Webhook signing secrets and bootstrap client secrets',
          'Cloudflare and DNS tokens for tunnel services',
        ]}
        prerequisites={[
          'Select a project and environment',
          'Enable key_manager then secrets_manager',
        ]}
        examples={[
          {
            label: 'Create secret',
            code: `POST /api/services/secrets_manager/api/v1/secrets\n{ "project_id": "{projectId}", "name": "cloudflare_api_token", "value": "…" }`,
          },
          {
            label: 'List secrets',
            code: `GET /api/services/secrets_manager/api/v1/secrets?project_id={projectId}&env=prod`,
          },
        ]}
        deps={guideDeps}
        onSetupDep={openDep}
        onEnableAllDeps={enableAllDeps}
        onSetup={onSetup}
      />

      <Text style={ServiceSecretsListStyles.helpText}>
        Store API tokens and other credentials for services (for example Cloudflare for tunnel and DNS
        managers). Map names to your worker environment (e.g. set CLOUDFLARE_API_TOKEN from a secret
        named cloudflare_api_token). These are encrypted by the secrets service using your key manager.
      </Text>

      {error ? <Text style={ServiceSecretsListStyles.errorText}>{error}</Text> : null}
      {loading && !error ? (
        <Text style={ServiceSecretsListStyles.loadingText}>Loading…</Text>
      ) : null}

      {!loading && !secrets.length ? (
        <Text style={ServiceSecretsListStyles.helpText}>
          {currentEnvironment === 'dev'
            ? 'Dev has no secrets yet. Add a NAME and value — we never copy from prod.'
            : 'No secrets in this environment yet.'}
        </Text>
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
      {currentProject?.id ? <ResourceCrud serviceName="secrets_manager" enabled onChanged={load} /> : null}
    </ScrollView>
  );
};
