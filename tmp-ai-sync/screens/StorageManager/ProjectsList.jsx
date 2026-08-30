import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, TextInput, Alert } from 'react-native';
import { ProjectCard } from '../../components/ProjectCard/ProjectCard';
import { storageManagerService } from '../../services/storageManagerService';
import { ProjectsListStyles } from './ProjectsList.styles';

export const ProjectsList = ({ navigation }) => {
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    filterProjects();
  }, [projects, searchQuery]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const response = await storageManagerService.getProjects();
      setProjects(response.projects || []);
      setError(null);
    } catch (err) {
      console.error('Error loading projects:', err);
      setError(err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const filterProjects = () => {
    let filtered = [...projects];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(project =>
        project.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredProjects(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProjects();
    setRefreshing(false);
  };

  const handleProjectPress = (projectId) => {
    navigation.navigate('bucketsList', { projectId });
  };

  const handleDelete = async (projectId, projectName) => {
    Alert.alert(
      'Delete Project',
      `Are you sure you want to delete project "${projectName}"? This will delete all buckets and files in this project.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await storageManagerService.deleteProject(projectId);
              await loadProjects();
            } catch (err) {
              Alert.alert('Error', `Failed to delete project: ${err.message}`);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={ProjectsListStyles.container}>
      {/* Header */}
      <View style={ProjectsListStyles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={ProjectsListStyles.backButton}
        >
          <Text style={ProjectsListStyles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={ProjectsListStyles.title}>Projects</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('createProject')}
          style={ProjectsListStyles.createButton}
        >
          <Text style={ProjectsListStyles.createButtonText}>+ Create</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={ProjectsListStyles.searchContainer}>
        <TextInput
          style={ProjectsListStyles.searchInput}
          placeholder="Search projects..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
      </View>

      {/* Projects List */}
      <ScrollView
        style={ProjectsListStyles.list}
        contentContainerStyle={ProjectsListStyles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <Text style={ProjectsListStyles.loadingText}>Loading projects...</Text>
        ) : error ? (
          <Text style={ProjectsListStyles.errorText}>{error}</Text>
        ) : filteredProjects.length === 0 ? (
          <View style={ProjectsListStyles.emptyState}>
            <Text style={ProjectsListStyles.emptyStateText}>No projects found</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('createProject')}
              style={ProjectsListStyles.emptyStateButton}
            >
              <Text style={ProjectsListStyles.emptyStateButtonText}>Create Your First Project</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredProjects.map((projectData) => (
            <ProjectCard
              key={projectData.id}
              projectData={projectData}
              onPress={() => handleProjectPress(projectData.id)}
              onDelete={handleDelete}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
};
