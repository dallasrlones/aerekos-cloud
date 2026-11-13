import { StyleSheet, Platform } from 'react-native';
import { colors, spacing, typography } from '../../styles/theme';

export const IcarusStyles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.background,
    minHeight: Platform.OS === 'web' ? '100%' : undefined,
  },
  rail: {
    width: 168,
    borderRightWidth: 1,
    borderRightColor: colors.divider,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.surface,
  },
  railBrand: {
    ...typography.body,
    fontWeight: '700',
    fontSize: 18,
    paddingHorizontal: spacing.sm,
    marginBottom: 4,
    color: colors.textPrimary,
  },
  projectChip: {
    marginHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  projectChipText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  railItem: {
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    marginBottom: 2,
  },
  railItemActive: {
    backgroundColor: colors.border,
  },
  railItemText: {
    ...typography.body,
    fontSize: 14,
    color: colors.textPrimary,
  },
  railGroup: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.md,
    marginBottom: 4,
    paddingHorizontal: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  chatSplit: {
    flex: 1,
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    minHeight: 0,
  },
  chatCol: {
    flex: Platform.OS === 'web' ? 1.15 : 1,
    minWidth: 0,
    borderRightWidth: Platform.OS === 'web' ? 1 : 0,
    borderRightColor: colors.divider,
  },
  graphCol: {
    flex: Platform.OS === 'web' ? 0.95 : 1,
    minWidth: 0,
    minHeight: Platform.OS === 'web' ? 0 : 280,
  },
  banner: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#2a2210',
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  bannerText: {
    ...typography.caption,
    color: '#d4af37',
  },
  bannerDanger: {
    backgroundColor: '#2a1210',
  },
  bannerDangerText: {
    color: '#e07060',
  },
  sectionBody: {
    flex: 1,
    padding: spacing.md,
  },
  sectionTitle: {
    ...typography.h2,
    marginBottom: 4,
  },
  sectionSub: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  drawerCard: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  askBadge: {
    marginLeft: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#c23b22',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  askBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  threadList: {
    maxHeight: 120,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
});

export default IcarusStyles;
