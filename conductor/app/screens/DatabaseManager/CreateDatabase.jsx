import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Box } from '../../components/Box/Box';
import { Button } from '../../components/Button/Button';
import { dbManagerService } from '../../services/dbManagerService';
import { CreateDatabaseStyles } from './CreateDatabase.styles';
import { colors } from '../../styles/theme';
import { stackService } from '../../services/stackService';
import { useProject } from '../../contexts/ProjectContext';

export const CreateDatabase = ({ navigation }) => {
  const { currentProject, currentEnvironment } = useProject();
  const [formData, setFormData] = useState({
    name: '',
    type: 'sqlite3',
    username: '',
    password: '',
    port: '',
    cpu_cores: '',
    ram_gb: '',
    disk_gb: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Database name is required';
    } else if (formData.name.length < 3) {
      newErrors.name = 'Database name must be at least 3 characters';
    }
    
    if (formData.port && (isNaN(formData.port) || formData.port < 1024 || formData.port > 65535)) {
      newErrors.port = 'Port must be between 1024 and 65535';
    }
    
    if (formData.username && formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }
    
    if (formData.password && formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    
    if (formData.cpu_cores && (isNaN(formData.cpu_cores) || formData.cpu_cores <= 0)) {
      newErrors.cpu_cores = 'CPU cores must be a positive number';
    }
    
    if (formData.ram_gb && (isNaN(formData.ram_gb) || formData.ram_gb <= 0)) {
      newErrors.ram_gb = 'RAM must be a positive number';
    }
    
    if (formData.disk_gb && (isNaN(formData.disk_gb) || formData.disk_gb <= 0)) {
      newErrors.disk_gb = 'Disk must be a positive number';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      if (!currentProject?.id) {
        Alert.alert('Error', 'Select a project first.');
        setLoading(false);
        return;
      }
      const databaseData = {
        name: formData.name.trim(),
        type: formData.type,
        project_id: currentProject.id,
        environment: currentEnvironment || 'prod',
      };

      // Add optional fields
      if (formData.username) databaseData.username = formData.username;
      if (formData.password) databaseData.password = formData.password;
      if (formData.port) databaseData.port = parseInt(formData.port);

      // Add resource limits if provided
      const resourceLimits = {};
      if (formData.cpu_cores) resourceLimits.cpu_cores = parseFloat(formData.cpu_cores);
      if (formData.ram_gb) resourceLimits.ram_gb = parseFloat(formData.ram_gb);
      if (formData.disk_gb) resourceLimits.disk_gb = parseFloat(formData.disk_gb);
      
      if (Object.keys(resourceLimits).length > 0) {
        databaseData.resource_limits = resourceLimits;
      }

      const result = await dbManagerService.createDatabase(databaseData);
      await stackService.record(currentProject?.id, {
        service: 'db_manager',
        resource: { name: formData.name, type: formData.type },
      });
      
      Alert.alert(
        'Success',
        `Database "${formData.name}" created successfully!`,
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('databaseDetails', { databaseName: formData.name })
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to create database');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  return (
    <ScrollView style={CreateDatabaseStyles.container} contentContainerStyle={CreateDatabaseStyles.content}>
      <Text style={CreateDatabaseStyles.title}>Create Database</Text>

      <Box title="Basic Information">
        <View style={CreateDatabaseStyles.field}>
          <Text style={CreateDatabaseStyles.label}>Database Name *</Text>
          <TextInput
            style={[CreateDatabaseStyles.input, errors.name && CreateDatabaseStyles.inputError]}
            value={formData.name}
            onChangeText={(value) => updateField('name', value)}
            placeholder="my-app-db"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            editable={true}
            selectTextOnFocus={false}
          />
          {errors.name && <Text style={CreateDatabaseStyles.errorText}>{errors.name}</Text>}
        </View>

        <View style={CreateDatabaseStyles.field}>
          <Text style={CreateDatabaseStyles.label}>Database Type *</Text>
          <View style={CreateDatabaseStyles.typeContainer}>
            {['sqlite3', 'postgresql', 'mongodb', 'redis', 'neo4j', 'elasticsearch'].map((type) => (
              <Button
                key={type}
                title={type.charAt(0).toUpperCase() + type.slice(1)}
                onPress={() => updateField('type', type)}
                variant={formData.type === type ? 'primary' : 'secondary'}
                style={CreateDatabaseStyles.typeButton}
              />
            ))}
          </View>
        </View>
      </Box>

      <Box title="Credentials (Optional - Auto-generated if not provided)">
        <View style={CreateDatabaseStyles.field}>
          <Text style={CreateDatabaseStyles.label}>Username</Text>
          <TextInput
            style={[CreateDatabaseStyles.input, errors.username && CreateDatabaseStyles.inputError]}
            value={formData.username}
            onChangeText={(value) => updateField('username', value)}
            placeholder="Auto-generated"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            editable={true}
            selectTextOnFocus={false}
          />
          {errors.username && <Text style={CreateDatabaseStyles.errorText}>{errors.username}</Text>}
        </View>

        <View style={CreateDatabaseStyles.field}>
          <Text style={CreateDatabaseStyles.label}>Password</Text>
          <TextInput
            style={[CreateDatabaseStyles.input, errors.password && CreateDatabaseStyles.inputError]}
            value={formData.password}
            onChangeText={(value) => updateField('password', value)}
            placeholder="Auto-generated"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={true}
            selectTextOnFocus={false}
          />
          {errors.password && <Text style={CreateDatabaseStyles.errorText}>{errors.password}</Text>}
        </View>

        <View style={CreateDatabaseStyles.field}>
          <Text style={CreateDatabaseStyles.label}>Port</Text>
          <TextInput
            style={[CreateDatabaseStyles.input, errors.port && CreateDatabaseStyles.inputError]}
            value={formData.port}
            onChangeText={(value) => updateField('port', value)}
            placeholder="Auto-assigned"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
            editable={true}
            selectTextOnFocus={false}
          />
          {errors.port && <Text style={CreateDatabaseStyles.errorText}>{errors.port}</Text>}
        </View>
      </Box>

      <Box title="Resource Limits (Optional)">
        <View style={CreateDatabaseStyles.field}>
          <Text style={CreateDatabaseStyles.label}>CPU Cores</Text>
          <TextInput
            style={[CreateDatabaseStyles.input, errors.cpu_cores && CreateDatabaseStyles.inputError]}
            value={formData.cpu_cores}
            onChangeText={(value) => updateField('cpu_cores', value)}
            placeholder="e.g., 2"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            editable={true}
            selectTextOnFocus={false}
          />
          {errors.cpu_cores && <Text style={CreateDatabaseStyles.errorText}>{errors.cpu_cores}</Text>}
        </View>

        <View style={CreateDatabaseStyles.field}>
          <Text style={CreateDatabaseStyles.label}>RAM (GB)</Text>
          <TextInput
            style={[CreateDatabaseStyles.input, errors.ram_gb && CreateDatabaseStyles.inputError]}
            value={formData.ram_gb}
            onChangeText={(value) => updateField('ram_gb', value)}
            placeholder="e.g., 4"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            editable={true}
            selectTextOnFocus={false}
          />
          {errors.ram_gb && <Text style={CreateDatabaseStyles.errorText}>{errors.ram_gb}</Text>}
        </View>

        <View style={CreateDatabaseStyles.field}>
          <Text style={CreateDatabaseStyles.label}>Disk (GB)</Text>
          <TextInput
            style={[CreateDatabaseStyles.input, errors.disk_gb && CreateDatabaseStyles.inputError]}
            value={formData.disk_gb}
            onChangeText={(value) => updateField('disk_gb', value)}
            placeholder="e.g., 50"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
            editable={true}
            selectTextOnFocus={false}
          />
          {errors.disk_gb && <Text style={CreateDatabaseStyles.errorText}>{errors.disk_gb}</Text>}
        </View>
      </Box>

      <View style={CreateDatabaseStyles.buttonContainer}>
        <Button
          title="Create Database"
          onPress={handleSubmit}
          loading={loading}
          disabled={loading}
        />
        <Button
          title="Cancel"
          onPress={() => navigation.goBack()}
          variant="secondary"
          style={CreateDatabaseStyles.cancelButton}
        />
      </View>
    </ScrollView>
  );
};

