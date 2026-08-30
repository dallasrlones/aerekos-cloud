import React, { useState, useEffect } from 'react';
import { View, Text, Alert, ScrollView } from 'react-native';
import { ModalComponent } from '../Modal/Modal';
import { Input } from '../Input/Input';
import { Button } from '../Button/Button';
import { projectService } from '../../services/projectService';
import { colors, spacing } from '../../styles/theme';
import { ScalingPolicyModalStyles } from './ScalingPolicyModal.styles';

export const ScalingPolicyModal = ({ visible, onClose, projectId, serviceId, serviceName, currentPolicy }) => {
  const [minInstances, setMinInstances] = useState('1');
  const [maxInstances, setMaxInstances] = useState('5');
  const [targetCpu, setTargetCpu] = useState('75');
  const [targetMemory, setTargetMemory] = useState('80');
  const [targetRequestRate, setTargetRequestRate] = useState('');
  const [scaleUpCooldown, setScaleUpCooldown] = useState('60');
  const [scaleDownCooldown, setScaleDownCooldown] = useState('300');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (visible && currentPolicy) {
      try {
        const policy = typeof currentPolicy === 'string' ? JSON.parse(currentPolicy) : currentPolicy;
        setMinInstances(String(policy.min_instances || 1));
        setMaxInstances(String(policy.max_instances || 5));
        setTargetCpu(String(policy.target_cpu || 75));
        setTargetMemory(String(policy.target_memory || 80));
        setTargetRequestRate(policy.target_request_rate ? String(policy.target_request_rate) : '');
        setScaleUpCooldown(String(policy.scale_up_cooldown || 60));
        setScaleDownCooldown(String(policy.scale_down_cooldown || 300));
      } catch (e) {
        // Use defaults if parsing fails
      }
      setError(null);
    } else if (visible) {
      // Reset to defaults
      setMinInstances('1');
      setMaxInstances('5');
      setTargetCpu('75');
      setTargetMemory('80');
      setTargetRequestRate('');
      setScaleUpCooldown('60');
      setScaleDownCooldown('300');
      setError(null);
    }
  }, [visible, currentPolicy]);

  const validateAndSave = async () => {
    setError(null);

    // Validation
    const min = parseInt(minInstances);
    const max = parseInt(maxInstances);
    const cpu = parseInt(targetCpu);
    const mem = parseInt(targetMemory);
    const reqRate = targetRequestRate ? parseInt(targetRequestRate) : null;
    const upCooldown = parseInt(scaleUpCooldown);
    const downCooldown = parseInt(scaleDownCooldown);

    if (isNaN(min) || min < 1) {
      setError('Min instances must be at least 1');
      return;
    }
    if (isNaN(max) || max < min) {
      setError('Max instances must be greater than or equal to min instances');
      return;
    }
    if (isNaN(cpu) || cpu < 1 || cpu > 100) {
      setError('Target CPU must be between 1 and 100');
      return;
    }
    if (isNaN(mem) || mem < 1 || mem > 100) {
      setError('Target Memory must be between 1 and 100');
      return;
    }
    if (reqRate !== null && (isNaN(reqRate) || reqRate < 0)) {
      setError('Target Request Rate must be a positive number');
      return;
    }
    if (isNaN(upCooldown) || upCooldown < 0) {
      setError('Scale Up Cooldown must be a positive number');
      return;
    }
    if (isNaN(downCooldown) || downCooldown < 0) {
      setError('Scale Down Cooldown must be a positive number');
      return;
    }

    const scalingPolicy = {
      min_instances: min,
      max_instances: max,
      target_cpu: cpu,
      target_memory: mem,
      target_request_rate: reqRate,
      scale_up_cooldown: upCooldown,
      scale_down_cooldown: downCooldown,
    };

    setSaving(true);
    try {
      const result = await projectService.updateScalingPolicy(projectId, serviceId, scalingPolicy);
      if (result.success) {
        Alert.alert('Success', 'Scaling policy updated successfully');
        onClose();
      } else {
        setError(result.error || 'Failed to update scaling policy');
      }
    } catch (error) {
      setError(error.message || 'Failed to update scaling policy');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalComponent
      visible={visible}
      onClose={onClose}
      title={`Scaling Policy - ${serviceName || 'Service'}`}
    >
      <ScrollView style={ScalingPolicyModalStyles.container}>
        <Text style={ScalingPolicyModalStyles.description}>
          Configure auto-scaling behavior for this service. The system will automatically scale instances based on these thresholds.
        </Text>

        {error && (
          <View style={ScalingPolicyModalStyles.errorContainer}>
            <Text style={ScalingPolicyModalStyles.errorText}>{error}</Text>
          </View>
        )}

        <View style={ScalingPolicyModalStyles.section}>
          <Text style={ScalingPolicyModalStyles.sectionTitle}>Instance Limits</Text>
          <Input
            label="Min Instances"
            value={minInstances}
            onChangeText={setMinInstances}
            placeholder="1"
            keyboardType="numeric"
          />
          <Input
            label="Max Instances"
            value={maxInstances}
            onChangeText={setMaxInstances}
            placeholder="5"
            keyboardType="numeric"
          />
        </View>

        <View style={ScalingPolicyModalStyles.section}>
          <Text style={ScalingPolicyModalStyles.sectionTitle}>Target Metrics (%)</Text>
          <Input
            label="Target CPU Usage"
            value={targetCpu}
            onChangeText={setTargetCpu}
            placeholder="75"
            keyboardType="numeric"
          />
          <Input
            label="Target Memory Usage"
            value={targetMemory}
            onChangeText={setTargetMemory}
            placeholder="80"
            keyboardType="numeric"
          />
          <Input
            label="Target Request Rate (optional)"
            value={targetRequestRate}
            onChangeText={setTargetRequestRate}
            placeholder="Leave empty to disable"
            keyboardType="numeric"
          />
        </View>

        <View style={ScalingPolicyModalStyles.section}>
          <Text style={ScalingPolicyModalStyles.sectionTitle}>Cooldown Periods (seconds)</Text>
          <Input
            label="Scale Up Cooldown"
            value={scaleUpCooldown}
            onChangeText={setScaleUpCooldown}
            placeholder="60"
            keyboardType="numeric"
          />
          <Input
            label="Scale Down Cooldown"
            value={scaleDownCooldown}
            onChangeText={setScaleDownCooldown}
            placeholder="300"
            keyboardType="numeric"
          />
        </View>

        <View style={ScalingPolicyModalStyles.actions}>
          <Button
            title="Cancel"
            onPress={onClose}
            variant="secondary"
            disabled={saving}
            style={ScalingPolicyModalStyles.button}
          />
          <Button
            title={saving ? 'Saving...' : 'Save Policy'}
            onPress={validateAndSave}
            variant="primary"
            loading={saving}
            disabled={saving}
            style={ScalingPolicyModalStyles.button}
          />
        </View>
      </ScrollView>
    </ModalComponent>
  );
};
