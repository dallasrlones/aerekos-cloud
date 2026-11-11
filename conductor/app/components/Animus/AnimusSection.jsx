import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { AnimusPanel } from './AnimusPanel';

export const AnimusSection = ({ title, hint, right, children, brackets = true, style }) => {
  const { colors, animus, spacing } = useTheme();
  return (
    <View style={[{ marginBottom: spacing.md }, style]}>
      <AnimusPanel
        title={title}
        right={right}
        brackets={brackets}
      >
        {hint ? (
          <Text style={{
            fontSize: 13,
            color: colors.textSecondary,
            marginBottom: 10,
            lineHeight: 18,
          }}
          >
            {hint}
          </Text>
        ) : null}
        {children}
      </AnimusPanel>
    </View>
  );
};

export default AnimusSection;
