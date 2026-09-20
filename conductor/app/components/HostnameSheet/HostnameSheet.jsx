import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { FormSheet } from '../ui';
import { Input } from '../Input/Input';
import { Button } from '../Button/Button';
import { joinHostname } from '../../utils/tunnelAttachments';
import { colors, spacing } from '../../styles/theme';

export const HostnameSheet = ({
  visible,
  title,
  initial,
  zones = [],
  onClose,
  onSave,
  busy = false,
  error = null,
}) => {
  const [subdomain, setSubdomain] = useState('');
  const [domain, setDomain] = useState('aerekos.com');
  const [port, setPort] = useState('');

  useEffect(() => {
    if (!visible) return;
    setSubdomain(initial?.subdomain || '');
    setDomain(initial?.domain || (zones[0]?.name) || 'aerekos.com');
    setPort(String(initial?.port || ''));
  }, [visible, initial, zones]);

  const preview = useMemo(() => joinHostname(subdomain, domain), [subdomain, domain]);

  return (
    <FormSheet
      visible={visible}
      title={title || 'Hostname'}
      onClose={onClose}
      footer={(
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          <Button title="Cancel" variant="secondary" onPress={onClose} />
          <Button
            title="Save"
            loading={busy}
            onPress={() => onSave({ subdomain, domain, port, hostname: preview })}
          />
        </View>
      )}
    >
      <Input label="Subdomain" value={subdomain} onChangeText={setSubdomain} placeholder="assistant" />
      <Input label="Domain" value={domain} onChangeText={setDomain} placeholder="aerekos.com" />
      {zones.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {zones.map((z) => (
            <Button
              key={z.id || z.name}
              title={z.name}
              variant={domain === z.name ? 'primary' : 'secondary'}
              onPress={() => setDomain(z.name)}
            />
          ))}
        </View>
      ) : null}
      <Input
        label="Origin port"
        value={port}
        onChangeText={setPort}
        placeholder="4200"
        keyboardType="number-pad"
      />
      <Text style={{ color: colors.textMuted, marginBottom: 8 }}>
        Public name: {preview || '—'}
        {port ? ` → localhost:${port}` : ''}
        {String(port) === '22' ? ' (ssh)' : ''}
      </Text>
      {error ? <Text style={{ color: colors.error || '#c62828' }}>{error}</Text> : null}
    </FormSheet>
  );
};
