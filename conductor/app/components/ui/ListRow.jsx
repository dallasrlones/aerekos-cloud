import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { StatusPill } from './StatusPill';

export const ListRow = ({
  icon = 'cube-outline',
  title,
  subtitle,
  status,
  onPress,
  right,
}) => {
  const { colors, spacing, typography, borderRadius } = useTheme();

  return (
    <TouchableOpacity
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.divider,
        minHeight: 56,
      }}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={{
        width: 36,
        height: 36,
        borderRadius: borderRadius.md,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      >
        <Ionicons name={icon} size={20} color={colors.textPrimary} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ ...typography.body, fontWeight: '500', fontSize: 16, color: colors.textPrimary }} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ ...typography.caption, marginTop: 2, color: colors.textSecondary }} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {status ? <StatusPill status={status} /> : null}
      {right}
      {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} /> : null}
    </TouchableOpacity>
  );
};
