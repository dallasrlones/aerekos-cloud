import { StyleSheet } from 'react-native';
import { colors, spacing } from '../../styles/theme';

export const ServiceSetupWizardStyles = StyleSheet.create({
  summary: { color: colors.text, fontSize: 14, marginBottom: spacing.sm },
  hint: { color: colors.textMuted, fontSize: 13, marginBottom: 6 },
  error: { color: '#c62828', fontSize: 13, marginTop: 8 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  progressLabel: { color: colors.textMuted, fontSize: 12 },
  progressPct: { color: colors.primary, fontWeight: '600', fontSize: 12 },
  progressBar: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.primary },
  depRow: { marginBottom: 6 },
  depText: { color: colors.text, fontSize: 13 },
});
