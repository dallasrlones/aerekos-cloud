import { StyleSheet, Platform } from 'react-native';
import { colors, spacing, shadows, borderRadius } from '../../styles/theme';

export const HeaderStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    ...shadows.small,
    width: '100%',
    zIndex: 1000,
    ...Platform.select({
      ios: {
        paddingTop: spacing.md + 8, // Account for status bar on iOS
      },
      android: {
        paddingTop: spacing.md,
      },
      web: {
        paddingTop: spacing.md,
      },
    }),
  },
  iconButton: {
    padding: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 44,
    minHeight: 44,
  },
  icon: {
    color: colors.textSecondary,
  },
  activeIcon: {
    color: colors.textPrimary,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    height: 40,
  },
  searchIcon: {
    marginRight: spacing.sm,
    color: colors.textMuted,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    padding: 0,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
  },
  placeholder: {
    color: colors.textMuted,
  },
});

