import { StyleSheet } from 'react-native';
import { colors, typography } from '../../styles/theme';

export const ProjectsListStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.accent,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  searchInput: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.textPrimary,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  loadingText: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: 32,
    fontSize: 16,
  },
  errorText: {
    textAlign: 'center',
    color: '#F44336',
    marginTop: 32,
    fontSize: 16,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 64,
  },
  emptyStateText: {
    fontSize: 18,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  emptyStateButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
