import { StyleSheet } from 'react-native';
import { colors, typography } from '../../styles/theme';

export const StorageManagerStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
  },
  title: {
    ...typography.h2,
    marginBottom: 24,
  },
  errorBox: {
    backgroundColor: '#FFEBEE',
    borderColor: '#F44336',
    marginBottom: 16,
  },
  errorText: {
    color: '#F44336',
    fontSize: 14,
  },
  infoRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginRight: 8,
  },
  infoValue: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  metricItem: {
    alignItems: 'center',
    width: '45%',
    marginBottom: 16,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
  },
  navButton: {
    backgroundColor: colors.accent,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  navButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  configRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  configLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    flex: 1,
  },
  configValue: {
    fontSize: 14,
    color: colors.text,
    flex: 2,
    textAlign: 'right',
  },
  configNote: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 12,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  pathInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 2,
    gap: 8,
  },
  pathInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    padding: 8,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.background,
  },
  pathDisplayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 2,
    justifyContent: 'flex-end',
    gap: 8,
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.accent,
    borderRadius: 4,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  saveButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.textSecondary,
    borderRadius: 4,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  noProjectContainer: {
    padding: 16,
    alignItems: 'center',
  },
  noProjectText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  navButtonSubtext: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    opacity: 0.9,
  },
});
