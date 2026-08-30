import { StyleSheet } from 'react-native';
import { colors } from '../../styles/theme';

export const DevicesStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  emptyText: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
  deviceCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  deviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  deviceIp: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  deviceDetails: {
    marginTop: 8,
  },
  resourceText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  lastSeenText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});

