import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { Input } from '../../components/Input/Input';
import { Button } from '../../components/Button/Button';
import { AnimusBackground } from '../../components/Animus';
import { useTheme } from '../../contexts/ThemeContext';
import { LoginStyles } from './Login.styles';

export const Login = ({ navigation }) => {
  const { login, loading, error: authError } = useAuth();
  const { colors, animus } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async () => {
    // Clear previous errors
    setError('');
    
    // Validate inputs
    if (!username.trim()) {
      setError('Username is required');
      return;
    }
    
    if (!password.trim()) {
      setError('Password is required');
      return;
    }

    // Attempt login
    const result = await login(username.trim(), password, totp.trim() || undefined);
    
    if (!result.success) {
      setError(result.error || 'Login failed');
    }
    // Navigation will be handled by AuthProvider state change
  };

  return (
    <KeyboardAvoidingView
      style={[LoginStyles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <AnimusBackground scanlines />
      <ScrollView
        contentContainerStyle={LoginStyles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={LoginStyles.content}>
          {/* Logo/Title */}
          <View style={LoginStyles.header}>
            <Text style={[LoginStyles.title, { color: animus.gold }]}>
              AEREKOS CLOUD
            </Text>
            <Text style={[LoginStyles.subtitle, { color: colors.textSecondary }]}>
              Conductor
            </Text>
          </View>

          {/* Login Form */}
          <View style={LoginStyles.form}>
            <Input
              label="Username"
              value={username}
              onChangeText={setUsername}
              placeholder="Enter your username"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry
            />

            <Input
              label="TOTP (if enabled)"
              value={totp}
              onChangeText={setTotp}
              placeholder="6-digit code"
              keyboardType="number-pad"
              autoCapitalize="none"
            />

            {(error || authError) && (
              <View style={LoginStyles.errorContainer}>
                <Text style={LoginStyles.errorText}>
                  {error || authError}
                </Text>
              </View>
            )}

            <Button
              title="Login"
              onPress={handleLogin}
              variant="primary"
              loading={loading}
              disabled={loading}
              style={LoginStyles.loginButton}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
