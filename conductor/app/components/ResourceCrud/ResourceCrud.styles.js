import { StyleSheet } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';

export const ResourceCrudStyles = StyleSheet.create({
  field: { marginBottom: spacing.sm },
  label: { color: colors.textMuted, fontSize: 12, marginBottom: 4, textTransform: 'capitalize' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    padding: 10,
    color: colors.textPrimary,
    fontSize: 14,
  },
  hint: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.sm },
  error: { color: colors.error, fontSize: 13, marginBottom: spacing.sm },
  row: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowBody: { flex: 1 },
  rowName: { color: colors.textPrimary, fontWeight: '600', fontSize: 14 },
  rowSub: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  rowActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  link: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  danger: { color: '#8B0000', fontSize: 13, fontWeight: '600' },
});
