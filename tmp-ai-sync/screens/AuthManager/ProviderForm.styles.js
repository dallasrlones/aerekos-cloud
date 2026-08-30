import { StyleSheet, Platform } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';

export const ProviderFormStyles = StyleSheet.create({
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
      outline: 'none',
      cursor: 'text',
      WebkitUserSelect: 'text',
      userSelect: 'text',
    }),
  },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  inputError: { borderColor: colors.error },
  errorText: { color: colors.error, fontSize: 12, marginTop: 4 },
  help: { ...typography.caption, fontSize: 12, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minWidth: 84 },
  buttons: { marginTop: spacing.lg, gap: 12 },
  cancel: { marginTop: 0 },
});
