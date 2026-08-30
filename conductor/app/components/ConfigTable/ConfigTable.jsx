import React from 'react';
import { View, Text } from 'react-native';
import { ConfigTableStyles as S } from './ConfigTable.styles';

/**
 * AWS-style configuration table (env vars). Runtime values when provided.
 */
export const ConfigTable = ({ rows = [], values = {}, note }) => (
  <View>
    {note ? <Text style={S.note}>{note}</Text> : null}
    {rows.map((row) => (
      <View key={row.key} style={S.row}>
        <Text style={S.key}>{row.key}</Text>
        <Text style={S.desc}>{row.desc}</Text>
        {values[row.key] != null && values[row.key] !== '' ? (
          <Text style={S.value} numberOfLines={2}>{String(values[row.key])}</Text>
        ) : (
          <Text style={S.unset}>—</Text>
        )}
      </View>
    ))}
  </View>
);
