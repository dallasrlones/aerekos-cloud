import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Box } from '../Box/Box';
import { Button } from '../Button/Button';
import { useProject } from '../../contexts/ProjectContext';
import { setupService } from '../../services/setupService';
import { colors } from '../../styles/theme';

const ACTION_ROUTE = {
  fill_secret: 'serviceSecretsList',
  add_remote: 'gitManager',
  create_env: 'computeManager',
  launch: 'launchContainer',
  bind: 'computeManager',
  open_pr: 'gitManager',
};

export const NextSteps = ({ navigation, filter } = {}) => {
  const { currentProject } = useProject();
  const [steps, setSteps] = useState([]);

  const load = useCallback(async () => {
    if (!currentProject?.id) return;
    try {
      const sum = await setupService.getProjectSummary(currentProject.id);
      const list = sum?.next_steps || [];
      setSteps(filter ? list.filter((s) => filter.includes(s.action)) : list);
    } catch {
      setSteps([]);
    }
  }, [currentProject?.id, filter]);

  useEffect(() => { load(); }, [load]);

  const pending = steps.filter((s) => s.status !== 'done');
  if (!pending.length) return null;

  return (
    <Box title="Next steps">
      {pending.map((s) => (
        <View key={s.id} style={{ marginBottom: 10 }}>
          <Text style={{ color: colors.textPrimary, marginBottom: 6 }}>{s.reason}</Text>
          {navigation && ACTION_ROUTE[s.action] ? (
            <Button
              title={s.action.replace(/_/g, ' ')}
              variant="secondary"
              onPress={() => navigation.navigate(ACTION_ROUTE[s.action])}
            />
          ) : null}
        </View>
      ))}
    </Box>
  );
};
