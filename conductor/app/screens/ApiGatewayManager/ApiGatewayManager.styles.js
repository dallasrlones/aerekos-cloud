import { StyleSheet, Platform } from 'react-native';
import { colors, spacing } from '../../styles/theme';

export const ApiGatewayManagerStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 4 },
  subtitle: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.md },
  hint: { fontSize: 13, color: colors.textMuted, marginBottom: 8, lineHeight: 18 },
  mono: {
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    fontSize: 12,
    color: colors.textSecondary,
  },
  errorBox: { marginBottom: spacing.sm },
  errorText: { color: colors.error || '#f44336' },
  routeRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  routeName: { fontWeight: '600', color: colors.text, fontSize: 14 },
  routePath: { fontSize: 12, color: colors.primary, marginTop: 2 },
  routeTarget: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  routeUrl: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  label: { fontSize: 12, color: colors.textMuted, marginBottom: 4, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
    color: colors.textPrimary || colors.text,
    marginBottom: 8,
  },
});
