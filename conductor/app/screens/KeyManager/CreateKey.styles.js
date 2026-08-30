import { StyleSheet } from 'react-native';
import { colors, typography } from '../../styles/theme';

export const CreateKeyStyles = StyleSheet.create({
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
  form: {
    gap: 16,
  },
  field: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  typeButtonText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  algorithmButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  algorithmButton: {
    flex: 1,
    minWidth: '45%',
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  algorithmButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  algorithmButtonText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  algorithmButtonTextActive: {
    color: '#fff',
  },
  metadataInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 12,
    color: '#F44336',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: colors.accent,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
