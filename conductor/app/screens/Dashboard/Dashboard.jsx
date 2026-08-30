import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useProject } from '../../contexts/ProjectContext';
import { projectService } from '../../services/projectService';
import { fleetService } from '../../services/fleetService';
import { getCatalogByCategory } from '../../services/serviceCatalog';
import { getRecentServices, recordServiceVisit } from '../../services/recentServices';
import { managerService } from '../../services/managerService';
import { Button } from '../../components/Button/Button';
import { Page, Card, ListRow, HookupBanner } from '../../components/ui';
import { IacHookupSheet } from '../../components/IacHookup/IacHookupSheet';
import { DashboardStyles as S } from './Dashboard.styles';
import { colors } from '../../styles/theme';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import api from '../../utils/api';

const StatCard = ({ icon, value, label, onPress }) => (
  <TouchableOpacity style={S.statCard} activeOpacity={0.7} onPress={onPress}>
    <View style={S.statIconWrap}>
      <Ionicons name={icon} size={20} color={colors.textPrimary} />
    </View>
    <Text style={S.statValue}>{value}</Text>
    <Text style={S.statLabel}>{label}</Text>
  </TouchableOpacity>
);

const ServiceCard = ({ svc, enabled, onPress }) => (
  <TouchableOpacity style={S.card} activeOpacity={0.7} onPress={onPress}>
    <View style={S.cardHeader}>
      <View style={S.iconWrap}>
        <Ionicons name={svc.icon} size={22} color={colors.textPrimary} />
      </View>
      <View
        style={[
          S.serviceDot,
          { backgroundColor: enabled === undefined ? colors.border : enabled ? colors.success : colors.textMuted },
        ]}
      />
    </View>
    <Text style={S.cardTitle} numberOfLines={1}>{svc.label}</Text>
    <Text style={S.cardDesc} numberOfLines={2}>{svc.description}</Text>
    <View style={S.cardFooter}>
      <Text style={[S.cardStatus, enabled && S.cardStatusOn]}>
        {enabled === undefined ? 'Unknown' : enabled ? 'Enabled' : 'Not enabled'}
      </Text>
      {svc.route ? <Text style={S.cardBadge}>Console</Text> : null}
    </View>
  </TouchableOpacity>
);

export const Dashboard = ({ navigation }) => {
  const { currentProject, projects, loading: projectsLoading, isLoading: projectSwitching } = useProject();
  const { compact } = useBreakpoint();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [enabledMap, setEnabledMap] = useState({});
  const [fleet, setFleet] = useState(null);
  const [recent, setRecent] = useState(() => getRecentServices());
  const [iacStatus, setIacStatus] = useState(null);
  const [iacSheet, setIacSheet] = useState(false);
  const [ops, setOps] = useState(null);

  const groups = useMemo(() => getCatalogByCategory(), []);

  const loadProject = useCallback(async () => {
    if (!currentProject?.id) {
      setProject(null);
      return;
    }
    try {
      const result = await projectService.getProject(currentProject.id);
      if (result.success) setProject(result.project);
    } catch (error) {
      console.error('Error loading project:', error);
    }
  }, [currentProject?.id]);

  const loadStatuses = useCallback(async () => {
    try {
      const services = await managerService.listServices();
      const map = {};
      services.forEach((svc) => {
        map[svc.name] = svc.enabled === true;
      });
      setEnabledMap(map);
    } catch (err) {
      console.error('Error loading service statuses:', err);
    }
  }, []);

  const loadFleet = useCallback(async () => {
    try {
      const snap = await fleetService.getHealth(currentProject?.id);
      setFleet(snap);
    } catch (err) {
      console.error('Error loading fleet health:', err);
    }
  }, [currentProject?.id]);

  const loadOps = useCallback(async () => {
    if (!currentProject?.id) {
      setOps(null);
      return;
    }
    try {
      const r = await api.get('/api/ops/timeline', { params: { project_id: currentProject.id } });
      setOps(r.data);
    } catch {
      setOps(null);
    }
  }, [currentProject?.id]);

  const loadIac = useCallback(async () => {
    if (!currentProject?.id) {
      setIacStatus(null);
      return;
    }
    try {
      const st = await projectService.getIacStatus(currentProject.id);
      setIacStatus(st);
    } catch (err) {
      setIacStatus(null);
    }
  }, [currentProject?.id]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadProject(), loadStatuses()]);
    setLoading(false);
    void Promise.all([loadFleet(), loadIac(), loadOps()]);
  }, [loadProject, loadStatuses, loadFleet, loadIac, loadOps]);

  useEffect(() => {
    loadAll();
    setRecent(getRecentServices());
  }, [loadAll]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadProject(), loadStatuses(), loadFleet(), loadIac(), loadOps()]);
    setRecent(getRecentServices());
    setRefreshing(false);
  };

  const openService = (meta) => {
    setRecent(recordServiceVisit(meta));
    if (meta.route) {
      navigation.navigate(meta.route);
    } else {
      navigation.navigate('managerConsole', { serviceName: meta.name });
    }
  };

  const projectEnabled = useMemo(() => {
    const fromProject = {};
    (project?.services || []).forEach((s) => {
      if (!s?.name) return;
      fromProject[s.name] = s.enabled === true || s.enabled === 1;
    });
    return fromProject;
  }, [project?.services]);

  const isActiveOnProject = useCallback(
    (name) => {
      if (Object.prototype.hasOwnProperty.call(projectEnabled, name)) {
        return projectEnabled[name] === true;
      }
      return enabledMap[name] === true;
    },
    [projectEnabled, enabledMap],
  );

  const filteredGroups = useMemo(() => {
    return groups
      .map((group) => ({
        ...group,
        services: group.services.filter((s) => isActiveOnProject(s.name)),
      }))
      .filter((group) => group.services.length > 0);
  }, [groups, isActiveOnProject]);

  const totalCount = groups.reduce((n, g) => n + g.services.length, 0);
  const enabledCount = groups.reduce(
    (n, g) => n + g.services.filter((s) => isActiveOnProject(s.name)).length,
    0,
  );

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

  const workerCount = project?.workers?.length ?? 0;
  const serviceCount = project?.services?.length ?? 0;
  const deploymentCount = project?.deployments?.length ?? 0;

  const openProject = () => {
    if (currentProject) {
      navigation.navigate('projectDetails', { projectId: currentProject.id, isDashboard: true });
    }
  };

  const recentActive = recent.filter((svc) => isActiveOnProject(svc.name));

  return (
    <Page
      title="Home"
      subtitle={
        currentProject
          ? `${currentProject.name} · ${enabledCount} active on this project`
          : 'Select a project to see its active services'
      }
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      {ops?.broken > 0 ? (
        <HookupBanner
          title={`${ops.broken} thing${ops.broken === 1 ? '' : 's'} broken`}
          body={(ops.events || []).slice(0, 2).map((e) => e.title).join(' · ') || 'Open the timeline'}
          onPress={() => navigation.navigate('opsTimeline')}
        />
      ) : null}

      {iacStatus && iacStatus.hooked_up === false ? (
        <HookupBanner
          title="Infrastructure as Code isn’t hooked up"
          body={
            (iacStatus.missing || []).includes('manager')
              ? 'Enable the IaC manager, then choose git or console-only.'
              : 'Choose git (repo + stack.json) or keep the stack in the console.'
          }
          onPress={() => setIacSheet(true)}
        />
      ) : null}

      {fleet?.workers?.length > 0 ? (
        <View style={S.group}>
          <Text style={S.groupTitle}>
            Fleet · {fleet.summary?.online || 0}/{fleet.summary?.worker_count || 0} online
          </Text>
          {(fleet.workers || []).map((w) => (
            <ListRow
              key={w.id}
              icon="server-outline"
              title={w.hostname}
              subtitle={`${(w.roles || []).join(', ') || 'worker'} · ${(w.instances || []).length} instance(s)`}
              status={w.status === 'online' ? 'online' : 'offline'}
              onPress={() => navigation.navigate('deviceDetails', { deviceId: w.id })}
            />
          ))}
        </View>
      ) : null}

      <View style={[S.statRow, compact && styles.statGrid]}>
        <StatCard
          icon="git-network-outline"
          value={workerCount}
          label="Workers"
          onPress={openProject}
        />
        <StatCard
          icon="cube-outline"
          value={serviceCount}
          label="Project services"
          onPress={openProject}
        />
        <StatCard
          icon="rocket-outline"
          value={deploymentCount}
          label="Deployments"
          onPress={openProject}
        />
        <StatCard
          icon="desktop-outline"
          value={`${enabledCount}/${totalCount}`}
          label="Active on project"
          onPress={openProject}
        />
      </View>

      {recentActive.length > 0 ? (
        <View style={S.recentSection}>
          <Text style={S.groupTitle}>Recently visited</Text>
          <View style={S.recentRow}>
            {recentActive.map((svc) => (
              <TouchableOpacity
                key={svc.name}
                style={S.recentChip}
                activeOpacity={0.7}
                onPress={() => openService(svc)}
              >
                <Ionicons name={svc.icon || 'apps-outline'} size={16} color={colors.textPrimary} />
                <Text style={S.recentChipText} numberOfLines={1}>{svc.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      {loading ? (
        <View style={S.inlineLoading}>
          <ActivityIndicator size="small" color={colors.accent} />
        </View>
      ) : null}

      {filteredGroups.length === 0 && !loading ? (
        <Card>
          <Text style={S.emptyStateTitle}>No active services yet</Text>
          <Text style={S.emptyStateDescription}>
            Search to enable a service. It will show here once it is active on this project.
          </Text>
        </Card>
      ) : null}

      {filteredGroups.map((group) => (
        <View key={group.id} style={S.group}>
          <Text style={S.groupTitle}>{group.label}</Text>
          {compact ? (
            group.services.map((svc) => (
              <ListRow
                key={svc.name}
                icon={svc.icon}
                title={svc.label}
                subtitle={svc.description}
                status={isActiveOnProject(svc.name) ? 'enabled' : 'disabled'}
                onPress={() => openService(svc)}
              />
            ))
          ) : (
            <View style={S.grid}>
              {group.services.map((svc) => (
                <ServiceCard
                  key={svc.name}
                  svc={svc}
                  enabled={isActiveOnProject(svc.name)}
                  onPress={() => openService(svc)}
                />
              ))}
            </View>
          )}
        </View>
      ))}

      <IacHookupSheet
        visible={iacSheet}
        projectId={currentProject?.id}
        status={iacStatus}
        onClose={() => setIacSheet(false)}
        onDone={async () => {
          setIacSheet(false);
          await loadIac();
        }}
      />
    </Page>
  );
};

const styles = StyleSheet.create({
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
