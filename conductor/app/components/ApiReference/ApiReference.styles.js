import { StyleSheet, Platform } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';

export const ApiReferenceStyles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  headerTitle: { ...typography.body, fontWeight: '600', flex: 1 },
  block: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: 4 },
  method: { fontWeight: '700', fontSize: 11, width: 48 },
  path: { ...typography.caption, flex: 1, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined },
  desc: { ...typography.caption, marginBottom: spacing.xs },
  codeWrap: { position: 'relative' },
  code: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.textSecondary,
    backgroundColor: colors.background,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  copyBtn: { position: 'absolute', top: 6, right: 6, padding: 4 },
});
