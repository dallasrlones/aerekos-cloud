import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FormSheet } from '../ui/FormSheet';
import { Button } from '../Button/Button';
import { projectService } from '../../services/projectService';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';

export const IacHookupSheet = ({ visible, projectId, status, onClose, onDone }) => {
  const [mode, setMode] = useState(status?.mode || 'conductor');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    if (!projectId) return;
    setBusy(true);
    setError(null);
    try {
      const data = await projectService.hookupIac(projectId, { mode, repo: 'infra' });
      if (data && data.hooked_up === false) {
        setError(data.error || 'Hookup failed — IaC manager is not healthy');
        return;
      }
      onDone?.();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.response?.data?.error || err.message || 'Hookup failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormSheet
      visible={visible}
      title="Hook up Infrastructure as Code"
      onClose={onClose}
      footer={<Button title="Hook up" onPress={run} loading={busy} />}
    >
      <Text style={styles.hint}>
        IaC is always on for this project. Choose where the stack lives.
      </Text>
      {(status?.missing || []).includes('manager') ? (
        <Text style={styles.warn}>The IaC manager is down — Hook up will enable and deploy it.</Text>
      ) : null}
      <TouchableOpacity
        style={[styles.choice, mode === 'conductor' && styles.choiceOn]}
        onPress={() => setMode('conductor')}
      >
        <Text style={styles.choiceTitle}>Console only</Text>
        <Text style={styles.choiceBody}>Keep stack.json in the conductor. No git repo required.</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.choice, mode === 'git' && styles.choiceOn]}
        onPress={() => setMode('git')}
      >
        <Text style={styles.choiceTitle}>Git repo (infra)</Text>
        <Text style={styles.choiceBody}>Enable Git, create or use the infra repo, and commit stack.json.</Text>
      </TouchableOpacity>
      {error ? <Text style={styles.err}>{error}</Text> : null}
    </FormSheet>
  );
};

const styles = StyleSheet.create({
  hint: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
  warn: { ...typography.caption, color: colors.warning, marginBottom: spacing.md },
  choice: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  choiceOn: { borderColor: colors.accent, backgroundColor: 'rgba(212,175,55,0.08)' },
  choiceTitle: { ...typography.body, fontWeight: '600' },
  choiceBody: { ...typography.caption, marginTop: 4 },
  err: { color: colors.error, marginTop: spacing.sm },
});
