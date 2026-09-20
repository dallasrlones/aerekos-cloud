import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';

/**
 * One horizontal scrolling chip row. Reuses AI Manager chip styles. Do not wrap.
 */
export const ScreenTabs = ({ tabs = [], active, onChange, testID }) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    style={styles.scroll}
    contentContainerStyle={styles.row}
    testID={testID}
  >
    {tabs.map((t) => {
      const id = t.id || t;
      const label = t.label || t;
      const icon = t.icon;
      const on = active === id;
      return (
        <TouchableOpacity
          key={id}
          style={[styles.tab, on && styles.tabActive]}
          onPress={() => onChange(id)}
          activeOpacity={0.7}
          accessibilityRole="button"
        >
          {icon ? <Ionicons name={icon} size={14} color={on ? colors.primary : colors.textMuted} /> : null}
          <Text style={[styles.tabText, on && styles.tabTextActive]}>{label}</Text>
        </TouchableOpacity>
      );
    })}
  </ScrollView>
);

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, marginBottom: spacing.md },
  row: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: spacing.xs,
    paddingRight: spacing.md,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  tabActive: { borderColor: colors.primary, backgroundColor: colors.surface },
  tabText: { ...typography.caption },
  tabTextActive: { color: colors.primary, fontWeight: '600' },
});

export default ScreenTabs;
