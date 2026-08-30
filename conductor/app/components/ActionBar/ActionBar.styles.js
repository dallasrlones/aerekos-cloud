import { StyleSheet } from 'react-native';
import { spacing } from '../../styles/theme';

export const ActionBarStyles = StyleSheet.create({
  scroll: { marginBottom: spacing.md, flexGrow: 0 },
  row: { flexDirection: 'row', gap: spacing.sm, paddingVertical: 2 },
  btn: { minHeight: 40, paddingVertical: 8, paddingHorizontal: 16 },
});
