import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useProject } from '../../contexts/ProjectContext';
import { useTheme } from '../../contexts/ThemeContext';

export const ProjectSwitcher = ({ navigation }) => {
  const { currentProject, projects, isLoading, setCurrentProject } = useProject();
  const { colors, spacing, shadows, borderRadius } = useTheme();
  const [dropdownVisible, setDropdownVisible] = useState(false);

  const styles = {
    container: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      minWidth: 80,
      maxWidth: '100%',
      flex: 1,
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    projectName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
      marginRight: spacing.xs,
      flex: 1,
    },
    chevron: { marginLeft: spacing.xs },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-start',
      paddingTop: Platform.select({ ios: 100, android: 80, web: 60 }),
      paddingHorizontal: spacing.md,
    },
    dropdown: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      maxHeight: 400,
      ...shadows.large,
    },
    scrollView: { maxHeight: 400 },
    emptyState: {
      padding: spacing.lg,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 14,
      color: colors.textMuted,
    },
    projectItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    projectItemActive: {
      backgroundColor: colors.surfaceHover,
    },
    projectItemText: {
      fontSize: 14,
      color: colors.textPrimary,
      flex: 1,
    },
    projectItemTextActive: {
      color: colors.accent,
      fontWeight: '600',
    },
    createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      marginTop: spacing.xs,
    },
    createIcon: { marginRight: spacing.sm },
    createText: {
      fontSize: 14,
      color: colors.accent,
      fontWeight: '600',
    },
  };

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

  return (
    <>
      <TouchableOpacity
        style={styles.container}
        onPress={() => setDropdownVisible(true)}
        activeOpacity={0.7}
      >
        <View style={styles.content}>
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <>
              <Text style={styles.projectName} numberOfLines={1}>
                {displayName}
              </Text>
              <Ionicons
                name={dropdownVisible ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={colors.textSecondary}
                style={styles.chevron}
              />
            </>
          )}
        </View>
      </TouchableOpacity>

      <Modal
        visible={dropdownVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDropdownVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setDropdownVisible(false)}
        >
          <View style={styles.dropdown}>
            <ScrollView style={styles.scrollView}>
              {projects.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No projects yet</Text>
                </View>
              ) : (
                projects.map((project) => (
                  <TouchableOpacity
                    key={project.id}
                    style={[
                      styles.projectItem,
                      currentProject?.id === project.id && styles.projectItemActive,
                    ]}
                    onPress={() => handleProjectSelect(project.id)}
                  >
                    <Text
                      style={[
                        styles.projectItemText,
                        currentProject?.id === project.id && styles.projectItemTextActive,
                      ]}
                    >
                      {project.name}
                    </Text>
                    {currentProject?.id === project.id ? (
                      <Ionicons name="checkmark" size={20} color={colors.accent} />
                    ) : null}
                  </TouchableOpacity>
                ))
              )}

              <TouchableOpacity style={styles.createButton} onPress={handleCreateProject}>
                <Ionicons
                  name="add-circle-outline"
                  size={20}
                  color={colors.accent}
                  style={styles.createIcon}
                />
                <Text style={styles.createText}>Create Project</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};
