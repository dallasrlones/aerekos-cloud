import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { AnimusPanel } from './AnimusPanel';
import { AnimusEmpty } from './AnimusEmpty';
import { Button } from '../Button/Button';

/**
 * state: 'loading' | 'empty' | 'disabled' | 'unauthorized' | 'error' | 'ready'
 */
export const AnimusState = ({
  state = 'ready',
  children,
  metaphor = 'station',
  emptyTitle,
  emptyHint,
  emptyCta,
  onEmptyPress,
  onEnable,
  onRetry,
  error,
  loadingLabel = 'Reconstructing…',
}) => {
  const { colors, animus } = useTheme();

  if (state === 'loading') {
    return (
      <AnimusPanel>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
          <ActivityIndicator color={animus.gold} />
          <Text style={{ color: colors.textSecondary, fontFamily: animus.mono, fontSize: 13 }}>
            {loadingLabel}
          </Text>
        </View>
      </AnimusPanel>
    );
  }

  if (state === 'error') {
    return (
      <AnimusPanel>
        <Text style={{ color: colors.error, marginBottom: 10, fontFamily: animus.mono, fontSize: 13 }}>
          {error || 'Something failed.'}
        </Text>
        {onRetry ? <Button title="Retry" variant="secondary" onPress={onRetry} /> : null}
      </AnimusPanel>
    );
  }

  if (state === 'unauthorized') {
    return (
      <AnimusPanel>
        <Text style={{ color: colors.textPrimary, fontSize: 16, marginBottom: 6 }}>No permission</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
          You don’t have access to this station. Ask an admin if you need it.
        </Text>
      </AnimusPanel>
    );
  }

  if (state === 'disabled') {
    return (
      <AnimusPanel>
        <Text style={{ color: colors.textPrimary, fontSize: 16, marginBottom: 6 }}>Service offline</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 12 }}>
          Enable this service to start using it in this project.
        </Text>
        {onEnable ? <Button title="Enable / set up" onPress={onEnable} /> : null}
      </AnimusPanel>
    );
  }

  if (state === 'empty') {
    return (
      <AnimusEmpty
        metaphor={metaphor}
        title={emptyTitle}
        hint={emptyHint}
        ctaLabel={emptyCta}
        onPress={onEmptyPress}
      />
    );
  }

  return children || null;
};

export default AnimusState;
