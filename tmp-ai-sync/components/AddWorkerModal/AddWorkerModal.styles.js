import { StyleSheet } from 'react-native';
import { spacing, colors, borderRadius } from '../../styles/theme';

export const AddWorkerModalStyles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  searchInput: {
    marginBottom: spacing.sm,
  },
  selectedContainer: {
    backgroundColor: colors.accent + '20',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  selectedText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textSecondary,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  workersList: {
    maxHeight: 400,
    gap: spacing.sm,
  },
  workerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  workerItemSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + '10',
  },
  workerItemContent: {
    flex: 1,
  },
  workerHostname: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  workerIP: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  workerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotOnline: {
    backgroundColor: colors.success,
  },
  statusDotOffline: {
    backgroundColor: colors.error,
  },
  statusText: {
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'capitalize',
  },
  errorContainer: {
    backgroundColor: colors.error + '20',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.error,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  button: {
    flex: 1,
  },
});
