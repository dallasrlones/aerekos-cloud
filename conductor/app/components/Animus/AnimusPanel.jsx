import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

const Corner = ({ pos, color }) => {
  const base = {
    position: 'absolute',
    width: 12,
    height: 12,
    borderColor: color,
  };
  const map = {
    tl: { top: -1, left: -1, borderTopWidth: 2, borderLeftWidth: 2 },
    tr: { top: -1, right: -1, borderTopWidth: 2, borderRightWidth: 2 },
    bl: { bottom: -1, left: -1, borderBottomWidth: 2, borderLeftWidth: 2 },
    br: { bottom: -1, right: -1, borderBottomWidth: 2, borderRightWidth: 2 },
  };
  return <View pointerEvents="none" style={[base, map[pos]]} />;
};

export const AnimusPanel = ({ title, right, children, strong = false, brackets = true, style, contentStyle }) => {
  const { animus } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: strong ? animus.glassStrong : animus.glass,
          borderWidth: 1,
          borderColor: animus.glassBorder,
          borderRadius: animus.radius,
          padding: 14,
          ...(Platform.OS === 'web' ? { backdropFilter: 'blur(6px)' } : {}),
        },
        style,
      ]}
    >
      {brackets ? (
        <>
          <Corner pos="tl" color={animus.gold} />
          <Corner pos="tr" color={animus.gold} />
          <Corner pos="bl" color={animus.gold} />
          <Corner pos="br" color={animus.gold} />
        </>
      ) : null}
      {(title || right) ? (
        <View style={styles.header}>
          {title ? (
            <Text style={{
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: animus.inkSoft,
              fontFamily: animus.mono,
            }}
            >
              {title}
            </Text>
          ) : <View />}
          {right || null}
        </View>
      ) : null}
      <View style={contentStyle}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
});

export default AnimusPanel;
