import { StyleSheet } from 'react-native';
import { colors, spacing, typography, borderRadius, animus } from '../../styles/theme';

export const ManagerConsoleStyles = StyleSheet.create({
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
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  breadcrumbText: {
    ...typography.caption,
    marginLeft: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  titleTextWrap: {
    flex: 1,
  },
  title: {
    ...typography.h2,
  },
  subtitle: {
    ...typography.caption,
    marginTop: 2,
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
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.sm,
  },
  metricItem: {
    minWidth: 120,
    margin: spacing.sm,
  },
  metricValue: {
    ...typography.h2,
    fontSize: 22,
  },
  metricLabel: {
    ...typography.caption,
    textTransform: 'capitalize',
  },
  codeBlock: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
  },
  codeLine: {
    fontFamily: animus.mono,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
