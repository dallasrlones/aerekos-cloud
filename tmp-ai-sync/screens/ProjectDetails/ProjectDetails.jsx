import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, Alert, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useProject } from '../../contexts/ProjectContext';
import { projectService } from '../../services/projectService';
import { Box } from '../../components/Box/Box';
import { Button } from '../../components/Button/Button';
import { ServiceConfigModal } from '../../components/ServiceConfigModal/ServiceConfigModal';
import { ScalingPolicyModal } from '../../components/ScalingPolicyModal/ScalingPolicyModal';
import { AddServiceModal } from '../../components/AddServiceModal/AddServiceModal';
import { AddWorkerModal } from '../../components/AddWorkerModal/AddWorkerModal';
import { ProjectDetailsStyles } from './ProjectDetails.styles';
import { colors } from '../../styles/theme';

// Service Item Component
const ServiceItem = ({ service, projectId, onRefresh, navigation }) => {
  const [enabled, setEnabled] = useState(service.enabled === 1 || service.enabled === true);
  const [loading, setLoading] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showScalingModal, setShowScalingModal] = useState(false);

  // Navigate to service detail page based on service name
  const handleServiceClick = () => {
    const serviceName = service.name?.toLowerCase().replace(/_/g, '-');
    if (serviceName === 'key-manager' || serviceName === 'key_manager') {
      navigation.navigate('keyManager');
    } else if (serviceName === 'storage-manager' || serviceName === 'storage_manager') {
      navigation.navigate('storageManager');
    } else if (serviceName === 'db-manager' || serviceName === 'db_manager') {
      // Future: db_manager detail page
      console.log('DB Manager detail page not yet implemented');
    }
  };

  const handleToggle = async () => {
    setLoading(true);
    try {
      let result;
      if (enabled) {
        result = await projectService.disableServiceForProject(projectId, service.id);
      } else {
        result = await projectService.enableServiceForProject(projectId, service.id);
      }

      if (result.success) {
        setEnabled(!enabled);
        Alert.alert(
          'Success',
          enabled
            ? `Service "${service.name}" disabled. All deployments stopped.`
            : `Service "${service.name}" enabled. Deployed to ${result.deployments?.length || 0} worker(s).`,
          [{ text: 'OK' }]
        );
        onRefresh();
      } else {
        Alert.alert('Error', result.error || 'Failed to update service');
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to update service');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <TouchableOpacity 
        style={ProjectDetailsStyles.listItem}
        onPress={handleServiceClick}
        activeOpacity={0.7}
      >
        <View style={ProjectDetailsStyles.listItemContent}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={ProjectDetailsStyles.listItemTitle}>{service.name}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </View>
              <Text style={ProjectDetailsStyles.listItemSubtitle}>{service.docker_image}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, flexWrap: 'wrap', gap: 8 }}>
                <View style={[
                  ProjectDetailsStyles.statusBadge,
                  enabled ? ProjectDetailsStyles.statusBadgeEnabled : ProjectDetailsStyles.statusBadgeDisabled,
                ]}>
                  <Text style={ProjectDetailsStyles.statusText}>
                    {enabled ? 'Enabled' : 'Disabled'}
                  </Text>
                </View>
                {enabled && (
                  <>
                    <TouchableOpacity
                      onPress={() => setShowConfigModal(true)}
                      style={ProjectDetailsStyles.actionButton}
                    >
                      <Ionicons name="settings-outline" size={16} color={colors.textSecondary} />
                      <Text style={ProjectDetailsStyles.actionButtonText}>Config</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setShowScalingModal(true)}
                      style={ProjectDetailsStyles.actionButton}
                    >
                      <Ionicons name="trending-up-outline" size={16} color={colors.textSecondary} />
                      <Text style={ProjectDetailsStyles.actionButtonText}>Scaling</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {loading ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Switch
                  value={enabled}
                  onValueChange={handleToggle}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor={colors.background}
                />
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>

      <ServiceConfigModal
        visible={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        projectId={projectId}
        serviceId={service.id}
        serviceName={service.name}
        currentConfig={service.config}
      />

      <ScalingPolicyModal
        visible={showScalingModal}
        onClose={() => setShowScalingModal(false)}
        projectId={projectId}
        serviceId={service.id}
        serviceName={service.name}
        currentPolicy={service.scaling_policy}
      />
    </>
  );
};

export const ProjectDetails = ({ navigation, route }) => {
  const { projectId, isDashboard = false } = route.params || {};
  const { currentProject, setCurrentProject, deleteProject } = useProject();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [showAddWorkerModal, setShowAddWorkerModal] = useState(false);

  useEffect(() => {
    loadProject();
  }, [projectId]);

  const loadProject = async () => {
    setLoading(true);
    try {
      const result = await projectService.getProject(projectId);
      if (result.success) {
        setProject(result.project);
      }
    } catch (error) {
      console.error('Error loading project:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProject();
    setRefreshing(false);
  };

  const handleEdit = () => {
    navigation.navigate('projectForm', { mode: 'edit', projectId: project.id });
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Project',
      `Are you sure you want to delete "${project.name}"? This will flag all deployments as orphaned and send cleanup instructions to workers.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteProject(project.id);
            if (result.success) {
              navigation.goBack();
            } else {
              Alert.alert('Error', result.error || 'Failed to delete project');
            }
          },
        },
      ]
    );
  };

  const handleSetAsCurrent = async () => {
    await setCurrentProject(project.id);
  };

  if (loading) {
    return (
      <View style={ProjectDetailsStyles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={ProjectDetailsStyles.loadingText}>Loading project...</Text>
      </View>
    );
  }

  if (!project) {
    return (
      <View style={ProjectDetailsStyles.errorContainer}>
        <Text style={ProjectDetailsStyles.errorText}>Project not found</Text>
        <Button
          title="Go Back"
          onPress={() => navigation.goBack()}
          variant="primary"
        />
      </View>
    );
  }

  const isCurrentProject = currentProject?.id === project.id;

  return (
    <ScrollView
      style={ProjectDetailsStyles.container}
      contentContainerStyle={ProjectDetailsStyles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={ProjectDetailsStyles.header}>
        {!isDashboard && (
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={ProjectDetailsStyles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        )}
        <Text style={ProjectDetailsStyles.title}>{project.name}</Text>
        <View style={ProjectDetailsStyles.headerActions}>
          <TouchableOpacity
            onPress={handleEdit}
            style={ProjectDetailsStyles.iconButton}
          >
            <Ionicons name="create-outline" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Project Info */}
      <Box title="Project Information">
        <View style={ProjectDetailsStyles.infoRow}>
          <Text style={ProjectDetailsStyles.infoLabel}>Name:</Text>
          <Text style={ProjectDetailsStyles.infoValue}>{project.name}</Text>
        </View>
        {project.description && (
          <View style={ProjectDetailsStyles.infoRow}>
            <Text style={ProjectDetailsStyles.infoLabel}>Description:</Text>
            <Text style={ProjectDetailsStyles.infoValue}>{project.description}</Text>
          </View>
        )}
        <View style={ProjectDetailsStyles.infoRow}>
          <Text style={ProjectDetailsStyles.infoLabel}>Status:</Text>
          <View style={[
            ProjectDetailsStyles.statusBadge,
            project.enabled ? ProjectDetailsStyles.statusBadgeEnabled : ProjectDetailsStyles.statusBadgeDisabled
          ]}>
            <Text style={ProjectDetailsStyles.statusText}>
              {project.enabled ? 'Enabled' : 'Disabled'}
            </Text>
          </View>
        </View>
        <View style={ProjectDetailsStyles.infoRow}>
          <Text style={ProjectDetailsStyles.infoLabel}>Created:</Text>
          <Text style={ProjectDetailsStyles.infoValue}>
            {new Date(project.created_at).toLocaleDateString()}
          </Text>
        </View>
      </Box>

      {/* Actions - Hidden when used as dashboard */}
      {!isDashboard && (
        <Box title="Actions">
          {!isCurrentProject && (
            <Button
              title="Set as Current Project"
              onPress={handleSetAsCurrent}
              variant="primary"
              style={ProjectDetailsStyles.actionButton}
            />
          )}
          <Button
            title="Edit Project"
            onPress={handleEdit}
            variant="secondary"
            style={ProjectDetailsStyles.actionButton}
          />
          <Button
            title="Delete Project"
            onPress={handleDelete}
            variant="secondary"
            style={[ProjectDetailsStyles.actionButton, ProjectDetailsStyles.deleteButton]}
          />
        </Box>
      )}

      {/* Workers */}
      <Box title={`Workers (${project.workers?.length || 0})`}>
        <Button
          title="Add Workers"
          onPress={() => setShowAddWorkerModal(true)}
          variant="secondary"
          style={ProjectDetailsStyles.addButton}
        />
        {project.workers && project.workers.length > 0 ? (
          project.workers.map((worker) => (
            <TouchableOpacity
              key={worker.id}
              style={ProjectDetailsStyles.listItem}
              onPress={() => navigation.navigate('deviceDetails', { deviceId: worker.id })}
            >
              <View style={ProjectDetailsStyles.listItemContent}>
                <Text style={ProjectDetailsStyles.listItemTitle}>{worker.hostname}</Text>
                <Text style={ProjectDetailsStyles.listItemSubtitle}>{worker.ip_address}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          ))
        ) : (
          <Text style={ProjectDetailsStyles.emptyText}>No workers assigned</Text>
        )}
      </Box>

      {/* Services */}
      <Box title={`Services (${project.services?.length || 0})`}>
        <Button
          title="Add Services"
          onPress={() => setShowAddServiceModal(true)}
          variant="secondary"
          style={ProjectDetailsStyles.addButton}
        />
        {project.services && project.services.length > 0 ? (
          project.services.map((service) => (
            <ServiceItem
              key={service.id}
              service={service}
              projectId={project.id}
              onRefresh={loadProject}
              navigation={navigation}
            />
          ))
        ) : (
          <Text style={ProjectDetailsStyles.emptyText}>No services assigned</Text>
        )}
      </Box>

      {/* Modals */}
      <AddServiceModal
        visible={showAddServiceModal}
        onClose={() => setShowAddServiceModal(false)}
        projectId={project.id}
        onServiceAdded={loadProject}
      />

      <AddWorkerModal
        visible={showAddWorkerModal}
        onClose={() => setShowAddWorkerModal(false)}
        projectId={project.id}
        onWorkerAdded={loadProject}
      />

      {/* Deployments */}
      <Box title={`Deployments (${project.deployments?.length || 0})`}>
        {project.deployments && project.deployments.length > 0 ? (
          project.deployments.map((deployment) => (
            <View key={deployment.id} style={ProjectDetailsStyles.listItem}>
              <View style={ProjectDetailsStyles.listItemContent}>
                <Text style={ProjectDetailsStyles.listItemTitle}>
                  Deployment #{deployment.id}
                </Text>
                <Text style={ProjectDetailsStyles.listItemSubtitle}>
                  Status: {deployment.status} | {deployment.deployed_at ? new Date(deployment.deployed_at).toLocaleString() : 'N/A'}
                </Text>
                {deployment.orphaned && (
                  <Text style={ProjectDetailsStyles.orphanedBadge}>Orphaned</Text>
                )}
              </View>
            </View>
          ))
        ) : (
          <Text style={ProjectDetailsStyles.emptyText}>No deployments</Text>
        )}
      </Box>
    </ScrollView>
  );
};
