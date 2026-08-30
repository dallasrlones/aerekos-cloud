import { StyleSheet, Platform } from 'react-native';
import { colors, typography } from '../../styles/theme';

export const KeyDetailsStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
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
  loadingText: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: 64,
    fontSize: 16,
  },
  errorText: {
    textAlign: 'center',
    color: '#F44336',
    marginTop: 64,
    fontSize: 16,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  label: {
    fontSize: 14,
    color: colors.textSecondary,
    width: 120,
    fontWeight: '600',
  },
  value: {
    fontSize: 14,
    color: colors.textPrimary,
    flex: 1,
  },
  statusActive: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  statusArchived: {
    color: '#666',
    fontWeight: '600',
  },
  metadataContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: 4,
  },
  metadataText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: colors.textPrimary,
    marginTop: 8,
  },
  versionItem: {
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: 4,
    marginBottom: 8,
  },
  versionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  versionText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  versionStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  versionDate: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  actions: {
    gap: 12,
  },
  actionButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  rotateButton: {
    backgroundColor: colors.accent,
  },
  replaceButton: {
    backgroundColor: '#2196F3',
  },
  archiveButton: {
    backgroundColor: '#FF9800',
  },
  deleteButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  bucketItem: {
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: 4,
    marginBottom: 8,
  },
  bucketName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  bucketProject: {
    fontSize: 12,
    color: colors.textSecondary,
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
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    width: Platform.OS === 'web' ? '40%' : '90%',
    maxWidth: 500,
    maxHeight: '80%',
    ...(Platform.OS === 'web' && {
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    }),
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  modalMessage: {
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 8,
    lineHeight: 20,
  },
  modalWarning: {
    fontSize: 14,
    color: colors.error,
    marginBottom: 24,
    fontWeight: '500',
  },
  keysList: {
    maxHeight: 300,
    marginBottom: 20,
  },
  keyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  keyOptionDisabled: {
    opacity: 0.5,
  },
  keyOptionContent: {
    flex: 1,
  },
  keyOptionName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  keyOptionType: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  keyOptionArrow: {
    fontSize: 20,
    color: colors.primary,
    marginLeft: 12,
  },
  noKeysText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    padding: 20,
    fontStyle: 'italic',
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
  },
  modalButtonCancel: {
    backgroundColor: colors.border,
  },
  modalButtonDelete: {
    backgroundColor: colors.error,
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  modalButtonDeleteText: {
    color: '#fff',
  },
});
