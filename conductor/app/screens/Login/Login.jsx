import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { Input } from '../../components/Input/Input';
import { Button } from '../../components/Button/Button';
import { AnimatedBackground } from '../../components/AnimatedBackground/AnimatedBackground';
import { LoginStyles } from './Login.styles';

export const Login = ({ navigation }) => {
  const { login, loading, error: authError } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
    const result = await login(username.trim(), password);
    
    if (!result.success) {
      setError(result.error || 'Login failed');
    }
    // Navigation will be handled by AuthProvider state change
  };

  return (
    <KeyboardAvoidingView
      style={LoginStyles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <AnimatedBackground />
      <ScrollView
        contentContainerStyle={LoginStyles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={LoginStyles.content}>
          {/* Logo/Title */}
          <View style={LoginStyles.header}>
            <Text style={LoginStyles.title}>
              AEREKOS CLOUD
            </Text>
            <Text style={LoginStyles.subtitle}>
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
