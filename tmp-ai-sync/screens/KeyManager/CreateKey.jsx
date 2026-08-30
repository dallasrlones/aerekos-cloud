import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Input } from '../../components/Input/Input';
import { keyManagerService } from '../../services/keyManagerService';
import { useProject } from '../../contexts/ProjectContext';
import { CreateKeyStyles } from './CreateKey.styles';

export const CreateKey = ({ navigation }) => {
  const { currentProject } = useProject();
  const [name, setName] = useState('');
  const [type, setType] = useState('symmetric');
  const [algorithm, setAlgorithm] = useState('AES-256-GCM');
  const [metadata, setMetadata] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const algorithms = {
    symmetric: ['AES-256-GCM', 'AES-128-GCM'],
    asymmetric: ['RSA-4096', 'RSA-2048'],
    master: []
  };

  const validate = () => {
    const newErrors = {};

    if (!name || name.trim().length < 3) {
      newErrors.name = 'Key name must be at least 3 characters';
    }
    if (name && name.length > 100) {
      newErrors.name = 'Key name must be less than 100 characters';
    }
    if (!type) {
      newErrors.type = 'Key type is required';
    }
    if (!algorithm) {
      newErrors.algorithm = 'Algorithm is required';
    }
    if (metadata) {
      try {
        JSON.parse(metadata);
      } catch (e) {
        newErrors.metadata = 'Metadata must be valid JSON';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }

    if (!currentProject?.id) {
      Alert.alert('Error', 'No project selected. Please select a project first.');
      return;
    }

    setLoading(true);
    try {
      const keyData = {
        name: name.trim(),
        type,
        algorithm,
        metadata: metadata ? JSON.parse(metadata) : {}
      };

      const createdKey = await keyManagerService.createKey(currentProject.id, keyData);
      
      Alert.alert('Success', 'Key created successfully', [
        {
          text: 'OK',
          onPress: () => navigation.navigate('keyDetails', { keyName: createdKey.name })
        }
      ]);
    } catch (err) {
      console.error('Error creating key:', err);
      // Handle 409 Conflict (key already exists)
      if (err.response?.status === 409 || err.message?.includes('already exists')) {
        Alert.alert('Key Already Exists', `A key with the name "${name.trim()}" already exists. Please choose a different name.`);
      } else {
        Alert.alert('Error', err.response?.data?.error?.message || err.message || 'Failed to create key');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTypeChange = (newType) => {
    setType(newType);
    // Reset algorithm when type changes
    if (algorithms[newType] && algorithms[newType].length > 0) {
      setAlgorithm(algorithms[newType][0]);
    } else {
      setAlgorithm('');
    }
  };

  return (
    <ScrollView
      style={CreateKeyStyles.container}
      contentContainerStyle={CreateKeyStyles.content}
    >
      {/* Header */}
      <View style={CreateKeyStyles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={CreateKeyStyles.backButton}
        >
          <Text style={CreateKeyStyles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={CreateKeyStyles.title}>Create Key</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Form */}
      <View style={CreateKeyStyles.form}>
        <Input
          label="Key Name *"
          value={name}
          onChangeText={setName}
          placeholder="e.g., storage-encryption-key"
          error={errors.name}
          autoCapitalize="none"
        />

        <View style={CreateKeyStyles.field}>
          <Text style={CreateKeyStyles.fieldLabel}>Key Type *</Text>
          <View style={CreateKeyStyles.typeButtons}>
            <TouchableOpacity
              style={[
                CreateKeyStyles.typeButton,
                type === 'symmetric' && CreateKeyStyles.typeButtonActive
              ]}
              onPress={() => handleTypeChange('symmetric')}
            >
              <Text style={[
                CreateKeyStyles.typeButtonText,
                type === 'symmetric' && CreateKeyStyles.typeButtonTextActive
              ]}>
                Symmetric
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                CreateKeyStyles.typeButton,
                type === 'asymmetric' && CreateKeyStyles.typeButtonActive
              ]}
              onPress={() => handleTypeChange('asymmetric')}
            >
              <Text style={[
                CreateKeyStyles.typeButtonText,
                type === 'asymmetric' && CreateKeyStyles.typeButtonTextActive
              ]}>
                Asymmetric
              </Text>
            </TouchableOpacity>
          </View>
          {errors.type && (
            <Text style={CreateKeyStyles.errorText}>{errors.type}</Text>
          )}
        </View>

        {algorithms[type] && algorithms[type].length > 0 && (
          <View style={CreateKeyStyles.field}>
            <Text style={CreateKeyStyles.fieldLabel}>Algorithm *</Text>
            <View style={CreateKeyStyles.algorithmButtons}>
              {algorithms[type].map((alg) => (
                <TouchableOpacity
                  key={alg}
                  style={[
                    CreateKeyStyles.algorithmButton,
                    algorithm === alg && CreateKeyStyles.algorithmButtonActive
                  ]}
                  onPress={() => setAlgorithm(alg)}
                >
                  <Text style={[
                    CreateKeyStyles.algorithmButtonText,
                    algorithm === alg && CreateKeyStyles.algorithmButtonTextActive
                  ]}>
                    {alg}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {errors.algorithm && (
              <Text style={CreateKeyStyles.errorText}>{errors.algorithm}</Text>
            )}
          </View>
        )}

        <View style={CreateKeyStyles.field}>
          <Text style={CreateKeyStyles.fieldLabel}>Metadata (JSON, optional)</Text>
          <Input
            value={metadata}
            onChangeText={setMetadata}
            placeholder='{"description": "Key for storage encryption"}'
            multiline
            numberOfLines={4}
            error={errors.metadata}
            style={CreateKeyStyles.metadataInput}
          />
        </View>

        <View style={CreateKeyStyles.actions}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[CreateKeyStyles.button, CreateKeyStyles.cancelButton]}
          >
            <Text style={CreateKeyStyles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            style={[
              CreateKeyStyles.button,
              CreateKeyStyles.submitButton,
              loading && CreateKeyStyles.buttonDisabled
            ]}
          >
            <Text style={CreateKeyStyles.submitButtonText}>
              {loading ? 'Creating...' : 'Create Key'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};
