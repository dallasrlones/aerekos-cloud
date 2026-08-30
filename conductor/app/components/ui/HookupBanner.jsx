import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../../styles/theme';

export const HookupBanner = ({
  title,
  body,
  actionLabel = 'Hook up',
  onPress,
}) => (
  <View style={styles.wrap}>
    <Ionicons name="alert-circle-outline" size={22} color={colors.warning} />
    <View style={styles.main}>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
    {onPress ? (
      <TouchableOpacity style={styles.btn} onPress={onPress} activeOpacity={0.8}>
        <Text style={styles.btnText}>{actionLabel}</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: 'rgba(233,168,37,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(233,168,37,0.45)',
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  main: { flex: 1, minWidth: 0 },
  title: { ...typography.body, fontWeight: '600', fontSize: 15 },
  body: { ...typography.caption, marginTop: 2 },
  btn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
