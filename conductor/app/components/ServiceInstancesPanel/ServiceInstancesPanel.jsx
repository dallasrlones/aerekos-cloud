import React from 'react';
import { View, Text } from 'react-native';
import { colors } from '../../styles/theme';

/** Instances running this manager on the fleet (health, not enabled-dot). */
export function ServiceInstancesPanel({ instances = [], emptyHint = 'No instances reported on this worker yet.' }) {
  const list = Array.isArray(instances) ? instances : [];
  return (
    <View style={{ marginTop: 16, padding: 12, borderRadius: 8, backgroundColor: colors.surface || '#111' }}>
      <Text style={{ color: colors.text || '#eee', fontWeight: '600', marginBottom: 8 }}>Instances</Text>
      {list.length === 0 ? (
        <Text style={{ color: colors.textMuted || '#888' }}>{emptyHint}</Text>
      ) : (
        list.map((row, i) => (
          <View key={row.deployment_id || row.id || i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
            <Text style={{ color: colors.text || '#eee' }}>{row.service || row.hostname || 'instance'}</Text>
            <Text style={{ color: row.health === 'up' || row.status === 'running' ? '#4CAF50' : '#F44336' }}>
              {row.health || row.status || 'unknown'}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

export default ServiceInstancesPanel;
