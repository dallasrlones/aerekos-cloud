import { StyleSheet } from 'react-native';
import { colors, spacing, typography, shadows } from '../../styles/theme';

export const MenuStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
    paddingTop: spacing.md,
  },
  backButton: {
    padding: spacing.sm,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '300',
  },
  placeholder: {
    width: 44,
  },
  userSection: {
    marginBottom: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  username: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    fontWeight: '300',
  },
  email: {
    ...typography.bodySecondary,
    color: colors.textMuted,
  },
  menuSection: {
    marginTop: spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: colors.divider,
    marginBottom: spacing.sm,
    ...shadows.small,
  },
  menuItemText: {
    ...typography.body,
    color: colors.textPrimary,
    marginLeft: spacing.md,
    flex: 1,
  },
});

