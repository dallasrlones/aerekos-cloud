import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { ProjectSwitcher } from '../ProjectSwitcher/ProjectSwitcher';
import { EnvSwitcher } from '../EnvSwitcher/EnvSwitcher';
import { GlobalSearch } from '../GlobalSearch/GlobalSearch';
import { NotificationBell } from '../NotificationBell/NotificationBell';
import { IcarusOverlay } from './IcarusOverlay';
import { useBreakpoint } from '../../hooks/useBreakpoint';

export const Header = ({ navigation, currentScreen, searchOpen, setSearchOpen }) => {
  const { compact } = useBreakpoint();
  const { colors, animus, spacing, borderRadius, shadows, isDark } = useTheme();
  const [localSearch, setLocalSearch] = useState(false);
  const [icarusOpen, setIcarusOpen] = useState(false);
  const open = searchOpen ?? localSearch;
  const setOpen = setSearchOpen || setLocalSearch;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  const goBack = () => {
    if (currentScreen === 'dashboard') return;
    if (navigation?.goBack) navigation.goBack();
    else navigation?.navigate('dashboard');
  };

  const container = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: isDark ? colors.surface : colors.background,
    borderBottomWidth: 1,
    borderBottomColor: animus.glassBorder,
    ...shadows.small,
    width: '100%',
    zIndex: 1000,
    ...Platform.select({
      ios: { paddingTop: spacing.md + 8 },
      android: { paddingTop: spacing.md },
      web: { paddingTop: spacing.md },
    }),
  };

  const iconBtn = {
    padding: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 44,
    minHeight: 44,
  };

  const searchBox = {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    height: 40,
  };

  return (
    <View style={container}>
      {compact ? (
        <TouchableOpacity
          style={iconBtn}
          onPress={currentScreen === 'dashboard' ? () => navigation?.navigate('menu') : goBack}
          activeOpacity={0.7}
        >
          <Ionicons
            name={currentScreen === 'dashboard' ? 'menu-outline' : 'chevron-back'}
            size={24}
            color={colors.textPrimary}
          />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={iconBtn}
          onPress={() => currentScreen !== 'dashboard' && navigation?.navigate('dashboard')}
          activeOpacity={0.7}
        >
          <Ionicons name="home" size={24} color={animus.gold} />
        </TouchableOpacity>
      )}

      <View style={{
        flex: 1,
        minWidth: 0,
        marginHorizontal: spacing.xs,
        flexDirection: 'row',
        alignItems: 'center',
      }}
      >
        <ProjectSwitcher navigation={navigation} />
        <EnvSwitcher variant="header" />
      </View>

      {!compact ? (
        <TouchableOpacity style={searchBox} onPress={() => setOpen(true)} activeOpacity={0.8}>
          <Ionicons name="search" size={20} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
          <Text style={{ flex: 1, fontSize: 14, color: colors.textMuted }}>
            Search services… {Platform.OS === 'web' ? '(⌘K)' : ''}
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={iconBtn} onPress={() => setOpen(true)} activeOpacity={0.7}>
          <Ionicons name="search" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={iconBtn}
        onPress={() => {
          setOpen(false);
          setIcarusOpen(true);
        }}
        activeOpacity={0.7}
        accessibilityLabel="Talk to Icarus"
      >
        <Ionicons name="mic-outline" size={24} color={animus.gold} />
      </TouchableOpacity>
      <TouchableOpacity
        style={iconBtn}
        onPress={() => {
          setOpen(false);
          setIcarusOpen(false);
          if (currentScreen !== 'icarus') navigation?.navigate('icarus', { section: 'chat' });
        }}
        activeOpacity={0.7}
        accessibilityLabel="Icarus chat"
      >
        <Ionicons name="sparkles-outline" size={24} color={animus.gold} />
      </TouchableOpacity>

      <TouchableOpacity
        style={iconBtn}
        onPress={() => {
          setOpen(false);
          navigation?.navigate('icarusFriends', { section: 'friends' });
        }}
        activeOpacity={0.7}
        accessibilityLabel="Friends"
      >
        <Ionicons name="people-outline" size={24} color={colors.textPrimary} />
      </TouchableOpacity>

      <NotificationBell navigation={navigation} />

      {!compact ? (
        <>
          <TouchableOpacity
            style={iconBtn}
            onPress={() => currentScreen !== 'gitManager' && navigation?.navigate('gitManager')}
            activeOpacity={0.7}
            accessibilityLabel="Git"
          >
            <Ionicons name="git-branch-outline" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={iconBtn}
            onPress={() => currentScreen !== 'adonis' && navigation?.navigate('adonis')}
            activeOpacity={0.7}
            accessibilityLabel="Icarus IDE"
          >
            <Ionicons name="code-slash-outline" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={iconBtn}
            onPress={() => currentScreen !== 'settings' && navigation?.navigate('settings')}
            activeOpacity={0.7}
          >
            <Ionicons name="settings" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={iconBtn}
            onPress={() => currentScreen !== 'menu' && navigation?.navigate('menu')}
            activeOpacity={0.7}
          >
            <Ionicons name="menu-outline" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </>
      ) : null}

      <GlobalSearch visible={open} onClose={() => setOpen(false)} navigation={navigation} />
      <IcarusOverlay visible={icarusOpen} onClose={() => setIcarusOpen(false)} navigation={navigation} />
    </View>
  );
};

export default Header;
