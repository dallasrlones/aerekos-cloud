/** Pure palette data (no react-native) for getTheme + unit tests. */

const MONO_WEB = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

const lightColors = {
  background: '#FFFFFF',
  surface: '#F5F5F5',
  surfaceElevated: '#E8E8E8',
  surfaceHover: '#EEEEEE',
  primary: '#2C2C2C',
  primaryLight: '#4A4A4A',
  primaryDark: '#1A1A1A',
  textPrimary: '#2C2C2C',
  textSecondary: '#4A4A4A',
  textMuted: '#6B6B6B',
  success: '#2E7D32',
  error: '#C62828',
  warning: '#E9A825',
  info: '#4A4A4A',
  border: '#D0D0D0',
  divider: '#E0E0E0',
  overlay: 'rgba(255, 255, 255, 0.9)',
  cardBackground: '#FAFAFA',
  accent: '#D4AF37',
  onAccent: '#10131A',
};

const darkColors = {
  background: '#0B0D10',
  surface: '#14181E',
  surfaceElevated: '#1C222A',
  surfaceHover: '#242B34',
  primary: '#F2F5F8',
  primaryLight: '#D5DCE6',
  primaryDark: '#FFFFFF',
  // Higher contrast on void — secondary/muted were washing out on glass
  textPrimary: '#F7F9FC',
  textSecondary: '#D5DCE6',
  textMuted: '#B8C0CA',
  success: '#81C784',
  error: '#E57373',
  warning: '#F0AD4E',
  info: '#C8D0DA',
  border: '#3A4450',
  divider: '#2A323C',
  overlay: 'rgba(11, 13, 16, 0.92)',
  cardBackground: '#12161C',
  accent: '#D4AF37',
  onAccent: '#10131A',
};

const lightStatus = {
  running: '#2E7D32',
  degraded: '#E9A825',
  stopped: '#6B6B6B',
  alarm: '#C62828',
  unknown: '#9E9E9E',
};

const darkStatus = {
  running: '#81C784',
  degraded: '#F0AD4E',
  stopped: '#A7B0BC',
  alarm: '#E57373',
  unknown: '#8A93A0',
};

const lightAnimus = {
  gold: '#D4AF37',
  goldSoft: 'rgba(212, 175, 55, 0.45)',
  goldFaint: 'rgba(212, 175, 55, 0.12)',
  ink: '#2C2C2C',
  inkSoft: 'rgba(44, 44, 44, 0.55)',
  line: 'rgba(44, 44, 44, 0.18)',
  glass: 'rgba(255, 255, 255, 0.72)',
  glassStrong: 'rgba(255, 255, 255, 0.85)',
  glassBorder: 'rgba(212, 175, 55, 0.4)',
  meterTrack: '#E6E2D6',
  mono: MONO_WEB,
  bgGradient: 'radial-gradient(circle at 50% 30%, #FFFFFF 0%, #F3F1EA 55%, #E7E3D8 100%)',
  bgSolid: '#F5F3EC',
  scanlines: 'repeating-linear-gradient(0deg, rgba(44,44,44,0.035) 0px, rgba(44,44,44,0.035) 1px, transparent 1px, transparent 3px)',
  radius: 10,
  struct: '#2C2C2C',
  clear: '#F5F3EC',
};

const darkAnimus = {
  gold: '#E0C04A',
  goldSoft: 'rgba(224, 192, 74, 0.55)',
  goldFaint: 'rgba(224, 192, 74, 0.18)',
  ink: '#F7F9FC',
  inkSoft: 'rgba(247, 249, 252, 0.9)',
  line: 'rgba(247, 249, 252, 0.28)',
  // More opaque glass so labels don't compete with the void gradient
  glass: 'rgba(18, 22, 28, 0.96)',
  glassStrong: 'rgba(26, 32, 40, 0.98)',
  glassBorder: 'rgba(224, 192, 74, 0.5)',
  meterTrack: '#252B34',
  mono: MONO_WEB,
  bgGradient: 'radial-gradient(circle at 50% 28%, #1A2030 0%, #0E1218 55%, #080A0D 100%)',
  bgSolid: '#0B0D10',
  scanlines: 'repeating-linear-gradient(0deg, rgba(224,192,74,0.02) 0px, rgba(224,192,74,0.02) 1px, transparent 1px, transparent 3px)',
  radius: 10,
  struct: '#B8C0CA',
  clear: '#0B0D10',
};

const palettes = {
  light: { colors: lightColors, animus: lightAnimus, status: lightStatus },
  dark: { colors: darkColors, animus: darkAnimus, status: darkStatus },
};

function createTypography(c) {
  return {
    h1: { fontSize: 36, fontWeight: '300', color: c.textPrimary, letterSpacing: 2 },
    h2: { fontSize: 24, fontWeight: '300', color: c.textPrimary, letterSpacing: 1.5 },
    h3: { fontSize: 18, fontWeight: '400', color: c.textPrimary, letterSpacing: 1 },
    body: { fontSize: 16, color: c.textPrimary, lineHeight: 24, fontWeight: '300' },
    bodySecondary: { fontSize: 16, color: c.textSecondary, lineHeight: 24, fontWeight: '300' },
    caption: { fontSize: 14, color: c.textMuted, fontWeight: '300' },
    label: {
      fontSize: 12,
      fontWeight: '400',
      color: c.textPrimary,
      textTransform: 'uppercase',
      letterSpacing: 1.5,
    },
  };
}

function getThemePure(mode = 'light') {
  const m = mode === 'dark' ? 'dark' : 'light';
  const { colors: c, animus: a, status } = palettes[m];
  return {
    mode: m,
    isDark: m === 'dark',
    colors: c,
    animus: a,
    status,
    typography: createTypography(c),
  };
}

module.exports = {
  palettes,
  createTypography,
  getThemePure,
  lightColors,
  darkColors,
};
