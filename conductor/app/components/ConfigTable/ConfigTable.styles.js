import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../styles/theme';

export const ConfigTableStyles = StyleSheet.create({
  note: { ...typography.caption, marginBottom: spacing.sm, fontStyle: 'italic' },
  row: {
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  key: { ...typography.caption, fontWeight: '700', fontFamily: 'monospace' },
  desc: { ...typography.caption, marginTop: 2 },
  value: { ...typography.body, marginTop: 4, color: colors.primary },
  unset: { ...typography.caption, marginTop: 4, color: colors.textMuted },
});
