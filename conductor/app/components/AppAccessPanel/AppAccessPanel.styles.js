import { StyleSheet, Platform } from 'react-native';
import { colors, spacing } from '../../styles/theme';

export const AppAccessPanelStyles = StyleSheet.create({
  hint: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    padding: 10,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.sm,
  },
  chip: {
    marginRight: 4,
    marginBottom: 4,
  },
  mono: {
    fontFamily: Platform?.OS === 'web' ? 'monospace' : undefined,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowMain: { flex: 1, paddingRight: 8 },
  rowName: { color: colors.text, fontWeight: '600', fontSize: 14 },
  rowSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  urlBlock: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
