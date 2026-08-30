import React, { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { FormSheet } from '../ui/FormSheet';
import { Button } from '../Button/Button';
import { projectService } from '../../services/projectService';
import { colors, spacing, typography } from '../../styles/theme';

export const EdgeHookupSheet = ({ visible, projectId, status, onClose, onDone, navigation }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const missingSecrets = (status?.missing || []).filter((m) => m.startsWith('cloudflare_'));

  const run = async () => {
    if (!projectId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await projectService.hookupEdge(projectId);
      if (res?.missing?.length && !res.hooked_up) {
        setError(res.message || 'Missing Cloudflare secrets');
        return;
      }
      onDone?.();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Hookup failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormSheet
      visible={visible}
      title="Hook up tunnels and DNS"
      onClose={onClose}
      footer={(
        <>
          {missingSecrets.length ? (
            <Button
              title="Open Secrets"
              variant="secondary"
              onPress={() => {
                onClose?.();
                navigation?.navigate('keyManager');
              }}
            />
          ) : (
            <Button title="Hook up" onPress={run} loading={busy} />
          )}
        </>
      )}
    >
      <Text style={styles.hint}>
        Uses this project’s existing secrets cloudflare_api_token and cloudflare_account_id.
        This does not create a Cloudflare account.
      </Text>
      {missingSecrets.length ? (
        <Text style={styles.warn}>
          Missing secrets: {missingSecrets.join(', ')}. Add them in Secrets, then come back.
        </Text>
      ) : (
        <Text style={styles.ok}>Secrets look present. Hook up enables tunnel_manager and domain_manager.</Text>
      )}
      {error ? <Text style={styles.err}>{error}</Text> : null}
    </FormSheet>
  );
};

const styles = StyleSheet.create({
  hint: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
  warn: { ...typography.caption, color: colors.warning, marginBottom: spacing.md },
  ok: { ...typography.caption, color: colors.success, marginBottom: spacing.md },
  err: { color: colors.error, marginTop: spacing.sm },
});
