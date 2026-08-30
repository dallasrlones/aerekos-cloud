import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, TextInput } from 'react-native';
import { Input } from '../../components/Input/Input';
import { secretsManagerService } from '../../services/secretsManagerService';
import { useProject } from '../../contexts/ProjectContext';
import { CreateKeyStyles } from './CreateKey.styles';
import { stackService } from '../../services/stackService';

const PRESETS = [
  {
    name: 'cloudflare_api_token',
    hint: 'Cloudflare API token (Tunnel + DNS; Account / Zone permissions as required)'
  },
  {
    name: 'cloudflare_account_id',
    hint: 'Cloudflare account ID (tunnel and account-scoped API calls)'
  },
  {
    name: 'cloudflare_zone_id',
    hint: 'Default zone ID (optional; used by domain_manager when a single zone is configured)'
  }
];

export const CreateServiceSecret = ({ navigation }) => {
  const { currentProject, currentEnvironment } = useProject();
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [metadata, setMetadata] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const applyPreset = (presetName) => {
    setName(presetName);
  };

  const validate = () => {
    const e = {};
    if (!name || name.trim().length < 2) {
      e.name = 'Name is required (letters, numbers, . _ -)';
    }
    if (!value || String(value).length < 1) {
      e.value = 'Value is required';
    }
    if (metadata) {
      try {
        JSON.parse(metadata);
      } catch {
        e.metadata = 'Metadata must be valid JSON (or leave empty)';
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !currentProject?.id) {
      if (!currentProject?.id) {
        Alert.alert('Error', 'Select a project first.');
      }
      return;
    }
    const save = async () => {
    setLoading(true);
    try {
      const body = {
        name: name.trim(),
        value: String(value),
        environment: currentEnvironment || 'prod',
      };
      if (metadata.trim()) {
        body.metadata = JSON.parse(metadata);
      }
      const res = await secretsManagerService.createSecret(currentProject.id, body);
      await stackService.record(currentProject.id, {
        service: 'secrets_manager',
        resource: { name: body.name },
      });
      const id = res?.secret?.id;
      Alert.alert('Saved', 'Secret stored (value not shown in list).', [
        {
          text: 'OK',
          onPress: () =>
            id
              ? navigation.navigate('serviceSecretDetails', { secretId: id })
              : navigation.goBack()
        }
      ]);
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message || 'Failed to create';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
    };
    if ((currentEnvironment || 'prod') === 'prod') {
      Alert.alert('Write prod secret', 'This stores a value on prod. Confirm to continue.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Save on prod', onPress: save },
      ]);
      return;
    }
    await save();
  };

  return (
    <ScrollView style={CreateKeyStyles.container} contentContainerStyle={CreateKeyStyles.content}>
      <View style={CreateKeyStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={CreateKeyStyles.backButton}>
          <Text style={CreateKeyStyles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={CreateKeyStyles.title}>New secret</Text>
        <View style={{ width: 60 }} />
      </View>

      <Text
        style={{
          fontSize: 13,
          color: '#666',
          marginBottom: 12
        }}
      >
        Suggested names for edge services (tap to fill the name field):
      </Text>
      {PRESETS.map((p) => (
        <TouchableOpacity
          key={p.name}
          onPress={() => applyPreset(p.name)}
          style={{ marginBottom: 8, padding: 10, backgroundColor: '#f5f5f5', borderRadius: 8 }}
        >
          <Text style={{ fontWeight: '600' }}>{p.name}</Text>
          <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{p.hint}</Text>
        </TouchableOpacity>
      ))}

      <View style={CreateKeyStyles.form}>
        <Input
          label="Secret name *"
          value={name}
          onChangeText={setName}
          error={errors.name}
          autoCapitalize="none"
        />
        <Text style={CreateKeyStyles.fieldLabel}>Secret value *</Text>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder="Paste token or key"
          secureTextEntry
          multiline
          style={{
            minHeight: 80,
            borderWidth: 1,
            borderColor: '#ccc',
            borderRadius: 8,
            padding: 12,
            textAlignVertical: 'top',
            backgroundColor: '#fff'
          }}
        />
        {errors.value ? <Text style={CreateKeyStyles.errorText}>{errors.value}</Text> : null}

        <Text style={CreateKeyStyles.fieldLabel}>Metadata (JSON, optional)</Text>
        <TextInput
          value={metadata}
          onChangeText={setMetadata}
          placeholder='{"note":"e.g. tunnel prod"}'
          multiline
          style={CreateKeyStyles.metadataInput}
        />
        {errors.metadata ? <Text style={CreateKeyStyles.errorText}>{errors.metadata}</Text> : null}
      </View>

      <View style={CreateKeyStyles.actions}>
        <TouchableOpacity
          style={[CreateKeyStyles.button, CreateKeyStyles.cancelButton]}
          onPress={() => navigation.goBack()}
        >
          <Text style={CreateKeyStyles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            CreateKeyStyles.button,
            CreateKeyStyles.submitButton,
            loading && CreateKeyStyles.buttonDisabled
          ]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={CreateKeyStyles.submitButtonText}>{loading ? 'Saving…' : 'Save'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};
