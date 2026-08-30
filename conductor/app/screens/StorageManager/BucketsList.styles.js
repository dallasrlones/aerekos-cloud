import { StyleSheet, Platform } from 'react-native';
import { colors, typography } from '../../styles/theme';

export const BucketsListStyles = StyleSheet.create({
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
    backgroundColor: '#fff',
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
    ...typography.h2,
    flex: 1,
    textAlign: 'center',
  },
  createButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  projectInfo: {
    margin: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  projectLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginRight: 8,
    fontWeight: '600',
  },
  projectName: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  searchContainer: {
    padding: 16,
    paddingTop: 0,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: colors.text,
  },
  errorBox: {
    margin: 16,
    marginTop: 0,
    backgroundColor: '#FFEBEE',
    borderColor: '#F44336',
  },
  errorText: {
    color: '#F44336',
    fontSize: 14,
    padding: 12,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
  },
  emptyButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  bucketCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bucketCardContent: {
    flex: 1,
  },
  bucketName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  bucketMetadata: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  bucketDate: {
    fontSize: 12,
    color: colors.textMuted,
  },
  deleteButton: {
    backgroundColor: '#F44336',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 12,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 12,
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
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    ...(Platform.OS === 'web' && {
      zIndex: 1001,
      position: 'relative',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    }),
  },
  modalTitle: {
    ...typography.h3,
    marginBottom: 16,
  },
  modalMessage: {
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  modalWarning: {
    fontSize: 14,
    color: '#dc3545',
    marginBottom: 24,
    fontWeight: '500',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: colors.text,
    marginBottom: 8,
  },
  modalHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 16,
    lineHeight: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: colors.textSecondary,
  },
  modalButtonCreate: {
    backgroundColor: colors.accent,
  },
  modalButtonDelete: {
    backgroundColor: '#dc3545',
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalButtonDeleteText: {
    color: '#fff',
  },
});
