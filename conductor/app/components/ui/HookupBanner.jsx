import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';

export const HookupBanner = ({
  title,
  body,
  actionLabel = 'Hook up',
  onPress,
}) => {
  const { colors, spacing, borderRadius, typography } = useTheme();

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.md,
      backgroundColor: 'rgba(233,168,37,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(233,168,37,0.45)',
      borderRadius: borderRadius.lg,
      marginBottom: spacing.md,
    }}
    >
      <Ionicons name="alert-circle-outline" size={22} color={colors.warning} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ ...typography.body, fontWeight: '600', fontSize: 15, color: colors.textPrimary }}>
          {title}
        </Text>
        {body ? (
          <Text style={{ ...typography.caption, marginTop: 2, color: colors.textSecondary }}>
            {body}
          </Text>
        ) : null}
      </View>
      {onPress ? (
        <TouchableOpacity
          style={{
            backgroundColor: colors.accent,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: borderRadius.md,
            minHeight: 44,
            justifyContent: 'center',
          }}
          onPress={onPress}
          activeOpacity={0.8}
        >
          <Text style={{ color: colors.onAccent, fontWeight: '600', fontSize: 14 }}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};
