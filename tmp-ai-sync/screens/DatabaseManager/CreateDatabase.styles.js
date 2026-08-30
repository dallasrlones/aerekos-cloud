import { StyleSheet, Platform } from 'react-native';
import { colors } from '../../styles/theme';

export const CreateDatabaseStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 24,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.textPrimary,
    ...(Platform.OS === 'web' && {
      outline: 'none',
      cursor: 'text',
      pointerEvents: 'auto',
      WebkitUserSelect: 'text',
      userSelect: 'text',
    }),
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
    marginTop: 4,
  },
  typeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    minWidth: 100,
  },
  buttonContainer: {
    marginTop: 24,
    gap: 12,
  },
  cancelButton: {
    marginTop: 0,
  },
});

