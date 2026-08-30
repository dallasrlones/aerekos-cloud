import { StyleSheet } from 'react-native';
import { spacing, colors } from '../../styles/theme';

export const ServiceConfigModalStyles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  textArea: {
    minHeight: 200,
    textAlignVertical: 'top',
  },
  errorContainer: {
    backgroundColor: colors.error + '20',
    padding: spacing.sm,
    borderRadius: 4,
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
