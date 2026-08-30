import { StyleSheet, Platform } from 'react-native';
import { colors, shadows } from '../../styles/theme';

export const ServerVisualStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  serverContainer: {
    width: '100%',
    maxWidth: 400,
    height: 400,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? {
      perspective: '1200px',
      perspectiveOrigin: '50% 50%',
    } : {}),
  },
  server3D: {
    width: 300,
    height: 250,
    position: 'relative',
    ...(Platform.OS === 'web' ? {
      transformStyle: 'preserve-3d',
      transform: 'rotateY(-30deg) rotateX(20deg)',
    } : {
      transform: [
        { rotateY: '-30deg' },
        { rotateX: '20deg' },
      ],
    }),
  },
  // Front Panel
  frontPanel: {
    position: 'absolute',
    width: 300,
    height: 250,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 20,
    ...(Platform.OS === 'web' ? {
      transform: 'translateZ(30px)',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
    } : {
      transform: [{ translateZ: 30 }],
      ...shadows.large,
    }),
  },
  ventTop: {
    height: 8,
    marginBottom: 12,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 2,
    ...(Platform.OS === 'web' ? {
      backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 8px, ${colors.border} 8px, ${colors.border} 10px)`,
    } : {}),
  },
  ventBottom: {
    height: 8,
    marginTop: 12,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 2,
    ...(Platform.OS === 'web' ? {
      backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 8px, ${colors.border} 8px, ${colors.border} 10px)`,
    } : {}),
  },
  displayArea: {
    marginBottom: 12,
  },
  displayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  lcdDisplay: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.textSecondary,
    padding: 12,
    ...(Platform.OS === 'web' ? {
      boxShadow: 'inset 0 0 10px rgba(0, 0, 0, 0.05)',
    } : {}),
  },
  lcdLabel: {
    fontSize: 8,
    color: colors.textSecondary,
    fontWeight: '300',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 6,
    fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : 'System',
  },
  lcdValue: {
    fontSize: 24,
    color: colors.textPrimary,
    fontWeight: '200',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : 'System',
  },
  lcdUnit: {
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: '300',
    letterSpacing: 1.5,
    marginTop: 4,
    fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : 'System',
  },
  statusLED: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  // Top Panel
  topPanel: {
    position: 'absolute',
    width: 300,
    height: 40,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 2,
    borderColor: colors.border,
    borderBottomWidth: 0,
    ...(Platform.OS === 'web' ? {
      transform: 'rotateX(90deg) translateZ(125px)',
      transformOrigin: 'bottom center',
      boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.05)',
    } : {
      transform: [
        { rotateX: '90deg' },
        { translateZ: 125 },
      ],
    }),
  },
  // Right Side Panel
  sidePanel: {
    position: 'absolute',
    width: 40,
    height: 250,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 2,
    borderColor: colors.border,
    borderLeftWidth: 0,
    ...(Platform.OS === 'web' ? {
      transform: 'rotateY(90deg) translateZ(150px)',
      transformOrigin: 'left center',
      boxShadow: 'inset 2px 0 4px rgba(0, 0, 0, 0.05)',
    } : {
      transform: [
        { rotateY: '90deg' },
        { translateZ: 150 },
      ],
    }),
  },
});
