import { StyleSheet, Platform } from 'react-native';
import { colors, spacing, borderRadius, shadows } from '../../styles/theme';

export const ButtonStyles = StyleSheet.create({
  container: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    ...shadows.small,
  },
  primary: {
    backgroundColor: colors.textPrimary,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: {
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  primaryText: {
    color: colors.background,
  },
  secondaryText: {
    color: colors.textPrimary,
  },
  disabled: {
    opacity: 0.5,
  },
  primaryInverted: {
    backgroundColor: '#FFFFFF',
    ...(Platform.OS === 'web' && {
      transition: 'background-color 0.2s ease-out',
    }),
  },
  secondaryInverted: {
    backgroundColor: 'transparent',
    borderColor: '#FFFFFF',
    ...(Platform.OS === 'web' && {
      transition: 'border-color 0.2s ease-out',
    }),
  },
  primaryTextInverted: {
    color: '#000000',
  },
  secondaryTextInverted: {
    color: '#FFFFFF',
  },
});
