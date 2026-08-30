import { StyleSheet } from 'react-native';
import { spacing, colors } from '../../styles/theme';

export const ScalingPolicyModalStyles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  section: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  errorContainer: {
    backgroundColor: colors.error + '20',
    padding: spacing.sm,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.error,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  button: {
    flex: 1,
  },
});
