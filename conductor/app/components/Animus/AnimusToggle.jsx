import React from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

export const AnimusToggle = ({ options = [], value, onChange, style }) => {
  const { animus, colors } = useTheme();
  const wrap = {
    flexDirection: 'row',
    backgroundColor: animus.glass,
    borderWidth: 1,
    borderColor: animus.glassBorder,
    borderRadius: animus.radius,
    padding: 3,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(6px)' } : {}),
  };
  return (
    <View style={[wrap, style]}>
      {options.map((opt) => {
        const active = opt.key === value;
        const seg = {
          paddingHorizontal: 14,
          paddingVertical: 6,
          borderRadius: 7,
          ...(active ? { backgroundColor: animus.gold } : {}),
        };
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange && onChange(opt.key)}
            style={({ pressed, hovered }) => [
              seg,
              !active && hovered ? { backgroundColor: animus.goldFaint } : null,
              pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : null,
            ]}
          >
            <Text style={{
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: active ? colors.onAccent || '#10131A' : colors.textSecondary,
              fontFamily: animus.mono,
            }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

export default AnimusToggle;
