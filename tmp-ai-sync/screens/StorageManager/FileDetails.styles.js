import { StyleSheet, Platform } from 'react-native';
import { colors } from '../../styles/theme';

export const FileDetailsStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '500',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    flex: 1,
    marginLeft: 16,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
  errorBox: {
    margin: 16,
    padding: 16,
    backgroundColor: '#fee',
    borderColor: '#fcc',
    borderWidth: 1,
    borderRadius: 8,
  },
  errorText: {
    color: '#c33',
    fontSize: 14,
  },
  fileHeader: {
    alignItems: 'center',
    padding: 32,
    marginBottom: 16,
  },
  fileIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  fileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  filePath: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  metadataBox: {
    marginBottom: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  metadataLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
    flex: 1,
  },
  metadataValue: {
    fontSize: 14,
    color: colors.textPrimary,
    flex: 2,
    textAlign: 'right',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewButton: {
    backgroundColor: '#17a2b8',
  },
  downloadButton: {
    backgroundColor: colors.primary,
  },
  deleteButton: {
    backgroundColor: '#dc3545',
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    padding: 16,
    backgroundColor: '#e3f2fd',
    borderColor: '#90caf9',
    borderWidth: 1,
    borderRadius: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#1976d2',
    lineHeight: 20,
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
    width: '90%',
    maxWidth: 500,
    ...(Platform.OS === 'web' && {
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    }),
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
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
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: colors.border,
  },
  modalButtonDelete: {
    backgroundColor: '#dc3545',
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  modalButtonDeleteText: {
    color: '#fff',
  },
  previewModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' && {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 2000,
    }),
  },
  previewModalContent: {
    width: '95%',
    height: '95%',
    backgroundColor: '#000',
    borderRadius: 8,
    ...(Platform.OS === 'web' && {
      position: 'relative',
      zIndex: 2001,
      display: 'flex',
      flexDirection: 'column',
    }),
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
    marginRight: 16,
  },
  previewCloseButton: {
    padding: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  previewCloseButtonText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
  },
  previewImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    maxWidth: '100%',
    maxHeight: '100%',
  },
});

