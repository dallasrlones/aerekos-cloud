import { StyleSheet, Platform } from 'react-native';
import { colors, spacing } from '../../styles/theme';

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
  serverBox: {
    marginBottom: spacing.lg,
    paddingBottom: spacing.xl,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginHorizontal: -spacing.xs / 2,
  },
  detailCard: {
    flex: 1,
    minWidth: '48%',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: spacing.xs / 2,
    marginBottom: spacing.sm,
  },
  detailLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '400',
  },
  deviceId: {
    fontSize: 11,
    fontFamily: Platform.OS === 'web' ? 'monospace' : 'monospace',
    color: colors.textMuted,
  },
});

