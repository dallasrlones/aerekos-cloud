import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { Input } from '../../components/Input/Input';
import { Button } from '../../components/Button/Button';
import { authService } from '../../services/authService';
import { deviceService } from '../../services/deviceService';
import { SettingsStyles } from './Settings.styles';
import { colors } from '../../styles/theme';

export const Settings = ({ navigation }) => {
  const { user, checkAuth } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [registrationToken, setRegistrationToken] = useState(null);
  const [tokenVisible, setTokenVisible] = useState(false);
  const [tokenLoading, setTokenLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setEmail(user.email || '');
    }
    loadRegistrationToken();
  }, [user]);

  const loadRegistrationToken = async () => {
    setTokenLoading(true);
    try {
      const token = await deviceService.getRegistrationToken();
      setRegistrationToken(token);
    } catch (error) {
      console.error('Failed to load registration token:', error);
    } finally {
      setTokenLoading(false);
    }
  };

  const handleRegenerateToken = async () => {
    setTokenLoading(true);
    try {
      const newToken = await deviceService.regenerateToken();
      setRegistrationToken(newToken);
      setTokenVisible(true); // Show new token
    } catch (error) {
      console.error('Failed to regenerate token:', error);
    } finally {
      setTokenLoading(false);
    }
  };

  const validateProfileForm = () => {
    setProfileError('');
    setProfileSuccess('');

    if (!username.trim()) {
      setProfileError('Username is required');
      return false;
    }

    if (username.trim().length < 3) {
      setProfileError('Username must be at least 3 characters long');
      return false;
    }

    if (!email.trim()) {
      setProfileError('Email is required');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setProfileError('Invalid email format');
      return false;
    }

    return true;
  };

  const handleUpdateProfile = async () => {
    if (!validateProfileForm()) {
      return;
    }

    setProfileLoading(true);
    setProfileError('');
    setProfileSuccess('');

    try {
      const result = await authService.updateProfile(username.trim(), email.trim());

      if (result.success) {
        setProfileSuccess('Profile updated successfully');
        // Refresh user data to get updated info
        await checkAuth();
      } else {
        setProfileError(result.error || 'Failed to update profile');
      }
    } catch (err) {
      setProfileError(err.message || 'An error occurred');
    } finally {
      setProfileLoading(false);
    }
  };

  const validatePasswordForm = () => {
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword.trim()) {
      setPasswordError('Current password is required');
      return false;
    }

    if (!newPassword.trim()) {
      setPasswordError('New password is required');
      return false;
    }

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long');
      return false;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return false;
    }

    if (currentPassword === newPassword) {
      setPasswordError('New password must be different from current password');
      return false;
    }

    return true;
  };

  const handleResetPassword = async () => {
    if (!validatePasswordForm()) {
      return;
    }

    setPasswordLoading(true);
    setPasswordError('');
    setPasswordSuccess('');

    try {
      const result = await authService.resetPassword(currentPassword, newPassword);

      if (result.success) {
        setPasswordSuccess('Password updated successfully');
        // Clear form
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordError(result.error || 'Failed to update password');
      }
    } catch (err) {
      setPasswordError(err.message || 'An error occurred');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={SettingsStyles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={SettingsStyles.scrollView}
        contentContainerStyle={SettingsStyles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title Section */}
        <View style={SettingsStyles.titleSection}>
          <Text style={SettingsStyles.titleText}>Settings</Text>
        </View>

        {/* Registration Token Card */}
        <View style={SettingsStyles.card}>
          <Text style={SettingsStyles.cardTitle}>Registration Token</Text>
          
          {tokenLoading && !registrationToken ? (
            <Text style={SettingsStyles.loadingText}>Loading token...</Text>
          ) : registrationToken ? (
            <View style={SettingsStyles.tokenSection}>
              <View style={SettingsStyles.tokenRow}>
                <Text style={SettingsStyles.tokenText} selectable>
                  {tokenVisible ? registrationToken : '•'.repeat(36)}
                </Text>
                <TouchableOpacity
                  onPress={() => setTokenVisible(!tokenVisible)}
                  style={SettingsStyles.toggleButton}
                >
                  <Ionicons
                    name={tokenVisible ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.textPrimary}
                  />
                </TouchableOpacity>
              </View>
              <Text style={SettingsStyles.tokenHint}>
                Use this token to register worker devices. Copy it to your worker's .env file.
              </Text>
              <Button
                title="Regenerate Token"
                onPress={handleRegenerateToken}
                variant="secondary"
                loading={tokenLoading}
                disabled={tokenLoading}
                style={SettingsStyles.regenerateButton}
              />
            </View>
          ) : (
            <Text style={SettingsStyles.errorText}>Failed to load token</Text>
          )}
        </View>

        {/* Profile Card */}
        <View style={SettingsStyles.card}>
          <Text style={SettingsStyles.cardTitle}>Profile Information</Text>
          
          <View style={SettingsStyles.form}>
            <Input
              label="Username"
              value={username}
              onChangeText={setUsername}
              placeholder="Enter your username"
              autoCapitalize="none"
              autoCorrect={false}
              style={SettingsStyles.input}
            />

            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={SettingsStyles.input}
            />

            {profileError && (
              <View style={SettingsStyles.messageContainer}>
                <Text style={SettingsStyles.errorText}>{profileError}</Text>
              </View>
            )}

            {profileSuccess && (
              <View style={[SettingsStyles.messageContainer, SettingsStyles.successContainer]}>
                <Text style={SettingsStyles.successText}>{profileSuccess}</Text>
              </View>
            )}

            <Button
              title="Update Profile"
              onPress={handleUpdateProfile}
              variant="primary"
              loading={profileLoading}
              disabled={profileLoading}
              style={SettingsStyles.submitButton}
            />
          </View>
        </View>

        {/* Password Reset Card */}
        <View style={SettingsStyles.card}>
          <Text style={SettingsStyles.cardTitle}>Change Password</Text>
          
          <View style={SettingsStyles.form}>
            <Input
              label="Current Password"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Enter your current password"
              secureTextEntry
              style={SettingsStyles.input}
            />

            <Input
              label="New Password"
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Enter your new password"
              secureTextEntry
              style={SettingsStyles.input}
            />

            <Input
              label="Confirm New Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm your new password"
              secureTextEntry
              style={SettingsStyles.input}
            />

            {passwordError && (
              <View style={SettingsStyles.messageContainer}>
                <Text style={SettingsStyles.errorText}>{passwordError}</Text>
              </View>
            )}

            {passwordSuccess && (
              <View style={[SettingsStyles.messageContainer, SettingsStyles.successContainer]}>
                <Text style={SettingsStyles.successText}>{passwordSuccess}</Text>
              </View>
            )}

            <Button
              title="Update Password"
              onPress={handleResetPassword}
              variant="primary"
              loading={passwordLoading}
              disabled={passwordLoading}
              style={SettingsStyles.submitButton}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

