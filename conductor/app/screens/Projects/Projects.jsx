import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useProject } from '../../contexts/ProjectContext';
import { Box } from '../../components/Box/Box';
import { Button } from '../../components/Button/Button';
import { ProjectsStyles } from './Projects.styles';
import { colors } from '../../styles/theme';

export const Projects = ({ navigation }) => {
  const { projects, currentProject, loading, refreshProjects } = useProject();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    refreshProjects();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshProjects();
    setRefreshing(false);
  };

  const handleProjectPress = (projectId) => {
    navigation.navigate('projectDetails', { projectId });
  };

  const handleCreateProject = () => {
    navigation.navigate('projectForm', { mode: 'create' });
  };

  if (loading) {
    return (
      <View style={ProjectsStyles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={ProjectsStyles.loadingText}>Loading projects...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={ProjectsStyles.container}
      contentContainerStyle={ProjectsStyles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={ProjectsStyles.header}>
        <Text style={ProjectsStyles.title}>Projects</Text>
        <Button
          title="Create Project"
          onPress={handleCreateProject}
          variant="primary"
        />
      </View>

      {projects.length === 0 ? (
        <Box title="No Projects">
          <View style={ProjectsStyles.emptyState}>
            <Text style={ProjectsStyles.emptyText}>
              You haven't created any projects yet.
            </Text>
            <Button
              title="Create Your First Project"
              onPress={handleCreateProject}
              variant="primary"
              style={ProjectsStyles.createButton}
            />
          </View>
        </Box>
      ) : (
        projects.map((project) => (
          <TouchableOpacity
            key={project.id}
            style={[
              ProjectsStyles.projectCard,
              currentProject?.id === project.id && ProjectsStyles.projectCardActive
            ]}
            onPress={() => handleProjectPress(project.id)}
          >
            <View style={ProjectsStyles.projectHeader}>
              <View style={ProjectsStyles.projectInfo}>
                <Text style={ProjectsStyles.projectName}>
                  {project.name}
                  {currentProject?.id === project.id && (
                    <Text style={ProjectsStyles.currentBadge}> (Current)</Text>
                  )}
                </Text>
                {project.description && (
                  <Text style={ProjectsStyles.projectDescription} numberOfLines={2}>
                    {project.description}
                  </Text>
                )}
              </View>
              <Ionicons
                name="chevron-forward"
                size={24}
                color={colors.textMuted}
              />
            </View>
            <View style={ProjectsStyles.projectStats}>
              <View style={ProjectsStyles.stat}>
                <Text style={ProjectsStyles.statValue}>{project.workerCount || 0}</Text>
                <Text style={ProjectsStyles.statLabel}>Workers</Text>
              </View>
              <View style={ProjectsStyles.stat}>
                <Text style={ProjectsStyles.statValue}>{project.serviceCount || 0}</Text>
                <Text style={ProjectsStyles.statLabel}>Services</Text>
              </View>
              <View style={ProjectsStyles.stat}>
                <Text style={ProjectsStyles.statValue}>{project.deploymentCount || 0}</Text>
                <Text style={ProjectsStyles.statLabel}>Deployments</Text>
              </View>
              <View style={ProjectsStyles.stat}>
                <View style={[
                  ProjectsStyles.statusBadge,
                  project.enabled ? ProjectsStyles.statusBadgeEnabled : ProjectsStyles.statusBadgeDisabled
                ]}>
                  <Text style={ProjectsStyles.statusText}>
                    {project.enabled ? 'Enabled' : 'Disabled'}
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
};
