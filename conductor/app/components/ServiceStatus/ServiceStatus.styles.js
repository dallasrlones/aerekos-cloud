import { StyleSheet } from 'react-native';
import { colors } from '../../styles/theme';

export const ServiceStatusStyles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  refreshButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.accent,
    borderRadius: 4,
  },
  refreshText: {
    color: colors.background,
    fontSize: 12,
    fontWeight: '600',
  },
  lastChecked: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
});
