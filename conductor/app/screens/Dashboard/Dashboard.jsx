import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useProject } from '../../contexts/ProjectContext';
import { Button } from '../../components/Button/Button';
import { DashboardStyles as S } from './Dashboard.styles';
import { useTheme } from '../../contexts/ThemeContext';
import { AnimusPage, AnimusEmpty, AnimusBackground } from '../../components/Animus';
import { SystemHome } from '../SystemHome/SystemHome';
import { ProjectEnvHome } from '../ProjectEnvHome/ProjectEnvHome';

export const Dashboard = ({ navigation }) => {
  const {
    projects,
    loading: projectsLoading,
    isLoading: projectSwitching,
    isSystemProject,
  } = useProject();
  const { colors, animus } = useTheme();

  if (projectSwitching) {
    return (
      <View style={[S.container, S.loadingContainer, { backgroundColor: colors.background }]}>
        <AnimusBackground />
        <ActivityIndicator size="large" color={animus.gold} />
        <Text style={[S.loadingText, { color: colors.textSecondary }]}>Switching project...</Text>
      </View>
    );
  }

  if (!projectsLoading && projects.length === 0) {
    return (
      <AnimusPage title="Welcome" job="Projects organize your services and devices." metaphor="station">
        <AnimusEmpty
          metaphor="station"
          title="No projects yet"
          hint="Create your first project to enter the command layer."
          ctaLabel="Create Project"
          onPress={() => navigation.navigate('projectForm', { mode: 'create' })}
        />
      </AnimusPage>
    );
  }

  if (isSystemProject) {
    return <SystemHome navigation={navigation} />;
  }

  return <ProjectEnvHome navigation={navigation} />;
};
