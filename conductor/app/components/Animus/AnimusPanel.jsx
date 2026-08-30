import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { animus } from '../../styles/theme';

const Corner = ({ pos }) => {
  const base = {
    position: 'absolute',
    width: 12,
    height: 12,
    borderColor: animus.gold,
  };
  const map = {
    tl: { top: -1, left: -1, borderTopWidth: 2, borderLeftWidth: 2 },
    tr: { top: -1, right: -1, borderTopWidth: 2, borderRightWidth: 2 },
    bl: { bottom: -1, left: -1, borderBottomWidth: 2, borderLeftWidth: 2 },
    br: { bottom: -1, right: -1, borderBottomWidth: 2, borderRightWidth: 2 },
  };
  return <View pointerEvents="none" style={[base, map[pos]]} />;
};

/**
 * Glass HUD panel with gold corner brackets — the canonical Animus container.
 *
 * Props:
 *   - title: optional uppercase mono header
 *   - right: optional node rendered at the right of the header row
 *   - strong: more opaque glass (use over the 3D scene)
 *   - brackets: show corner reticles (default true)
 */
export const AnimusPanel = ({ title, right, children, strong = false, brackets = true, style, contentStyle }) => {
  return (
    <View style={[styles.panel, strong && styles.panelStrong, style]}>
      {brackets ? (
        <>
          <Corner pos="tl" />
          <Corner pos="tr" />
          <Corner pos="bl" />
          <Corner pos="br" />
        </>
      ) : null}
      {(title || right) ? (
        <View style={styles.header}>
          {title ? <Text style={styles.title}>{title}</Text> : <View />}
          {right || null}
        </View>
      ) : null}
      <View style={contentStyle}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    backgroundColor: animus.glass,
    borderWidth: 1,
    borderColor: animus.glassBorder,
    borderRadius: animus.radius,
    padding: 14,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(6px)' } : {}),
  },
  panelStrong: {
    backgroundColor: animus.glassStrong,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: animus.inkSoft,
    fontFamily: animus.mono,
  },
});

export default AnimusPanel;
