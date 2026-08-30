import { StyleSheet } from 'react-native';
import { colors } from '../../styles/theme';

export const ServiceToggleStyles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    padding: 2,
    justifyContent: 'center',
    marginRight: 12,
  },
  toggleEnabled: {
    backgroundColor: '#4CAF50',
  },
  toggleDisabled: {
    backgroundColor: '#666',
  },
  toggleLoading: {
    opacity: 0.6,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  toggleThumbEnabled: {
    alignSelf: 'flex-end',
  },
  toggleThumbDisabled: {
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  confirmContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confirmText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginRight: 8,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
  },
  disableButton: {
    backgroundColor: '#F44336',
  },
  cancelButton: {
    backgroundColor: colors.accent,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
