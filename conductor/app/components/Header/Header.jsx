import React from 'react';
import { View, TextInput, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HeaderStyles } from './Header.styles';
import { colors } from '../../styles/theme';

export const Header = ({ navigation, currentScreen }) => {
  const handleHomePress = () => {
    if (navigation && currentScreen !== 'dashboard') {
      navigation.navigate('dashboard');
    }
  };

  const handleNotificationsPress = () => {
    // Placeholder for notifications - will be implemented later
    console.log('Notifications pressed');
  };

  const handleSettingsPress = () => {
    if (navigation && currentScreen !== 'settings') {
      navigation.navigate('settings');
    }
  };

  const handleMenuPress = () => {
    if (navigation && currentScreen !== 'menu') {
      navigation.navigate('menu');
    }
  };

  return (
    <View style={HeaderStyles.container}>
      {/* Home Icon - Left */}
      <TouchableOpacity
        style={HeaderStyles.iconButton}
        onPress={handleHomePress}
        activeOpacity={0.7}
      >
        <Ionicons
          name="home"
          size={24}
          color={colors.textPrimary}
        />
      </TouchableOpacity>

      {/* Search Bar - Center */}
      <View style={HeaderStyles.searchContainer}>
        <Ionicons
          name="search"
          size={20}
          color={HeaderStyles.searchIcon.color}
          style={HeaderStyles.searchIcon}
        />
        <TextInput
          style={HeaderStyles.searchInput}
          placeholder="Search..."
          placeholderTextColor={HeaderStyles.placeholder.color}
          editable={false}
        />
      </View>

      {/* Notification Icon - Right */}
      <TouchableOpacity
        style={HeaderStyles.iconButton}
        onPress={handleNotificationsPress}
        activeOpacity={0.7}
      >
        <Ionicons
          name="notifications-sharp"
          size={24}
          color={colors.textPrimary}
        />
      </TouchableOpacity>

      {/* Gear Icon - Right */}
      <TouchableOpacity
        style={HeaderStyles.iconButton}
        onPress={handleSettingsPress}
        activeOpacity={0.7}
      >
        <Ionicons
          name="settings"
          size={24}
          color={colors.textPrimary}
        />
      </TouchableOpacity>

      {/* Burger Menu - Far Right */}
      <TouchableOpacity
        style={HeaderStyles.iconButton}
        onPress={handleMenuPress}
        activeOpacity={0.7}
      >
        <Ionicons
          name="menu-outline"
          size={24}
          color={colors.textPrimary}
        />
      </TouchableOpacity>
    </View>
  );
};

