import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ServiceToggleStyles } from './ServiceToggle.styles';

export const ServiceToggle = ({ enabled, onToggle, loading = false }) => {
  const [confirming, setConfirming] = useState(false);

  const handleToggle = () => {
    if (enabled && !confirming) {
      // Require confirmation for disable
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000); // Auto-cancel confirmation after 3s
      return;
    }

    setConfirming(false);
    onToggle(!enabled);
  };

  return (
    <View style={ServiceToggleStyles.container}>
      <Text style={ServiceToggleStyles.label}>
        Service Status
      </Text>
      <View style={ServiceToggleStyles.toggleContainer}>
        {confirming && enabled ? (
          <View style={ServiceToggleStyles.confirmContainer}>
            <Text style={ServiceToggleStyles.confirmText}>
              Click again to disable
            </Text>
            <TouchableOpacity
              onPress={() => {
                setConfirming(false);
                onToggle(false);
              }}
              style={[ServiceToggleStyles.button, ServiceToggleStyles.disableButton]}
            >
              <Text style={ServiceToggleStyles.buttonText}>Disable</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setConfirming(false)}
              style={[ServiceToggleStyles.button, ServiceToggleStyles.cancelButton]}
            >
              <Text style={ServiceToggleStyles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={handleToggle}
            disabled={loading}
            style={[
              ServiceToggleStyles.toggle,
              enabled ? ServiceToggleStyles.toggleEnabled : ServiceToggleStyles.toggleDisabled,
              loading && ServiceToggleStyles.toggleLoading
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <View style={[
                ServiceToggleStyles.toggleThumb,
                enabled ? ServiceToggleStyles.toggleThumbEnabled : ServiceToggleStyles.toggleThumbDisabled
              ]} />
            )}
          </TouchableOpacity>
        )}
        <Text style={ServiceToggleStyles.statusText}>
          {loading ? 'Loading...' : enabled ? 'Enabled' : 'Disabled'}
        </Text>
      </View>
    </View>
  );
};
