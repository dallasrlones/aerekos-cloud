import { StyleSheet } from 'react-native';
import { colors, spacing, typography, borderRadius, shadows } from '../../styles/theme';

export const DashboardStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  welcomeSection: {
    marginBottom: spacing.xl,
    paddingTop: spacing.md,
  },
  welcomeText: {
    ...typography.bodySecondary,
    fontSize: 12,
    marginBottom: spacing.xs,
    fontWeight: '300',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  usernameText: {
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '300',
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: 0,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.small,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  cardTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
    color: colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontWeight: '300',
  },
  healthStatus: {
    marginTop: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
  },
  statusLabel: {
    ...typography.bodySecondary,
    fontSize: 12,
    fontWeight: '300',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statusValue: {
    ...typography.body,
    fontWeight: '300',
  },
  statusHealthy: {
    color: colors.textPrimary,
  },
  statusUnhealthy: {
    color: colors.textMuted,
  },
  loadingText: {
    ...typography.bodySecondary,
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyStateText: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  emptyStateSubtext: {
    ...typography.caption,
    textAlign: 'center',
    color: colors.textMuted,
  },
});
