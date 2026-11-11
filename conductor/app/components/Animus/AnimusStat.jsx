import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

export const AnimusStat = ({ label, value, unit, sub, size = 'md', align = 'left' }) => {
  const { animus, colors } = useTheme();
  const valueSize = size === 'lg' ? 30 : size === 'sm' ? 18 : 24;
  return (
    <View style={{ alignItems: align === 'right' ? 'flex-end' : 'flex-start' }}>
      <Text style={{
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 2,
        textTransform: 'uppercase',
        color: colors.textSecondary,
        fontFamily: animus.mono,
      }}
      >
        {label}
      </Text>
      <View style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginTop: 2,
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
      }}
      >
        <Text style={{
          fontWeight: '400',
          color: colors.textPrimary,
          fontFamily: animus.mono,
          fontSize: valueSize,
          lineHeight: valueSize + 4,
        }}
        >
          {value}
        </Text>
        {unit ? (
          <Text style={{
            fontSize: 12,
            color: animus.gold,
            fontFamily: animus.mono,
            marginLeft: 4,
            marginBottom: 3,
            fontWeight: '700',
          }}
          >
            {unit}
          </Text>
        ) : null}
      </View>
      {sub ? (
        <Text style={{
          fontSize: 11,
          color: colors.textSecondary,
          fontFamily: animus.mono,
          marginTop: 1,
        }}
        >
          {sub}
        </Text>
      ) : null}
    </View>
  );
};

export default AnimusStat;
