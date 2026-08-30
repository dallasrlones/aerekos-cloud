import { StyleSheet } from 'react-native';
import { colors, typography } from '../../styles/theme';

export const ServiceSecretsListStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: { padding: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  backButton: { padding: 8 },
  backButtonText: { fontSize: 16, color: colors.accent, fontWeight: '600' },
  title: { ...typography.h2, flex: 1, textAlign: 'center' },
  helpText: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 16,
    lineHeight: 20
  },
  row: {
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10
  },
  rowName: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  rowMeta: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  createBtn: {
    backgroundColor: colors.accent,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8
  },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  errorText: { color: '#F44336', marginBottom: 8 },
  loadingText: { color: colors.textMuted }
});
