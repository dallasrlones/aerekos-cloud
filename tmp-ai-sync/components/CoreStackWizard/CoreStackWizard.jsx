import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Box } from '../Box/Box';
import { Button } from '../Button/Button';
import { setupService } from '../../services/setupService';
import { projectService } from '../../services/projectService';
import { getServiceLabel } from '../../services/serviceCatalog';
import { colors } from '../../styles/theme';
import { CoreStackWizardStyles as S } from './CoreStackWizard.styles';

/**
 * Project-level core stack wizard (key → secrets → auth → storage).
 */
export const CoreStackWizard = ({ projectId, navigation, onComplete }) => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      setSummary(await setupService.getProjectSummary(projectId));
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load setup');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleEnableStack = async () => {
    setEnabling(true);
    setError(null);
    try {
      await projectService.enableCoreStack(projectId);
      await load();
      onComplete?.();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Enable failed');
    } finally {
      setEnabling(false);
    }
  };

  if (!projectId) return null;
  if (loading && !summary) {
    return <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />;
  }

  const core = summary?.core_stack;
  const pct = core?.percent ?? 0;
  const complete = pct >= 100;

  return (
    <Box title="Recommended stack">
      <Text style={S.hint}>
        Enable the core platform in order: Key Management → Secrets → Authentication → Object Storage.
      </Text>
      <View style={S.progressRow}>
        <Text style={S.progressLabel}>Core stack</Text>
        <Text style={S.progressPct}>{pct}%</Text>
      </View>
      <View style={S.progressBar}>
        <View style={[S.progressFill, { width: `${pct}%` }]} />
      </View>
      {(core?.services || []).map((name) => {
        const item = (summary?.services || []).find((s) => s.service === name);
        const done = item?.wizardComplete;
        return (
          <Text key={name} style={S.stepRow}>
            {done ? '✅' : '○'} {getServiceLabel(name)}
            {item ? ` — ${item.percent}%` : ''}
          </Text>
        );
      })}
      {error ? <Text style={S.error}>{error}</Text> : null}
      {!complete ? (
        <Button title="Enable recommended stack" onPress={handleEnableStack} loading={enabling} />
      ) : (
        <Text style={S.done}>Core stack complete.</Text>
      )}
      <Button
        title="Open Secrets Manager"
        variant="secondary"
        onPress={() => navigation?.navigate('serviceSecretsList')}
      />
    </Box>
  );
};
