import { StyleSheet } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';

export const AuthManagerStyles = StyleSheet.create({
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
  title: { ...typography.h2 },
  subtitle: { ...typography.caption, marginTop: 2, marginBottom: spacing.md },
  errorBox: { borderColor: colors.error, borderWidth: 1, marginBottom: spacing.md },
  errorText: { ...typography.bodySecondary, color: colors.error },
  hintText: { ...typography.bodySecondary, fontSize: 14, lineHeight: 20 },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  addButton: { minWidth: 130 },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyText: { ...typography.caption, marginTop: spacing.sm, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  rowMain: { flex: 1 },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: spacing.sm,
  },
  rowName: { ...typography.body, fontWeight: '400' },
  rowSub: { ...typography.caption, marginTop: 2 },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
  },
});
