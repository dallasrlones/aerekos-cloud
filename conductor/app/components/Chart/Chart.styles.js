import { StyleSheet } from 'react-native';
import { colors } from '../../styles/theme';

export const ChartStyles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  chartContainer: {
    width: '100%',
    backgroundColor: colors.cardBackground,
    borderRadius: 8,
    padding: 12,
  },
  noData: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 20,
    fontSize: 14,
  },
  notSupported: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 20,
    fontSize: 14,
  },
});

