import { StyleSheet } from 'react-native';
import { colors, spacing, typography, shadows } from '../../styles/theme';

export const SettingsStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  titleSection: {
    marginBottom: spacing.xl,
    paddingTop: spacing.md,
  },
  titleText: {
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '300',
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: 0,
    padding: spacing.lg,
    ...shadows.small,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  cardTitle: {
    ...typography.h3,
    marginBottom: spacing.lg,
    color: colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontWeight: '300',
  },
  form: {
    width: '100%',
  },
  input: {
    marginBottom: spacing.md,
  },
  messageContainer: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 4,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  successContainer: {
    borderColor: colors.success,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    ...typography.body,
  },
  successText: {
    color: colors.success,
    fontSize: 14,
    ...typography.body,
  },
  submitButton: {
    marginTop: spacing.sm,
  },
});

