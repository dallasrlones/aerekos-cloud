import { StyleSheet } from 'react-native';
import { colors } from '../../styles/theme';

export const DeviceDetailsStyles = StyleSheet.create({
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  coreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  coreLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    width: 60,
  },
  coreValue: {
    fontSize: 12,
    color: colors.textPrimary,
    marginLeft: 8,
    width: 40,
    textAlign: 'right',
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 6,
    fontWeight: '500',
  },
  value: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 4,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});

