import { StyleSheet } from 'react-native';

export const createMascotStyles = (colors, animus, spacing, borderRadius) => StyleSheet.create({
  stage: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    minHeight: 200,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  floor: {
    width: '72%',
    maxWidth: 280,
    height: 3,
    borderRadius: 2,
    backgroundColor: animus.goldSoft,
    opacity: 0.55,
    marginTop: 4,
  },
  svgWrap: {
    width: 120,
    height: 168,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: animus.glassBorder,
    backgroundColor: colors.surface,
  },
  badgeText: {
    fontSize: 10,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: animus.gold,
    fontFamily: animus.mono,
  },
  anchorTag: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
});
