import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';

const TABS = [
  { id: 'dashboard', label: 'Home', icon: 'home', screen: 'dashboard' },
  { id: 'devices', label: 'Devices', icon: 'planet-outline', screen: 'devices' },
  { id: 'search', label: 'Search', icon: 'search', screen: '__search' },
  { id: 'menu', label: 'More', icon: 'menu-outline', screen: 'menu' },
];

export const BottomTabs = ({ currentScreen, navigation, onSearch }) => {
  const { colors, animus, spacing, isDark } = useTheme();
  return (
    <View style={{
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: animus.glassBorder,
      backgroundColor: isDark ? colors.surface : colors.background,
      paddingBottom: Platform.OS === 'ios' ? 20 : spacing.sm,
      paddingTop: spacing.xs,
    }}
    >
      {TABS.map((t) => {
        const active = t.screen !== '__search' && currentScreen === t.screen;
        return (
          <TouchableOpacity
            key={t.id}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 52, gap: 2 }}
            onPress={() => {
              if (t.screen === '__search') onSearch?.();
              else navigation?.navigate(t.screen);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name={t.icon} size={22} color={active ? animus.gold : colors.textMuted} />
            <Text style={{
              fontSize: 11,
              color: active ? colors.textPrimary : colors.textMuted,
              fontWeight: active ? '600' : '400',
            }}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default BottomTabs;
