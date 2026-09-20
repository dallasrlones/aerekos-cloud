import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useProject } from '../../contexts/ProjectContext';
import { projectService } from '../../services/projectService';
import { Input } from '../../components/Input/Input';
import { Button } from '../../components/Button/Button';
import { ProjectFormStyles } from './ProjectForm.styles';
import { colors } from '../../styles/theme';

export const ProjectForm = ({ navigation, route }) => {
  const { mode = 'create', projectId } = route.params || {};
  const { createProject, updateProject } = useProject();
  const [loading, setLoading] = useState(false);
  const [project, setProject] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    enabled: true,
    default_environment: 'dev',
  });
  
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (mode === 'edit' && projectId) {
      loadProject();
    }
  }, [mode, projectId]);

  const loadProject = async () => {
    setLoading(true);
    try {
      const result = await projectService.getProject(projectId);
      if (result.success) {
        const proj = result.project;
        setProject(proj);
        setFormData({
          name: proj.name || '',
          description: proj.description || '',
          enabled: proj.enabled !== undefined ? proj.enabled : true,
        });
      }
    } catch (error) {
      console.error('Error loading project:', error);
      Alert.alert('Error', 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const validate = () => {
    const newErrors = {};
    
    if (!formData.name || formData.name.trim().length < 3) {
      newErrors.name = 'Project name must be at least 3 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }

    setLoading(true);
    try {
      if (mode === 'create') {
        const result = await createProject({
          name: formData.name.trim(),
          description: formData.description.trim(),
          enabled: formData.enabled,
          default_environment: formData.default_environment || 'dev',
          config: { default_environment: formData.default_environment || 'dev' },
        });
        
        if (result.success) {
          // Navigate to project details if created successfully
          navigation.navigate('projectDetails', { projectId: result.project.id });
        } else {
          const errorMessage = result.error || 'Failed to create project';
          Alert.alert(
            'Error Creating Project',
            errorMessage,
            [{ text: 'OK' }]
          );
          // If it's a duplicate name error, clear the name field
          if (errorMessage.includes('already exists') || errorMessage.includes('duplicate')) {
            setFormData({ ...formData, name: '' });
            setErrors({ ...errors, name: 'A project with this name already exists' });
          }
        }
      } else {
        const result = await updateProject(projectId, {
          name: formData.name.trim(),
          description: formData.description.trim(),
          enabled: formData.enabled,
        });
        
        if (result.success) {
          // Navigate back to project details
          navigation.goBack();
        } else {
          Alert.alert('Error', result.error || 'Failed to update project');
        }
      }
    } catch (error) {
      console.error('Error saving project:', error);
      Alert.alert('Error', 'Failed to save project');
    } finally {
      setLoading(false);
    }
  };

  if (loading && mode === 'edit' && !project) {
    return (
      <View style={ProjectFormStyles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={ProjectFormStyles.loadingText}>Loading project...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={ProjectFormStyles.container}
      contentContainerStyle={ProjectFormStyles.content}
    >
      <View style={ProjectFormStyles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={ProjectFormStyles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={ProjectFormStyles.title}>
          {mode === 'create' ? 'Create Project' : 'Edit Project'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <Input
        label="Project Name"
        value={formData.name}
        onChangeText={(text) => {
          setFormData({ ...formData, name: text });
          if (errors.name) {
            setErrors({ ...errors, name: null });
          }
        }}
        placeholder="e.g., development, production"
        error={errors.name}
        required
      />

      <Input
        label="Description"
        value={formData.description}
        onChangeText={(text) => setFormData({ ...formData, description: text })}
        placeholder="Optional project description"
        multiline
        numberOfLines={4}
        style={ProjectFormStyles.descriptionInput}
      />

      {mode === 'create' ? (
        <View style={{ marginBottom: 16 }}>
          <Text style={ProjectFormStyles.toggleLabel}>Starting environment</Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 8 }}>
            Only this environment is created. You can duplicate it later.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {['dev', 'prod'].map((name) => (
              <Button
                key={name}
                title={name}
                variant={formData.default_environment === name ? 'primary' : 'secondary'}
                onPress={() => setFormData({ ...formData, default_environment: name })}
              />
            ))}
          </View>
        </View>
      ) : null}

      <View style={ProjectFormStyles.toggleContainer}>
        <Text style={ProjectFormStyles.toggleLabel}>Enabled</Text>
        <TouchableOpacity
          style={[
            ProjectFormStyles.toggle,
            formData.enabled && ProjectFormStyles.toggleActive
          ]}
          onPress={() => setFormData({ ...formData, enabled: !formData.enabled })}
        >
          <View style={[
            ProjectFormStyles.toggleThumb,
            formData.enabled && ProjectFormStyles.toggleThumbActive
          ]} />
        </TouchableOpacity>
      </View>

      <View style={ProjectFormStyles.actions}>
        <Button
          title="Cancel"
          onPress={() => navigation.goBack()}
          variant="secondary"
          style={ProjectFormStyles.cancelButton}
        />
        <Button
          title={mode === 'create' ? 'Create' : 'Save'}
          onPress={handleSubmit}
          variant="primary"
          loading={loading}
          style={ProjectFormStyles.submitButton}
        />
      </View>
    </ScrollView>
  );
};
