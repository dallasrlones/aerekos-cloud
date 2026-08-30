import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { animus, colors } from '../../styles/theme';

/**
 * Segmented Animus view switch (e.g. ANIMUS ⇄ DATA). Reusable anywhere a screen
 * needs to flip between the 3D/visual mode and a detailed list mode.
 *
 * Props:
 *   - options: [{ key, label }]
 *   - value:   active key
 *   - onChange(key)
 */
export const AnimusToggle = ({ options = [], value, onChange, style }) => {
  return (
    <View style={[styles.wrap, style]}>
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange && onChange(opt.key)}
            style={[styles.seg, active && styles.segActive]}
            {...(Platform.OS === 'web' ? { style: ({ hovered }) => [styles.seg, active && styles.segActive, hovered && !active && styles.segHover] } : {})}
          >
            <Text style={[styles.segText, active && styles.segTextActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: animus.glass,
    borderWidth: 1,
    borderColor: animus.glassBorder,
    borderRadius: animus.radius,
    padding: 3,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(6px)' } : {}),
  },
  seg: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 7,
  },
  segHover: {
    backgroundColor: animus.goldFaint,
  },
  segActive: {
    backgroundColor: animus.gold,
  },
  segText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    fontFamily: animus.mono,
  },
  segTextActive: {
    color: '#FFFFFF',
  },
});

export default AnimusToggle;
