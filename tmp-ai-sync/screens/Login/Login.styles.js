import { StyleSheet, Platform } from 'react-native';
import { colors, spacing, typography } from '../../styles/theme';

export const LoginStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    letterSpacing: 3,
    fontWeight: '300',
  },
  subtitle: {
    ...typography.bodySecondary,
    fontSize: 18,
    letterSpacing: 1,
  },
  form: {
    width: '100%',
  },
  errorContainer: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 4,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
  },
  errorContainerInverted: {
    backgroundColor: '#1A1A1A',
    borderColor: '#4A4A4A',
  },
  errorTextInverted: {
    color: '#FF6B6B',
  },
  loginButton: {
    marginTop: spacing.md,
  },
});
