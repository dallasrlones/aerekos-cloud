import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { MenuStyles } from './Menu.styles';
import { colors } from '../../styles/theme';

export const Menu = ({ navigation }) => {
  const { user, logout } = useAuth();

  const handleSignOut = async () => {
    await logout();
  };

  const handleBack = () => {
    navigation?.goBack();
  };

  return (
    <ScrollView
      style={MenuStyles.container}
      contentContainerStyle={MenuStyles.content}
    >
      {/* Header */}
      <View style={MenuStyles.header}>
        <TouchableOpacity
          style={MenuStyles.backButton}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={MenuStyles.title}>Menu</Text>
        <View style={MenuStyles.placeholder} />
      </View>

      {/* User Info */}
      {user && (
        <View style={MenuStyles.userSection}>
          <Text style={MenuStyles.username}>{user.username || 'User'}</Text>
          <Text style={MenuStyles.email}>{user.email || ''}</Text>
        </View>
      )}

      {/* Menu Items */}
      <View style={MenuStyles.menuSection}>
        <TouchableOpacity
          style={MenuStyles.menuItem}
          onPress={handleSignOut}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={24} color={colors.textPrimary} />
          <Text style={MenuStyles.menuItemText}>Sign Out</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

