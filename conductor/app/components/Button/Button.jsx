import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, Platform } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

export const Button = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  textStyle,
  inverted = false,
}) => {
  const { colors, animus, spacing, borderRadius, shadows } = useTheme();
  const isPrimary = variant === 'primary';

  const container = {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    ...shadows.small,
    ...(Platform.OS === 'web' ? { transition: 'transform 0.12s ease, opacity 0.12s ease, background-color 0.15s ease' } : {}),
  };

  let bg = isPrimary ? animus.gold : 'transparent';
  let borderW = isPrimary ? 0 : 1;
  let borderC = colors.border;
  let fg = isPrimary ? (colors.onAccent || '#10131A') : colors.textPrimary;

  if (inverted) {
    bg = isPrimary ? '#FFFFFF' : 'transparent';
    borderC = '#FFFFFF';
    fg = isPrimary ? '#000000' : '#FFFFFF';
  }

  return (
    <TouchableOpacity
      style={[
        container,
        {
          backgroundColor: bg,
          borderWidth: borderW,
          borderColor: borderC,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <Text style={[{
          fontSize: 14,
          fontWeight: '600',
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          color: fg,
        }, textStyle]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

export default Button;
