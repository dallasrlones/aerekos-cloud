import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

/**
 * Full-bleed Animus backdrop. pointerEvents none so it never blocks touches.
 */
export const AnimusBackground = ({ scanlines = false, style }) => {
  const { animus } = useTheme();
  if (Platform.OS !== 'web') {
    return (
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: animus.bgSolid }, style]}
      />
    );
  }
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundImage: animus.bgGradient }, style]}
    >
      {scanlines ? (
        <View style={[StyleSheet.absoluteFill, { backgroundImage: animus.scanlines }]} />
      ) : null}
    </View>
  );
};

export default AnimusBackground;
