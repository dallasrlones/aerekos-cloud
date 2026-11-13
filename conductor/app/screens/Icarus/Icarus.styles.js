import { StyleSheet, Platform } from 'react-native';
import { spacing, typography } from '../../styles/theme';

/** Docunu-blue Tron void — brand light only; no amber. */
export const ICARUS_TRON = {
  void: '#05070a',
  surface: '#0a1018',
  grid: 'rgba(0, 195, 255, 0.07)',
  line: '#00C3FF',
  lineDim: 'rgba(0, 195, 255, 0.35)',
  wash: '#3de7ff',
  text: '#e8eef5',
  muted: '#8b9bb0',
  danger: '#ff6b6b',
  dangerBg: 'rgba(255, 80, 80, 0.12)',
  ok: '#5dffb0',
  wait: '#3de7ff',
  fontDisplay: Platform.select({
    web: '"Orbitron", "Rajdhani", "Segoe UI", sans-serif',
    default: 'System',
  }),
  fontBody: Platform.select({
    web: '"IBM Plex Sans", "Source Sans 3", "Segoe UI", sans-serif',
    default: 'System',
  }),
};

const T = ICARUS_TRON;

export const IcarusStyles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: T.void,
    minHeight: Platform.OS === 'web' ? '100%' : undefined,
    ...(Platform.OS === 'web'
      ? {
          backgroundImage: `
            linear-gradient(${T.grid} 1px, transparent 1px),
            linear-gradient(90deg, ${T.grid} 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }
      : {}),
  },
  rail: {
    width: 168,
    borderRightWidth: 1,
    borderRightColor: T.lineDim,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    backgroundColor: T.surface,
  },
  railBrand: {
    fontFamily: T.fontDisplay,
    fontWeight: '700',
    fontSize: 20,
    letterSpacing: 2,
    paddingHorizontal: spacing.sm,
    marginBottom: 4,
    color: T.line,
    textTransform: 'uppercase',
  },
  projectChip: {
    marginHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: T.lineDim,
  },
  projectChipText: {
    ...typography.caption,
    fontFamily: T.fontBody,
    color: T.muted,
  },
  railItem: {
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: 2,
    marginBottom: 2,
    borderLeftWidth: 2,
    borderLeftColor: 'transparent',
  },
  railItemActive: {
    backgroundColor: 'rgba(0, 195, 255, 0.08)',
    borderLeftColor: T.line,
  },
  railItemText: {
    fontFamily: T.fontBody,
    fontSize: 14,
    color: T.text,
  },
  railGroup: {
    fontFamily: T.fontBody,
    fontSize: 11,
    color: T.muted,
    marginTop: spacing.md,
    marginBottom: 4,
    paddingHorizontal: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  chatSplit: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 0,
  },
  chatSplitCompact: {
    flexDirection: 'column',
  },
  chatCol: {
    flex: 1.15,
    minWidth: 0,
    borderRightWidth: 1,
    borderRightColor: T.lineDim,
  },
  chatColCompact: {
    flex: 1,
    borderRightWidth: 0,
    minHeight: 280,
  },
  graphCol: {
    flex: 0.95,
    minWidth: 0,
    minHeight: 0,
  },
  graphColCompact: {
    flexGrow: 0,
    flexShrink: 0,
    maxHeight: 220,
    borderTopWidth: 1,
    borderTopColor: T.lineDim,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: T.lineDim,
    backgroundColor: T.surface,
  },
  liveMark: {
    fontFamily: T.fontDisplay,
    fontSize: 12,
    letterSpacing: 3,
    color: T.line,
    textTransform: 'uppercase',
  },
  mascotSlot: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotSlotCompact: {
    width: 48,
    height: 48,
  },
  banner: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(0, 195, 255, 0.06)',
    borderBottomWidth: 1,
    borderBottomColor: T.lineDim,
  },
  bannerText: {
    fontFamily: T.fontBody,
    fontSize: 12,
    color: T.wash,
  },
  bannerDanger: {
    backgroundColor: T.dangerBg,
  },
  bannerDangerText: {
    color: T.danger,
  },
  sectionBody: {
    flex: 1,
    padding: spacing.md,
  },
  sectionTitle: {
    fontFamily: T.fontDisplay,
    fontSize: 22,
    letterSpacing: 1,
    color: T.line,
    marginBottom: 4,
  },
  sectionSub: {
    fontFamily: T.fontBody,
    fontSize: 13,
    color: T.muted,
    marginBottom: spacing.md,
  },
  drawerCard: {
    borderWidth: 1,
    borderColor: T.lineDim,
    borderRadius: 2,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: T.surface,
  },
  askBadge: {
    marginLeft: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 2,
    backgroundColor: T.line,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  askBadgeText: {
    color: T.void,
    fontSize: 10,
    fontWeight: '700',
  },
  threadList: {
    maxHeight: 120,
    borderBottomWidth: 1,
    borderBottomColor: T.lineDim,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  flowSheetToggle: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: T.lineDim,
    backgroundColor: T.surface,
    alignItems: 'center',
  },
  flowSheetToggleText: {
    fontFamily: T.fontDisplay,
    fontSize: 11,
    letterSpacing: 2,
    color: T.line,
    textTransform: 'uppercase',
  },
});

export default IcarusStyles;
