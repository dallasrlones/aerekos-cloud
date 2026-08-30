import { StyleSheet, Platform } from 'react-native';
import { colors, spacing, shadows, borderRadius } from '../../styles/theme';

export const ProjectSwitcherStyles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    minWidth: 80,
    maxWidth: '100%',
    flex: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  projectName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginRight: spacing.xs,
    flex: 1,
  },
  chevron: {
    marginLeft: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    paddingTop: Platform.select({
      ios: 100,
      android: 80,
      web: 60,
    }),
    paddingHorizontal: spacing.md,
  },
  dropdown: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: 400,
    ...shadows.large,
  },
  scrollView: {
    maxHeight: 400,
  },
  emptyState: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  projectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  projectItemActive: {
    backgroundColor: colors.surfaceHover,
  },
  projectItemText: {
    fontSize: 14,
    color: colors.textPrimary,
    flex: 1,
  },
  projectItemTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    marginTop: spacing.xs,
  },
  createIcon: {
    marginRight: spacing.sm,
  },
  createText: {
    fontSize: 14,
    color: colors.accent,
    fontWeight: '600',
  },
});
