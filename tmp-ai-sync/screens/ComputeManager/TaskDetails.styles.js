import { StyleSheet } from 'react-native';
import { colors, spacing, typography, borderRadius, animus } from '../../styles/theme';

export const TaskDetailsStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    ...typography.h2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: borderRadius.full,
    marginRight: 6,
  },
  statusText: {
    fontSize: 13,
    textTransform: 'capitalize',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionButton: {
    minWidth: 100,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  infoLabel: {
    ...typography.caption,
    flexShrink: 0,
    marginRight: spacing.md,
  },
  infoValue: {
    ...typography.body,
    fontSize: 14,
    fontFamily: animus.mono,
    flexShrink: 1,
    textAlign: 'right',
  },
  errorBox: {
    borderColor: colors.error,
    borderWidth: 1,
  },
  errorText: {
    ...typography.bodySecondary,
    color: colors.error,
  },
});
