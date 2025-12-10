/**
 * Assassin's Creed-inspired loading screen theme
 * White backgrounds with grey accents - clean and minimal
 */

export const colors = {
  // White/Light grey base colors (AC loading screen style)
  background: '#FFFFFF',
  surface: '#F5F5F5',
  surfaceElevated: '#E8E8E8',
  
  // Grey accents (Assassin's Creed style)
  primary: '#2C2C2C',
  primaryLight: '#4A4A4A',
  primaryDark: '#1A1A1A',
  
  // Text colors
  textPrimary: '#2C2C2C',
  textSecondary: '#4A4A4A',
  textMuted: '#6B6B6B',
  
  // Status colors (muted greys)
  success: '#4A4A4A',
  error: '#8B8B8B',
  warning: '#6B6B6B',
  info: '#4A4A4A',
  
  // Border and divider
  border: '#D0D0D0',
  divider: '#E0E0E0',
  
  // Overlay
  overlay: 'rgba(255, 255, 255, 0.9)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const typography = {
  h1: {
    fontSize: 36,
    fontWeight: '300',
    color: colors.textPrimary,
    letterSpacing: 2,
  },
  h2: {
    fontSize: 24,
    fontWeight: '300',
    color: colors.textPrimary,
    letterSpacing: 1.5,
  },
  h3: {
    fontSize: 18,
    fontWeight: '400',
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  body: {
    fontSize: 16,
    color: colors.textPrimary,
    lineHeight: 24,
    fontWeight: '300',
  },
  bodySecondary: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 24,
    fontWeight: '300',
  },
  caption: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '300',
  },
  label: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
};

export const shadows = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export default {
  colors,
  spacing,
  typography,
  shadows,
  borderRadius,
};
