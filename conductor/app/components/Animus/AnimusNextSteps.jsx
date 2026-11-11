import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useProject } from '../../contexts/ProjectContext';
import { useTheme } from '../../contexts/ThemeContext';
import { setupService } from '../../services/setupService';
import { AnimusPanel } from './AnimusPanel';
import { Button } from '../Button/Button';

const ACTION_ROUTE = {
  fill_secret: 'serviceSecretsList',
  add_remote: 'gitManager',
  create_env: 'computeManager',
  launch: 'launchContainer',
  bind: 'computeManager',
  open_pr: 'gitManager',
  open_adonis: 'adonis',
};

export const AnimusNextSteps = ({ navigation, filter, steps: stepsProp } = {}) => {
  const { currentProject } = useProject();
  const { colors, animus } = useTheme();
  const [fetched, setFetched] = useState([]);

  const load = useCallback(async () => {
    if (stepsProp) return;
    if (!currentProject?.id) return;
    try {
      const sum = await setupService.getProjectSummary(currentProject.id);
      const list = sum?.next_steps || [];
      setFetched(filter ? list.filter((s) => filter.includes(s.action)) : list);
    } catch {
      setFetched([]);
    }
  }, [currentProject?.id, filter, stepsProp]);

  useEffect(() => { load(); }, [load]);

  const steps = stepsProp || fetched;
  const pending = steps.filter((s) => s.status !== 'done');
  if (!pending.length) return null;

  return (
    <AnimusPanel title="Objectives" style={{ marginBottom: 16 }}>
      {pending.map((s) => (
        <View key={s.id} style={{ marginBottom: 12 }}>
          <Text style={{ color: colors.textPrimary, marginBottom: 8, lineHeight: 20 }}>
            {s.reason}
          </Text>
          {navigation && ACTION_ROUTE[s.action] ? (
            <Button
              title={String(s.action).replace(/_/g, ' ')}
              variant="secondary"
              onPress={() => navigation.navigate(ACTION_ROUTE[s.action])}
            />
          ) : null}
        </View>
      ))}
      <Text style={{
        fontSize: 10,
        color: animus.gold,
        fontFamily: animus.mono,
        letterSpacing: 1.5,
        textTransform: 'uppercase',
      }}
      >
        Guided path
      </Text>
    </AnimusPanel>
  );
};

export default AnimusNextSteps;
