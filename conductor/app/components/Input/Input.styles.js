import { StyleSheet, Platform } from 'react-native';
import { colors, spacing, borderRadius } from '../../styles/theme';

export const InputStyles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.textMuted,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 0,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
    minHeight: 48,
    fontWeight: '300',
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  labelInverted: {
    color: '#FFFFFF',
  },
  inputInverted: {
    backgroundColor: '#1A1A1A',
    borderColor: '#4A4A4A',
    color: '#FFFFFF',
    ...(Platform.OS === 'web' && {
      transition: 'background-color 0.2s ease-out, border-color 0.2s ease-out, color 0.2s ease-out',
    }),
  },
  errorTextInverted: {
    color: '#FF6B6B',
  },
});
