import { StyleSheet, Platform } from 'react-native';
import { colors, spacing, shadows, borderRadius } from '../../styles/theme';

export const EnvSwitcherStyles = StyleSheet.create({
  headerWrap: {
    minWidth: 72,
    maxWidth: 120,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginRight: spacing.xs,
    flexShrink: 1,
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
    maxHeight: 320,
    ...shadows.large,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  itemActive: {
    backgroundColor: colors.surfaceHover,
  },
  itemText: {
    fontSize: 14,
    color: colors.textPrimary,
    flex: 1,
  },
  itemTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
});
