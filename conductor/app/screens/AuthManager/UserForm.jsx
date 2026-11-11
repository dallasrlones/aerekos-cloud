import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, Alert, ActivityIndicator, Switch, Platform } from 'react-native';
import { Box } from '../../components/Box/Box';
import { Button } from '../../components/Button/Button';
import { authManagerService } from '../../services/authManagerService';
import { useProject } from '../../contexts/ProjectContext';
import { colors } from '../../styles/theme';
import { UserFormStyles as S } from './UserForm.styles';

/**
 * Create OR edit a user in the password-grant user system (e.g. aerekos-tv
 * accounts). Edit mode is active when route params include a userId. The
 * password is only settable here — blank on edit keeps the current one.
 */
export const UserForm = ({ navigation, route }) => {
  const userId = route?.params?.userId;
  const isEdit = !!userId;
  const { currentProject } = useProject();
  const projectId = currentProject?.id;

  const [form, setForm] = useState({
    username: '',
    password: '',
    name: '',
    display_color: '',
    enabled: true,
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);

  const loadUser = useCallback(async () => {
    if (!isEdit || !projectId) return;
    try {
      const u = await authManagerService.getUser(projectId, userId);
      setForm({
        username: u.username || '',
        password: '',
        name: u.name || '',
        display_color: u.display_color || '',
        enabled: u.enabled !== false,
      });
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error?.message || err.message || 'Failed to load user');
    } finally {
      setFetching(false);
    }
  }, [isEdit, projectId, userId]);

  useEffect(() => { loadUser(); }, [loadUser]);

  const update = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const validate = () => {
    const e = {};
    if (!isEdit && !form.username.trim()) e.username = 'Username is required';
    if (!isEdit && !form.password) e.password = 'Password is required';
    if (form.display_color.trim() && !/^#[0-9a-fA-F]{6}$/.test(form.display_color.trim())) {
      e.display_color = 'Color must be hex, e.g. #e50914';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!projectId) {
      Alert.alert('No project', 'Select a project before adding a user.');
      return;
    }
    if (!validate()) return;

    setLoading(true);
    try {
      if (isEdit) {
        const data = {
          name: form.name.trim(),
          display_color: form.display_color.trim(),
          enabled: form.enabled,
        };
        if (form.password) data.password = form.password;
        await authManagerService.updateUser(projectId, userId, data);
      } else {
        await authManagerService.createUser(projectId, {
          username: form.username.trim(),
          password: form.password,
          name: form.name.trim(),
          display_color: form.display_color.trim(),
        });
      }
      navigation.goBack();
    } catch (error) {
      const msg = error.response?.data?.error?.message || error.message || 'Failed to save user';
      Alert.alert('Error', /taken/i.test(msg) ? 'That username is already taken.' : msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete user', `Delete "${form.username}"? They will no longer be able to sign in.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await authManagerService.deleteUser(projectId, userId);
            navigation.goBack();
          } catch (err) {
            Alert.alert('Error', err.response?.data?.error?.message || err.message || 'Failed to delete user');
          }
        },
      },
    ]);
  };

  if (fetching) {
    return (
      <View style={[S.container, S.center]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={S.container} contentContainerStyle={S.content}>
      <Text style={S.title}>{isEdit ? `Edit user: ${form.username}` : 'Add user'}</Text>
      <Text style={S.subtitle}>
        Accounts for this project sign in with username + password (used by apps like aerekos tv).
      </Text>

      <Box title="Account">
        <View style={S.field}>
          <Text style={S.label}>Username {isEdit ? '' : '*'}</Text>
          <TextInput
            style={[S.input, !isEdit && errors.username && S.inputError, isEdit && S.inputDisabled]}
            value={form.username}
            onChangeText={(v) => update('username', v)}
            placeholder="dallas"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isEdit}
          />
          {errors.username && <Text style={S.errorText}>{errors.username}</Text>}
          {isEdit && <Text style={S.help}>The username can't be changed here — delete and re-create to rename.</Text>}
        </View>

        <View style={S.field}>
          <Text style={S.label}>Password {isEdit ? '' : '*'}</Text>
          <TextInput
            style={[S.input, errors.password && S.inputError]}
            value={form.password}
            onChangeText={(v) => update('password', v)}
            placeholder={isEdit ? 'Leave blank to keep the current password' : 'Pick a password'}
            placeholderTextColor={colors.textMuted}
            secureTextEntry
          />
          {errors.password && <Text style={S.errorText}>{errors.password}</Text>}
        </View>

        <View style={S.field}>
          <Text style={S.label}>Display name</Text>
          <TextInput
            style={S.input}
            value={form.name}
            onChangeText={(v) => update('name', v)}
            placeholder="Optional — defaults to the username"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View style={S.field}>
          <Text style={S.label}>Display color</Text>
          <TextInput
            style={[S.input, errors.display_color && S.inputError]}
            value={form.display_color}
            onChangeText={(v) => update('display_color', v)}
            placeholder="#e50914"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {errors.display_color && <Text style={S.errorText}>{errors.display_color}</Text>}
          {form.display_color && (
            <View style={{ height: 16, borderRadius: 4, marginTop: 8, backgroundColor: form.display_color, width: 64 }} />
          )}
        </View>
      </Box>

      {isEdit && (
        <Box title="Status">
          <View style={S.rowToggle}>
            <Switch
              value={form.enabled}
              onValueChange={(v) => update('enabled', v)}
              trackColor={{ true: colors.accent, false: colors.border }}
              ios_backgroundColor={colors.border}
            />
            <Text style={S.label}>{form.enabled ? 'Enabled — can sign in' : 'Disabled — sign-in blocked'}</Text>
          </View>
        </Box>
      )}

      <View style={S.buttons}>
        <Button title={isEdit ? 'Save changes' : 'Add user'} onPress={handleSubmit} loading={loading} disabled={loading} />
        {isEdit && <Button title="Delete user" onPress={handleDelete} variant="danger" style={S.cancel} />}
        <Button title="Cancel" onPress={() => navigation.goBack()} variant="secondary" style={S.cancel} />
      </View>
    </ScrollView>
  );
};
