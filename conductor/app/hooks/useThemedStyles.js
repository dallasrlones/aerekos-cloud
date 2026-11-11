import { useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Memoize StyleSheet factories against theme.mode.
 * @param {(theme: ReturnType<typeof import('../styles/theme').getTheme>) => object} factory
 */
export function useThemedStyles(factory) {
  const theme = useTheme();
  return useMemo(() => factory(theme), [theme.mode, factory]);
}

export default useThemedStyles;
