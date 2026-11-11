import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { AnimusPanel } from './AnimusPanel';
import { getMetaphor } from './metaphors';
import { Button } from '../Button/Button';

export const AnimusEmpty = ({
  metaphor = 'station',
  title,
  hint,
  ctaLabel,
  onPress,
  style,
}) => {
  const { colors, animus } = useTheme();
  const meta = getMetaphor(metaphor);
  return (
    <AnimusPanel style={[{ alignItems: 'flex-start', paddingVertical: 28 }, style]}>
      <Text style={{
        fontSize: 10,
        letterSpacing: 2,
        textTransform: 'uppercase',
        color: animus.gold,
        fontFamily: animus.mono,
        marginBottom: 8,
      }}
      >
        {meta.zone}
      </Text>
      <Text style={{
        fontSize: 20,
        fontWeight: '300',
        color: colors.textPrimary,
        marginBottom: 8,
      }}
      >
        {title || meta.emptyTitle}
      </Text>
      <Text style={{
        fontSize: 14,
        color: colors.textSecondary,
        lineHeight: 20,
        marginBottom: 16,
        maxWidth: 420,
      }}
      >
        {hint || meta.emptyHint}
      </Text>
      {onPress ? (
        <Button title={ctaLabel || meta.cta} onPress={onPress} />
      ) : null}
    </AnimusPanel>
  );
};

export default AnimusEmpty;
