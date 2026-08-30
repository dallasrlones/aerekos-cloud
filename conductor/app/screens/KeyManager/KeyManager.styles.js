import { StyleSheet } from 'react-native';
import { colors, typography } from '../../styles/theme';

export const KeyManagerStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
  },
  title: {
    ...typography.h2,
    marginBottom: 24,
  },
  errorBox: {
    backgroundColor: '#FFEBEE',
    borderColor: '#F44336',
    marginBottom: 16,
  },
  errorText: {
    color: '#F44336',
    fontSize: 14,
  },
  errorTextSmall: {
    color: '#F44336',
    fontSize: 13,
    marginBottom: 8,
  },
  hintText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 8,
    lineHeight: 18,
  },
  infoRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginRight: 8,
  },
  infoValue: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  navButton: {
    backgroundColor: colors.accent,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  navButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
