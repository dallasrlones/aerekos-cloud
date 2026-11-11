import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { Button } from '../Button/Button';

/**
 * Ability-bar style action cluster. actions: [{ title, onPress, variant?, primary? }]
 */
export const AnimusActionBar = ({ actions = [], style }) => {
  const { spacing } = useTheme();
  if (!actions.length) return null;
  return (
    <View style={[{
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    }, style]}
    >
      {actions.map((a) => (
        <Button
          key={a.title}
          title={a.title}
          onPress={a.onPress}
          variant={a.primary || a.variant === 'primary' ? 'primary' : 'secondary'}
          disabled={a.disabled}
          loading={a.loading}
        />
      ))}
    </View>
  );
};

export default AnimusActionBar;
