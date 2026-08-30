import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useProject } from '../../contexts/ProjectContext';
import { ProjectSwitcherStyles } from './ProjectSwitcher.styles';
import { colors } from '../../styles/theme';

export const ProjectSwitcher = ({ navigation }) => {
  const { currentProject, projects, isLoading, setCurrentProject, createProject } = useProject();
  const [dropdownVisible, setDropdownVisible] = useState(false);

  const handleProjectSelect = async (projectId) => {
    setDropdownVisible(false);
    if (projectId !== currentProject?.id) {
      await setCurrentProject(projectId);
    }
  };

  const handleCreateProject = () => {
    setDropdownVisible(false);
    if (navigation) {
      navigation.navigate('projectForm', { mode: 'create' });
    }
  };

  const displayName = currentProject?.name || 'No Project';
  const hasProjects = projects.length > 0;

  return (
    <>
      <TouchableOpacity
        style={ProjectSwitcherStyles.container}
        onPress={() => setDropdownVisible(true)}
        activeOpacity={0.7}
      >
        <View style={ProjectSwitcherStyles.content}>
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <>
              <Text style={ProjectSwitcherStyles.projectName} numberOfLines={1}>
                {displayName}
              </Text>
              <Ionicons
                name={dropdownVisible ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={colors.textSecondary}
                style={ProjectSwitcherStyles.chevron}
              />
            </>
          )}
        </View>
      </TouchableOpacity>

      <Modal
        visible={dropdownVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDropdownVisible(false)}
      >
        <TouchableOpacity
          style={ProjectSwitcherStyles.modalOverlay}
          activeOpacity={1}
          onPress={() => setDropdownVisible(false)}
        >
          <View style={ProjectSwitcherStyles.dropdown}>
            <ScrollView style={ProjectSwitcherStyles.scrollView}>
              {projects.length === 0 ? (
                <View style={ProjectSwitcherStyles.emptyState}>
                  <Text style={ProjectSwitcherStyles.emptyText}>
                    No projects yet
                  </Text>
                </View>
              ) : (
                projects.map((project) => (
                  <TouchableOpacity
                    key={project.id}
                    style={[
                      ProjectSwitcherStyles.projectItem,
                      currentProject?.id === project.id && ProjectSwitcherStyles.projectItemActive
                    ]}
                    onPress={() => handleProjectSelect(project.id)}
                  >
                    <Text
                      style={[
                        ProjectSwitcherStyles.projectItemText,
                        currentProject?.id === project.id && ProjectSwitcherStyles.projectItemTextActive
                      ]}
                    >
                      {project.name}
                    </Text>
                    {currentProject?.id === project.id && (
                      <Ionicons
                        name="checkmark"
                        size={20}
                        color={colors.accent}
                      />
                    )}
                  </TouchableOpacity>
                ))
              )}
              
              {/* Create Project Option */}
              <TouchableOpacity
                style={ProjectSwitcherStyles.createButton}
                onPress={handleCreateProject}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={20}
                  color={colors.accent}
                  style={ProjectSwitcherStyles.createIcon}
                />
                <Text style={ProjectSwitcherStyles.createText}>
                  Create Project
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};
