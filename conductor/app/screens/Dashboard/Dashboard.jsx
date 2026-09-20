import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useProject } from '../../contexts/ProjectContext';
import { Button } from '../../components/Button/Button';
import { Page } from '../../components/ui';
import { DashboardStyles as S } from './Dashboard.styles';
import { colors } from '../../styles/theme';
import { SystemHome } from '../SystemHome/SystemHome';
import { ProjectEnvHome } from '../ProjectEnvHome/ProjectEnvHome';

export const Dashboard = ({ navigation }) => {
  const {
    projects,
    loading: projectsLoading,
    isLoading: projectSwitching,
    isSystemProject,
  } = useProject();

  if (projectSwitching) {
    return (
      <View style={[S.container, S.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={S.loadingText}>Switching project...</Text>
      </View>
    );
  }

  if (!projectsLoading && projects.length === 0) {
    return (
      <Page title="Welcome" subtitle="Projects organize your services and devices.">
        <View style={S.emptyState}>
          <Text style={S.emptyStateDescription}>
            Create your first project to get started.
          </Text>
          <Button
            title="Create Project"
            onPress={() => navigation.navigate('projectForm', { mode: 'create' })}
            style={S.createButton}
          />
        </View>
      </Page>
    );
  }

  if (isSystemProject) {
    return <SystemHome navigation={navigation} />;
  }

  return <ProjectEnvHome navigation={navigation} />;
};
