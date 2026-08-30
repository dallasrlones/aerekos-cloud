import { StyleSheet, Platform } from 'react-native';
import { colors, typography } from '../../styles/theme';

export const KeysListStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.accent,
    fontWeight: '600',
  },
  title: {
    ...typography.h3,
    flex: 1,
    textAlign: 'center',
  },
  createButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  filters: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInput: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  filterButtonText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  loadingText: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: 32,
  },
  errorText: {
    textAlign: 'center',
    color: '#F44336',
    marginTop: 32,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 64,
  },
  emptyStateText: {
    fontSize: 18,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  emptyStateButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' && {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1000,
    }),
  },
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 24,
    width: Platform.OS === 'web' ? '40%' : '90%',
    maxWidth: 500,
    ...(Platform.OS === 'web' && {
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    }),
  },
  modalTitle: {
    ...typography.h3,
    marginBottom: 16,
    color: colors.textPrimary,
  },
  modalMessage: {
    ...typography.body,
    marginBottom: 8,
    color: colors.textPrimary,
  },
  modalWarning: {
    ...typography.bodySecondary,
    marginBottom: 24,
    color: colors.error,
    fontWeight: '500',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalButtonDelete: {
    backgroundColor: colors.error,
  },
  modalButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  modalButtonDeleteText: {
    color: '#fff',
  },
});
