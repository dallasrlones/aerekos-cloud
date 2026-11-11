import { StyleSheet, Platform } from 'react-native';

/** @param {ReturnType<typeof import('../../styles/theme').getTheme>} theme */
export function createDeviceDetailsStyles(theme) {
  const { colors, spacing, animus } = theme;
  const mono = animus.mono;
  return StyleSheet.create({

  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },

  // --- Fullscreen ANIMUS hero ------------------------------------------------
  fullHero: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  hudLayer: {
    ...StyleSheet.absoluteFillObject,
    padding: spacing.lg,
    justifyContent: 'space-between',
  },
  hudTopStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  hudMiddle: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  leftStack: {
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  rightStack: {
    gap: spacing.sm,
    alignItems: 'flex-end',
  },
  hudCard: {
    minWidth: 150,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  hudBottom: {
    alignItems: 'center',
    gap: 4,
  },
  hudCaption: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: animus.inkSoft,
    fontFamily: mono,
  },

  // --- Shared header (DATA screen) -------------------------------------------
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  hostname: {
    fontSize: 26,
    fontWeight: '300',
    color: colors.textPrimary,
    letterSpacing: 1.5,
  },
  headerMeta: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: mono,
    marginTop: 2,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    fontFamily: mono,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // --- DATA screen -----------------------------------------------------------
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  panelGap: {
    marginBottom: spacing.lg,
  },

  coreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  coreCell: {
    width: 64,
    alignItems: 'center',
  },
  coreBarTrack: {
    width: 14,
    height: 90,
    backgroundColor: animus.meterTrack,
    borderRadius: 7,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  coreBarFill: {
    width: '100%',
    borderRadius: 7,
    ...(Platform.OS === 'web' ? { transition: 'height 0.4s ease, background-color 0.4s ease' } : {}),
  },
  coreCellLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontFamily: mono,
    marginTop: 6,
  },
  coreCellValue: {
    fontSize: 11,
    color: colors.textPrimary,
    fontFamily: mono,
    fontWeight: '600',
  },

  meterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  meterValue: {
    fontSize: 14,
    color: colors.textPrimary,
    fontFamily: mono,
  },
  meterPct: {
    fontSize: 13,
    color: animus.gold,
    fontFamily: mono,
    fontWeight: '700',
  },
  progressBar: {
    height: 12,
    backgroundColor: animus.meterTrack,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
    backgroundColor: animus.gold,
    ...(Platform.OS === 'web' ? { transition: 'width 0.4s ease' } : {}),
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  legendText: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: mono,
  },

  // --- Disk activity (read/write rates) --------------------------------------
  ioRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  ioCell: {
    flex: 1,
  },
  ioLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: colors.textSecondary,
    fontFamily: mono,
    marginBottom: 4,
  },
  ioValue: {
    fontSize: 22,
    fontWeight: '300',
    color: colors.textPrimary,
    fontFamily: mono,
  },
  ioUnit: {
    fontSize: 13,
    color: colors.textMuted,
    fontFamily: mono,
  },

  // --- Activity monitor (process table) --------------------------------------
  procHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 6,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: animus.meterTrack,
  },
  procHead: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.textSecondary,
    fontFamily: mono,
  },
  procRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    borderRadius: 4,
  },
  procRowAlt: {
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  procCell: {
    fontSize: 12,
    color: colors.textPrimary,
    fontFamily: mono,
  },
  procName: {
    flex: 1,
    paddingRight: 8,
  },
  procPid: {
    width: 70,
    color: colors.textMuted,
  },
  procNum: {
    width: 80,
    textAlign: 'right',
  },
  procHot: {
    color: '#E5484D',
    fontWeight: '700',
  },

  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  detailCard: {
    flexGrow: 1,
    flexBasis: '47%',
  },
  detailLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
    fontFamily: mono,
  },
  detailValue: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  deviceId: {
    fontSize: 11,
    fontFamily: mono,
    color: colors.textMuted,
  },

  });
}

export const DeviceDetailsStyles = createDeviceDetailsStyles(
  require('../../styles/theme').getTheme('light')
);
