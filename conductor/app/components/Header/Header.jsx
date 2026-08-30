import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HeaderStyles } from './Header.styles';
import { colors } from '../../styles/theme';
import { ProjectSwitcher } from '../ProjectSwitcher/ProjectSwitcher';
import { GlobalSearch } from '../GlobalSearch/GlobalSearch';
import { NotificationBell } from '../NotificationBell/NotificationBell';
import { useBreakpoint } from '../../hooks/useBreakpoint';

export const Header = ({ navigation, currentScreen, searchOpen, setSearchOpen }) => {
  const { compact } = useBreakpoint();
  const [localSearch, setLocalSearch] = useState(false);
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

  return (
    <View style={HeaderStyles.container}>
      {compact ? (
        <TouchableOpacity
          style={HeaderStyles.iconButton}
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
          style={HeaderStyles.iconButton}
          onPress={() => currentScreen !== 'dashboard' && navigation?.navigate('dashboard')}
          activeOpacity={0.7}
        >
          <Ionicons name="home" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      )}

      <View style={HeaderStyles.switcherWrap}>
        <ProjectSwitcher navigation={navigation} />
      </View>

      {!compact ? (
        <TouchableOpacity
          style={HeaderStyles.searchContainer}
          onPress={() => setOpen(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="search" size={20} color={HeaderStyles.searchIcon.color} style={HeaderStyles.searchIcon} />
          <Text style={[HeaderStyles.searchInput, { color: HeaderStyles.placeholder.color }]}>
            Search services… {Platform.OS === 'web' ? '(⌘K)' : ''}
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={HeaderStyles.iconButton} onPress={() => setOpen(true)} activeOpacity={0.7}>
          <Ionicons name="search" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      )}

      <NotificationBell navigation={navigation} />

      {!compact ? (
        <>
          <TouchableOpacity
            style={HeaderStyles.iconButton}
            onPress={() => currentScreen !== 'settings' && navigation?.navigate('settings')}
            activeOpacity={0.7}
          >
            <Ionicons name="settings" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={HeaderStyles.iconButton}
            onPress={() => currentScreen !== 'menu' && navigation?.navigate('menu')}
            activeOpacity={0.7}
          >
            <Ionicons name="menu-outline" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </>
      ) : null}

      <GlobalSearch visible={open} onClose={() => setOpen(false)} navigation={navigation} />
    </View>
  );
};
