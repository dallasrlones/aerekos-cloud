import React from 'react';
import { View, Text } from 'react-native';
import { Button } from '../Button/Button';
import { useProject } from '../../contexts/ProjectContext';
import { colors } from '../../styles/theme';

export const EnvSwitcher = ({ style } = {}) => {
  const { currentEnvironment, environments, setCurrentEnvironment, isSystemProject } = useProject();
  if (isSystemProject) {
    return (
      <View style={[{ marginBottom: 12 }, style]}>
        <Text style={{ color: colors.textMuted, fontSize: 13 }}>Environment: prod (fleet)</Text>
      </View>
    );
  }
  const names = (environments || []).map((e) => e.name);
  const shown = names.length ? names : ['prod', 'dev'];
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12, alignItems: 'center' }, style]}>
      <Text style={{ color: colors.textMuted, fontSize: 13 }}>Environment</Text>
      {shown.map((name) => (
        <Button
          key={name}
          title={name}
          variant={currentEnvironment === name ? 'primary' : 'secondary'}
          onPress={() => setCurrentEnvironment(name)}
        />
      ))}
    </View>
  );
};
