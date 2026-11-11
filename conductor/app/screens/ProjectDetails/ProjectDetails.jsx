import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, Alert, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useProject } from '../../contexts/ProjectContext';
import { projectService } from '../../services/projectService';
import { deviceService } from '../../services/deviceService';
import { managerService } from '../../services/managerService';
import { Box } from '../../components/Box/Box';
import { Button } from '../../components/Button/Button';
import { ServiceConfigModal } from '../../components/ServiceConfigModal/ServiceConfigModal';
import { ScalingPolicyModal } from '../../components/ScalingPolicyModal/ScalingPolicyModal';
import { AddServiceModal } from '../../components/AddServiceModal/AddServiceModal';
import { AddWorkerModal } from '../../components/AddWorkerModal/AddWorkerModal';
import { InfraTab } from '../../components/InfraTab/InfraTab';
import { getServiceMeta } from '../../services/serviceCatalog';
import { ProjectDetailsStyles } from './ProjectDetails.styles';
import { colors } from '../../styles/theme';
import { HookupBanner } from '../../components/ui';
import { IacHookupSheet } from '../../components/IacHookup/IacHookupSheet';
import { ScreenTabs } from '../../components/ScreenTabs/ScreenTabs';

// Service Item Component
const ServiceItem = ({ service, projectId, onRefresh, navigation, placement }) => {
  const [enabled, setEnabled] = useState(service.enabled === 1 || service.enabled === true);
  const [loading, setLoading] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showScalingModal, setShowScalingModal] = useState(false);

  // Navigate to service detail page based on service name
  const handleServiceClick = () => {
    const raw = service.name || '';
    const meta = getServiceMeta(raw) || getServiceMeta(raw.replace(/-/g, '_'));
    if (meta?.route) {
      navigation.navigate(meta.route);
    } else {
      navigation.navigate('managerConsole', { serviceName: meta?.name || raw.replace(/-/g, '_') });
    }
  };

  const handleToggle = async () => {
    setLoading(true);
    try {
      let result;
      if (enabled) {
        result = await projectService.disableServiceForProject(projectId, service.id);
      } else {
        const devices = await deviceService.getDevices().catch(() => []);
        const online = (devices || []).filter((d) => d.status === 'online');
        let workerId = null;
        if (online.length && typeof window !== 'undefined' && window.prompt) {
          const names = online.map((d, i) => `${i + 1}. ${d.display_name || d.hostname}`).join('\n');
          const pick = window.prompt(`Device for ${service.name} (blank = auto-place)\n${names}`);
          const idx = Number(pick) - 1;
          if (Number.isInteger(idx) && online[idx]) workerId = online[idx].id;
        }
        result = await projectService.enableServiceForProject(projectId, service.id, workerId);
      }

      if (result.success) {
        setEnabled(!enabled);
        Alert.alert(
          'Success',
          enabled
            ? `Service "${service.name}" detached from this project. The shared instance is still running.`
            : (result.skipped_deploy || result.attached
              ? `Service "${service.name}" attached to the shared instance.`
              : `Service "${service.name}" enabled.`),
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
              <Text style={ProjectDetailsStyles.listItemSubtitle}>
                {placement?.device
                  ? `${service.name} · shared · ${placement.device}`
                  : service.docker_image}
              </Text>
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
  const [iacStatus, setIacStatus] = useState(null);
  const [iacSheet, setIacSheet] = useState(false);
  const [tab, setTab] = useState('info');
  const [placements, setPlacements] = useState({});

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
      try { setIacStatus(await projectService.getIacStatus(projectId)); } catch { setIacStatus(null); }
      try {
        const rows = await managerService.listServices();
        const map = {};
        (rows || []).forEach((s) => { if (s?.name) map[s.name] = s; });
        setPlacements(map);
      } catch {
        setPlacements({});
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
      {iacStatus && iacStatus.hooked_up === false ? (
        <HookupBanner
          title="Infrastructure as Code isn’t hooked up"
          body="Choose git (infra repo + stack.json) or keep the stack in the console."
          onPress={() => setIacSheet(true)}
        />
      ) : null}
      <IacHookupSheet
        visible={iacSheet}
        projectId={projectId}
        status={iacStatus}
        onClose={() => setIacSheet(false)}
        onDone={async () => { setIacSheet(false); await loadProject(); }}
      />

      <ScreenTabs
        tabs={[
          { id: 'info', label: 'Info' },
          { id: 'infra', label: 'Infra' },
          { id: 'services', label: 'Services' },
          { id: 'workers', label: 'Workers' },
          { id: 'deployments', label: 'Deployments' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'info' ? <Box title="Project Information">
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
      </Box> : null}

      {tab === 'info' && !isDashboard && (
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

      {tab === 'workers' ? <Box title={`Workers (${project.workers?.length || 0})`}>
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
                <Text style={ProjectDetailsStyles.listItemTitle}>{worker.display_name || worker.hostname}</Text>
                <Text style={ProjectDetailsStyles.listItemSubtitle}>{worker.ip_address}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          ))
        ) : (
          <Text style={ProjectDetailsStyles.emptyText}>No workers assigned</Text>
        )}
      </Box> : null}

      {tab === 'services' ? <Box title={`Services (${project.services?.length || 0})`}>
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
              placement={placements[service.name]}
            />
          ))
        ) : (
          <Text style={ProjectDetailsStyles.emptyText}>No services assigned</Text>
        )}
      </Box> : null}

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

      {tab === 'infra' ? (
        <InfraTab
          projectId={project.id}
          placements={placements}
          onRefresh={loadProject}
        />
      ) : null}

      {tab === 'deployments' ? <Box title={`Deployments (${project.deployments?.length || 0})`}>
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
      </Box> : null}
    </ScrollView>
  );
};
