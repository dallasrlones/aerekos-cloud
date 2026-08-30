import { StyleSheet } from 'react-native';
import { colors } from '../../styles/theme';

export const CoreStackWizardStyles = StyleSheet.create({
  hint: { fontSize: 13, color: colors.textMuted, marginBottom: 10, lineHeight: 20 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  progressLabel: { fontSize: 12, color: colors.textMuted },
  progressPct: { fontSize: 12, fontWeight: '600', color: colors.text },
  progressBar: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: { height: '100%', backgroundColor: colors.primary },
  stepRow: { fontSize: 13, color: colors.text, marginBottom: 4 },
  error: { fontSize: 13, color: colors.error, marginVertical: 8 },
  done: { fontSize: 13, color: colors.success || '#2e7d32', marginVertical: 8 },
});
