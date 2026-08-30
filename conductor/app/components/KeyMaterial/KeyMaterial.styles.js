import { StyleSheet } from 'react-native';
import { colors } from '../../styles/theme';

export const KeyMaterialStyles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  eyeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.accent,
    borderRadius: 4,
  },
  eyeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  copyButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#2196F3',
    borderRadius: 4,
  },
  copyText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  materialContainer: {
    backgroundColor: colors.background,
    borderRadius: 4,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 60,
  },
  materialText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: colors.textPrimary,
    textAlign: 'left',
  },
  warning: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#FF9800',
    borderRadius: 4,
  },
  warningText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
});
