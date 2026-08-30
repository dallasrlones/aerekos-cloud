import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../styles/theme';

const TABS = [
  { id: 'dashboard', label: 'Home', icon: 'home', screen: 'dashboard' },
  { id: 'devices', label: 'Devices', icon: 'server-outline', screen: 'devices' },
  { id: 'search', label: 'Search', icon: 'search', screen: '__search' },
  { id: 'menu', label: 'More', icon: 'menu-outline', screen: 'menu' },
];

export const BottomTabs = ({ currentScreen, navigation, onSearch }) => (
  <View style={styles.bar}>
    {TABS.map((t) => {
      const active = t.screen !== '__search' && currentScreen === t.screen;
      return (
        <TouchableOpacity
          key={t.id}
          style={styles.tab}
          onPress={() => {
            if (t.screen === '__search') onSearch?.();
            else navigation?.navigate(t.screen);
          }}
          activeOpacity={0.7}
        >
          <Ionicons name={t.icon} size={22} color={active ? colors.primary : colors.textMuted} />
          <Text style={[styles.label, active && styles.labelOn]}>{t.label}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.background,
    paddingBottom: Platform.OS === 'ios' ? 20 : spacing.sm,
    paddingTop: spacing.xs,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 52, gap: 2 },
  label: { fontSize: 11, color: colors.textMuted },
  labelOn: { color: colors.textPrimary, fontWeight: '600' },
});
