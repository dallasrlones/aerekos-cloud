import { StyleSheet } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';

export const ComputeManagerStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    ...typography.h2,
  },
  subtitle: {
    ...typography.caption,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  errorBox: {
    borderColor: colors.error,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.bodySecondary,
    color: colors.error,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  infoLabel: {
    ...typography.caption,
  },
  infoValue: {
    ...typography.body,
    fontSize: 14,
  },
  hintText: {
    ...typography.bodySecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  tasksHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  runButton: {
    minWidth: 110,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    ...typography.caption,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  taskMain: {
    flex: 1,
  },
  taskTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  taskName: {
    ...typography.body,
    fontWeight: '400',
    flexShrink: 1,
    marginRight: spacing.sm,
  },
  taskSub: {
    ...typography.caption,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: borderRadius.full,
    marginRight: 5,
  },
  statusText: {
    fontSize: 12,
    textTransform: 'capitalize',
  },
});
