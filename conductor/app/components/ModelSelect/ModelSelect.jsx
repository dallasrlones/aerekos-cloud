import React from 'react';
import { Platform, View } from 'react-native';
import { Button } from '../Button/Button';
import { colors } from '../../styles/theme';

export function ModelSelect({ models = [], value, onChange, placeholder = 'Select model' }) {
  const names = models.map((m) => (typeof m === 'string' ? m : m.name)).filter(Boolean);
  if (Platform.OS === 'web') {
    return (
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 8,
          padding: 8,
          fontSize: 14,
          color: colors.textPrimary,
          backgroundColor: colors.cardBackground,
          marginBottom: 8,
          width: '100%',
        }}
      >
        <option value="">{placeholder}</option>
        {names.map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
    );
  }
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
      <Button
        title={placeholder}
        variant={!value ? 'primary' : 'secondary'}
        onPress={() => onChange('')}
      />
      {names.map((n) => (
        <Button
          key={n}
          title={n}
          variant={value === n ? 'primary' : 'secondary'}
          onPress={() => onChange(n)}
        />
      ))}
    </View>
  );
}
