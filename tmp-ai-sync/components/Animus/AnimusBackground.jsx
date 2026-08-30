import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { animus } from '../../styles/theme';

/**
 * Full-bleed Animus backdrop: a soft radial gradient. Optional faint scanlines
 * (web, off by default). Drop it as the first child of a screen's root view so
 * content renders on top. pointerEvents none so it never blocks touches.
 */
export const AnimusBackground = ({ scanlines = false, style }) => {
  if (Platform.OS !== 'web') {
    return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#F5F3EC' }, style]} />;
  }
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundImage: animus.bgGradient }, style]}
    >
      {scanlines ? <View style={[StyleSheet.absoluteFill, { backgroundImage: animus.scanlines }]} /> : null}
    </View>
  );
};

export default AnimusBackground;
