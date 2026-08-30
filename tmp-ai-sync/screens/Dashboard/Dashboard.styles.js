import { StyleSheet, Platform } from 'react-native';
import { colors, typography, spacing, shadows, borderRadius } from '../../styles/theme';

export const DashboardStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },

  // --- Loading / empty states ---------------------------------------------
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    ...typography.bodySecondary,
  },
  inlineLoading: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyState: {
    alignItems: 'center',
    maxWidth: 420,
    padding: spacing.xl,
  },
  emptyStateTitle: {
    ...typography.h2,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  emptyStateDescription: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  createButton: {
    minWidth: 200,
  },

  // --- Hero / greeting -----------------------------------------------------
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  heroText: {
    flexShrink: 1,
  },
  title: {
    ...typography.h1,
  },
  subtitle: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  subtitleStrong: {
    color: colors.textPrimary,
    fontWeight: '500',
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  heroBtnText: {
    ...typography.caption,
    color: colors.textPrimary,
  },

  // --- Search --------------------------------------------------------------
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 44,
    marginBottom: spacing.lg,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    paddingVertical: 0,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },

  // --- Stat cards ----------------------------------------------------------
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flexGrow: 1,
    flexBasis: 160,
    minWidth: 140,
    margin: spacing.sm,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.small,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    ...typography.h2,
    fontSize: 28,
  },
  statLabel: {
    ...typography.caption,
    marginTop: spacing.xs,
  },

  // --- Recently visited ----------------------------------------------------
  recentSection: {
    marginBottom: spacing.xl,
  },
  recentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    maxWidth: 220,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  recentChipText: {
    ...typography.caption,
    color: colors.textPrimary,
    flexShrink: 1,
  },

  // --- Catalog -------------------------------------------------------------
  group: {
    marginBottom: spacing.xl,
  },
  groupTitle: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.sm,
  },
  card: {
    width: 280,
    flexGrow: 1,
    maxWidth: 360,
    margin: spacing.sm,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.small,
    ...(Platform.OS === 'web' ? { cursor: 'pointer', transitionProperty: 'border-color, box-shadow', transitionDuration: '150ms' } : {}),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceDot: {
    width: 9,
    height: 9,
    borderRadius: borderRadius.full,
  },
  cardTitle: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  cardDesc: {
    ...typography.caption,
    lineHeight: 18,
    minHeight: 36,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  cardStatus: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textMuted,
  },
  cardStatusOn: {
    color: '#4CAF50',
  },
  cardBadge: {
    ...typography.caption,
    fontSize: 11,
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  emptyText: {
    ...typography.bodySecondary,
    marginTop: spacing.md,
  },
});
