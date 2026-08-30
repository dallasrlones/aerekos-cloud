import { useWindowDimensions } from 'react-native';

export const COMPACT_MAX = 768;

export function useBreakpoint() {
  const { width, height } = useWindowDimensions();
  const compact = width < COMPACT_MAX;
  return { width, height, compact };
}
