import { StyleSheet } from 'react-native';
import { colors, spacing, typography, borderRadius, shadows } from '../../styles/theme';

export const ProjectsStyles = StyleSheet.create({
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '300',
  },
  projectCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.small,
  },
  projectCardActive: {
    borderColor: colors.accent,
    borderWidth: 2,
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  projectInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  projectName: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    fontWeight: '400',
  },
  currentBadge: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
  },
  projectDescription: {
    ...typography.bodySecondary,
    color: colors.textMuted,
    fontSize: 14,
  },
  projectStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: '400',
    marginBottom: spacing.xs,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  createButton: {
    minWidth: 200,
  },
});
