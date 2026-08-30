import { StyleSheet, Platform } from 'react-native';
import { colors, shadows } from '../../styles/theme';

export const ProjectCardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFEBEE',
    borderRadius: 4,
  },
  deleteButtonText: {
    color: '#F44336',
    fontSize: 12,
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  details: {
    marginTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  label: {
    fontSize: 14,
    color: colors.textSecondary,
    marginRight: 8,
    width: 80,
  },
  value: {
    fontSize: 14,
    color: colors.textPrimary,
    flex: 1,
  },
});
