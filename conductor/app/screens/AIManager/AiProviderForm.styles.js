import { StyleSheet } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';

export const AiProviderFormStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
  },
  center: { justifyContent: 'center', alignItems: 'center' },
  title: { ...typography.h2 },
  subtitle: { ...typography.caption, marginTop: 2, marginBottom: spacing.md },
  field: { marginBottom: spacing.md },
  label: { ...typography.caption, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    ...typography.body,
  },
  inputError: { borderColor: colors.error },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  errorText: { ...typography.caption, color: colors.error, marginTop: 4 },
  help: { ...typography.caption, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { marginBottom: spacing.xs },
  buttons: { marginTop: spacing.md, gap: spacing.sm },
  cancel: { marginTop: spacing.xs },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
});
