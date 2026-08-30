import React, { useState, useEffect } from 'react';
import { View, Text, Alert, ActivityIndicator } from 'react-native';
import { ModalComponent } from '../Modal/Modal';
import { Input } from '../Input/Input';
import { Button } from '../Button/Button';
import { projectService } from '../../services/projectService';
import { colors, spacing } from '../../styles/theme';
import { ServiceConfigModalStyles } from './ServiceConfigModal.styles';

export const ServiceConfigModal = ({ visible, onClose, projectId, serviceId, serviceName, currentConfig }) => {
  const [config, setConfig] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (visible && currentConfig) {
      try {
        // Parse and pretty-print JSON
        const parsed = typeof currentConfig === 'string' ? JSON.parse(currentConfig) : currentConfig;
        setConfig(JSON.stringify(parsed, null, 2));
      } catch (e) {
        setConfig(typeof currentConfig === 'string' ? currentConfig : JSON.stringify(currentConfig || {}, null, 2));
      }
      setError(null);
    } else if (visible) {
      setConfig('{}');
      setError(null);
    }
  }, [visible, currentConfig]);

  const handleSave = async () => {
    setError(null);
    
    // Validate JSON
    let parsedConfig;
    try {
      parsedConfig = JSON.parse(config);
    } catch (e) {
      setError('Invalid JSON format');
      return;
    }

    setSaving(true);
    try {
      const result = await projectService.updateServiceConfig(projectId, serviceId, parsedConfig);
      if (result.success) {
        Alert.alert('Success', 'Service configuration updated successfully');
        onClose();
      } else {
        setError(result.error || 'Failed to update configuration');
      }
    } catch (error) {
      setError(error.message || 'Failed to update configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalComponent
      visible={visible}
      onClose={onClose}
      title={`Configure ${serviceName || 'Service'}`}
    >
      <View style={ServiceConfigModalStyles.container}>
        <Text style={ServiceConfigModalStyles.description}>
          Configure project-specific settings for this service. Enter valid JSON configuration.
        </Text>
        
        {error && (
          <View style={ServiceConfigModalStyles.errorContainer}>
            <Text style={ServiceConfigModalStyles.errorText}>{error}</Text>
          </View>
        )}

        <Input
          label="Configuration (JSON)"
          value={config}
          onChangeText={setConfig}
          placeholder='{"key": "value"}'
          multiline
          numberOfLines={10}
          style={ServiceConfigModalStyles.textArea}
          error={error}
        />

        <View style={ServiceConfigModalStyles.actions}>
          <Button
            title="Cancel"
            onPress={onClose}
            variant="secondary"
            disabled={saving}
            style={ServiceConfigModalStyles.button}
          />
          <Button
            title={saving ? 'Saving...' : 'Save Configuration'}
            onPress={handleSave}
            variant="primary"
            loading={saving}
            disabled={saving || loading}
            style={ServiceConfigModalStyles.button}
          />
        </View>
      </View>
    </ModalComponent>
  );
};
