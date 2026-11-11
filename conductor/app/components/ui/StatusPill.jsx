import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

export const StatusPill = ({ status, label }) => {
  const { colors, borderRadius, spacing } = useTheme();
  const key = String(status || '').toLowerCase();

  const map = {
    enabled: { bg: 'rgba(46,125,50,0.18)', fg: colors.success, label: 'Enabled' },
    online: { bg: 'rgba(46,125,50,0.18)', fg: colors.success, label: 'Online' },
    healthy: { bg: 'rgba(46,125,50,0.18)', fg: colors.success, label: 'Healthy' },
    success: { bg: 'rgba(46,125,50,0.18)', fg: colors.success, label: 'Ok' },
    disabled: { bg: colors.surface, fg: colors.textMuted, label: 'Off' },
    offline: { bg: colors.surface, fg: colors.textMuted, label: 'Offline' },
    error: { bg: 'rgba(198,40,40,0.18)', fg: colors.error, label: 'Error' },
    warning: { bg: 'rgba(233,168,37,0.2)', fg: colors.warning, label: 'Warning' },
    pending: { bg: 'rgba(233,168,37,0.2)', fg: colors.warning, label: 'Pending' },
  };

  const m = map[key] || { bg: colors.surface, fg: colors.textMuted, label: status || '—' };

  return (
    <View style={{
      borderRadius: borderRadius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      backgroundColor: m.bg,
    }}
    >
      <Text style={{
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        color: m.fg,
      }}
      >
        {label || m.label}
      </Text>
    </View>
  );
};
