/**
 * Assassin's Creed-inspired loading screen theme
 * White backgrounds with grey accents - clean and minimal
 */

import { Platform } from 'react-native';

export const colors = {
  // White/Light grey base colors (AC loading screen style)
  background: '#FFFFFF',
  surface: '#F5F5F5',
  surfaceElevated: '#E8E8E8',
  surfaceHover: '#EEEEEE',
  
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
  
  // Card background
  cardBackground: '#FAFAFA',
  
  // Accent color (gold/yellow for actions)
  accent: '#D4AF37',
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
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    }),
  },
  medium: {
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    }),
  },
  large: {
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    }),
  },
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

/**
 * Animus design tokens — the shared "we're inside the Animus" look.
 *
 * White reconstruction space, dark-grey wireframe structure, gold = active/data,
 * monospace numerics, glass HUD panels with gold corner brackets. Consume these
 * from the reusable primitives in components/Animus/* so every screen matches.
 */
export const animus = {
  gold: '#D4AF37',
  goldSoft: 'rgba(212, 175, 55, 0.45)',
  goldFaint: 'rgba(212, 175, 55, 0.12)',
  ink: '#2C2C2C',
  inkSoft: 'rgba(44, 44, 44, 0.55)',
  line: 'rgba(44, 44, 44, 0.18)',

  // Glass HUD surfaces
  glass: 'rgba(255, 255, 255, 0.72)',
  glassStrong: 'rgba(255, 255, 255, 0.85)',
  glassBorder: 'rgba(212, 175, 55, 0.4)',

  mono: Platform.OS === 'web'
    ? 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
    : 'monospace',

  // Web-only decorative layers
  bgGradient: 'radial-gradient(circle at 50% 30%, #FFFFFF 0%, #F3F1EA 55%, #E7E3D8 100%)',
  scanlines: 'repeating-linear-gradient(0deg, rgba(44,44,44,0.035) 0px, rgba(44,44,44,0.035) 1px, transparent 1px, transparent 3px)',

  radius: 10,
};

export default {
  colors,
  spacing,
  typography,
  shadows,
  borderRadius,
  animus,
};
