import { StyleSheet } from 'react-native';
import { colors, spacing } from '../../styles/theme';

export const IntegrationHubStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: colors.textMuted, marginBottom: spacing.md },
  error: { color: '#c62828', fontSize: 13 },
  hint: { color: colors.textMuted, fontSize: 13 },
  field: { marginBottom: spacing.sm },
  label: { color: colors.textMuted, fontSize: 12, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    padding: 10,
    color: colors.text,
    fontSize: 14,
  },
  row: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowName: { color: colors.text, fontWeight: '600', fontSize: 14 },
  rowSub: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
});
