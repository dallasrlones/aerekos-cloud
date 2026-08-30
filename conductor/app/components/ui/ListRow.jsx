import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';
import { StatusPill } from './StatusPill';

export const ListRow = ({
  icon = 'cube-outline',
  title,
  subtitle,
  status,
  onPress,
  right,
}) => (
  <TouchableOpacity
    style={styles.row}
    onPress={onPress}
    activeOpacity={onPress ? 0.7 : 1}
    disabled={!onPress}
  >
    <View style={styles.iconWrap}>
      <Ionicons name={icon} size={20} color={colors.textPrimary} />
    </View>
    <View style={styles.main}>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      {subtitle ? <Text style={styles.sub} numberOfLines={2}>{subtitle}</Text> : null}
    </View>
    {status ? <StatusPill status={status} /> : null}
    {right}
    {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} /> : null}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    minHeight: 56,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: { flex: 1, minWidth: 0 },
  title: { ...typography.body, fontWeight: '500', fontSize: 16 },
  sub: { ...typography.caption, marginTop: 2 },
});
