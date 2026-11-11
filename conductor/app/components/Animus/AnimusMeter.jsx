import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

export const AnimusMeter = ({
  label,
  value = 0,
  max = 100,
  color,
  showValue = true,
  style,
}) => {
  const { animus, colors } = useTheme();
  const pct = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
  const fill = color || (pct >= 85 ? colors.error : pct >= 70 ? animus.gold : animus.goldSoft);
  return (
    <View style={[{ marginBottom: 10 }, style]}>
      {(label || showValue) ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          {label ? (
            <Text style={{
              fontSize: 11,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              color: colors.textMuted,
              fontFamily: animus.mono,
            }}
            >
              {label}
            </Text>
          ) : <View />}
          {showValue ? (
            <Text style={{ fontSize: 11, color: animus.gold, fontFamily: animus.mono }}>
              {typeof value === 'number' ? `${Math.round(pct)}%` : value}
            </Text>
          ) : null}
        </View>
      ) : null}
      <View style={{
        height: 6,
        borderRadius: 3,
        backgroundColor: animus.meterTrack,
        overflow: 'hidden',
      }}
      >
        <View style={{
          width: `${pct}%`,
          height: '100%',
          backgroundColor: fill,
          borderRadius: 3,
        }}
        />
      </View>
    </View>
  );
};

export default AnimusMeter;
