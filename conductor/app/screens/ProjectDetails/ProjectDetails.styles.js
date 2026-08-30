import { StyleSheet } from 'react-native';
import { colors, spacing, typography, borderRadius, shadows } from '../../styles/theme';

export const ProjectDetailsStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.bodySecondary,
    marginTop: spacing.md,
    color: colors.textMuted,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorText: {
    ...typography.h3,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  backButton: {
    padding: spacing.sm,
    marginRight: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    flex: 1,
    fontWeight: '300',
  },
  headerActions: {
    flexDirection: 'row',
  },
  iconButton: {
    padding: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  infoLabel: {
    ...typography.bodySecondary,
    color: colors.textMuted,
    fontWeight: '400',
  },
  infoValue: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusBadgeEnabled: {
    backgroundColor: colors.success + '20',
  },
  statusBadgeDisabled: {
    backgroundColor: colors.error + '20',
  },
  statusText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  actionButton: {
    marginBottom: spacing.md,
  },
  addButton: {
    marginBottom: spacing.md,
  },
  deleteButton: {
    backgroundColor: colors.error + '20',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    ...typography.body,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  listItemSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
  },
  orphanedBadge: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
    fontWeight: '600',
  },
  emptyText: {
    ...typography.bodySecondary,
    color: colors.textMuted,
    fontStyle: 'italic',
    paddingVertical: spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  actionButtonText: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textSecondary,
  },
});
