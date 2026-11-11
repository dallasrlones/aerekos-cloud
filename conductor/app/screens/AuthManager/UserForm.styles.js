import { StyleSheet, Platform } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';

export const UserFormStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
  },
  title: { ...typography.h2 },
  subtitle: { ...typography.caption, marginTop: 2, marginBottom: spacing.md },
  field: { marginBottom: spacing.md },
  label: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: 12,
    fontSize: 16,
    color: colors.textPrimary,
    ...(Platform.OS === 'web' && {
      outlineStyle: 'none',
      outlineWidth: 0,
      cursor: 'text',
      WebkitUserSelect: 'text',
      userSelect: 'text',
    }),
  },
  inputDisabled: { opacity: 0.6 },
  inputError: { borderColor: colors.error },
  errorText: { color: colors.error, fontSize: 12, marginTop: 4 },
  help: { ...typography.caption, fontSize: 12, marginTop: 4 },
  rowToggle: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  buttons: { marginTop: spacing.lg, gap: 12 },
  cancel: { marginTop: 0 },
});
