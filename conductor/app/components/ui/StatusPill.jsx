import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { colors, borderRadius, spacing } from '../../styles/theme';

const MAP = {
  enabled: { bg: 'rgba(46,125,50,0.12)', fg: colors.success, label: 'Enabled' },
  online: { bg: 'rgba(46,125,50,0.12)', fg: colors.success, label: 'Online' },
  healthy: { bg: 'rgba(46,125,50,0.12)', fg: colors.success, label: 'Healthy' },
  success: { bg: 'rgba(46,125,50,0.12)', fg: colors.success, label: 'Ok' },
  disabled: { bg: colors.surface, fg: colors.textMuted, label: 'Off' },
  offline: { bg: colors.surface, fg: colors.textMuted, label: 'Offline' },
  error: { bg: 'rgba(198,40,40,0.12)', fg: colors.error, label: 'Error' },
  warning: { bg: 'rgba(233,168,37,0.18)', fg: colors.warning, label: 'Warning' },
  pending: { bg: 'rgba(233,168,37,0.18)', fg: colors.warning, label: 'Pending' },
};

export const StatusPill = ({ status, label }) => {
  const key = String(status || '').toLowerCase();
  const m = MAP[key] || { bg: colors.surface, fg: colors.textMuted, label: status || '—' };
  return (
    <View style={[styles.pill, { backgroundColor: m.bg }]}>
      <Text style={[styles.text, { color: m.fg }]}>{label || m.label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  text: { fontSize: 11, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
});
