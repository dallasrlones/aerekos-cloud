import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ServiceStatusStyles } from './ServiceStatus.styles';

export const ServiceStatus = ({ status, lastChecked, onRefresh }) => {
  const getStatusColor = () => {
    if (status === 'healthy' || status === 'enabled') return '#4CAF50'; // Green
    if (status === 'unhealthy' || status === 'disabled') return '#F44336'; // Red
    return '#FF9800'; // Orange/Yellow
  };

  const getStatusText = () => {
    if (status === 'healthy' || status === 'enabled') return 'Enabled';
    if (status === 'unhealthy' || status === 'disabled') return 'Disabled';
    return 'Unknown';
  };

  return (
    <View style={ServiceStatusStyles.container}>
      <View style={ServiceStatusStyles.statusRow}>
        <View 
          style={[
            ServiceStatusStyles.statusIndicator,
            { backgroundColor: getStatusColor() }
          ]} 
        />
        <Text style={ServiceStatusStyles.statusText}>{getStatusText()}</Text>
        {onRefresh && (
          <TouchableOpacity 
            onPress={onRefresh}
            style={ServiceStatusStyles.refreshButton}
          >
            <Text style={ServiceStatusStyles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        )}
      </View>
      {lastChecked && (
        <Text style={ServiceStatusStyles.lastChecked}>
          Last checked: {new Date(lastChecked).toLocaleTimeString()}
        </Text>
      )}
    </View>
  );
};
