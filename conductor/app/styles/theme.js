/**
 * Jarvis × Animus theme — light (daylight reconstruction) + dark (Jarvis void).
 * Prefer getTheme(mode) / useTheme(). Named exports stay light defaults for legacy imports.
 */

import { Platform } from 'react-native';
import {
  palettes as rawPalettes,
  createTypography,
  getThemePure,
  lightColors,
} from './themePalettes';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

const monoNative = 'monospace';

function withPlatformMono(animus) {
  return {
    ...animus,
    mono: Platform.OS === 'web' ? animus.mono : monoNative,
  };
}

export const palettes = {
  light: {
    colors: rawPalettes.light.colors,
    status: rawPalettes.light.status,
    animus: withPlatformMono(rawPalettes.light.animus),
  },
  dark: {
    colors: rawPalettes.dark.colors,
    status: rawPalettes.dark.status,
    animus: withPlatformMono(rawPalettes.dark.animus),
  },
};

export { createTypography };

export function createShadows(mode) {
  const soft = mode === 'dark' ? 0.35 : 0.05;
  const med = mode === 'dark' ? 0.45 : 0.08;
  const large = mode === 'dark' ? 0.55 : 0.1;
  return {
    small: {
      ...(Platform.OS === 'web' ? {
        boxShadow: mode === 'dark'
          ? '0 1px 3px rgba(0, 0, 0, 0.45)'
          : '0 1px 2px rgba(0, 0, 0, 0.05)',
      } : {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: soft,
        shadowRadius: 2,
        elevation: 1,
      }),
    },
    medium: {
      ...(Platform.OS === 'web' ? {
        boxShadow: mode === 'dark'
          ? '0 2px 8px rgba(0, 0, 0, 0.5)'
          : '0 2px 4px rgba(0, 0, 0, 0.08)',
      } : {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: med,
        shadowRadius: 4,
        elevation: 2,
      }),
    },
    large: {
      ...(Platform.OS === 'web' ? {
        boxShadow: mode === 'dark'
          ? '0 8px 24px rgba(0, 0, 0, 0.55)'
          : '0 4px 8px rgba(0, 0, 0, 0.1)',
      } : {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: large,
        shadowRadius: 8,
        elevation: 4,
      }),
    },
  };
}

/** @param {'light'|'dark'} mode */
export function getTheme(mode = 'light') {
  const base = getThemePure(mode);
  return {
    ...base,
    animus: withPlatformMono(base.animus),
    shadows: createShadows(base.mode),
    spacing,
    borderRadius,
  };
}

export const colors = lightColors;
export const animus = withPlatformMono(rawPalettes.light.animus);
export const typography = createTypography(lightColors);
export const shadows = createShadows('light');

export default {
  colors,
  spacing,
  typography,
  shadows,
  borderRadius,
  animus,
  palettes,
  getTheme,
  createTypography,
  createShadows,
};
