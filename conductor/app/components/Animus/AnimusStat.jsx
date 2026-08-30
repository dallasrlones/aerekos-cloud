import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { animus, colors } from '../../styles/theme';

/**
 * A single HUD readout: label / big mono value (+ unit) / sub-line.
 * Used both as floating cards over the 3D scene and inside list panels.
 */
export const AnimusStat = ({ label, value, unit, sub, size = 'md', align = 'left' }) => {
  const valueSize = size === 'lg' ? 30 : size === 'sm' ? 18 : 24;
  return (
    <View style={{ alignItems: align === 'right' ? 'flex-end' : 'flex-start' }}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.valueRow, align === 'right' && { justifyContent: 'flex-end' }]}>
        <Text style={[styles.value, { fontSize: valueSize, lineHeight: valueSize + 4 }]}>{value}</Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.textMuted,
    fontFamily: animus.mono,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 2,
  },
  value: {
    fontWeight: '400',
    color: colors.textPrimary,
    fontFamily: animus.mono,
  },
  unit: {
    fontSize: 12,
    color: animus.gold,
    fontFamily: animus.mono,
    marginLeft: 4,
    marginBottom: 3,
    fontWeight: '700',
  },
  sub: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: animus.mono,
    marginTop: 1,
  },
});

export default AnimusStat;
