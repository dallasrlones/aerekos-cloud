import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useProject } from '../../contexts/ProjectContext';
import { projectService } from '../../services/projectService';
import { managerService } from '../../services/managerService';
import { getCatalogByCategory } from '../../services/serviceCatalog';
import { getRecentServices, recordServiceVisit } from '../../services/recentServices';
import { Button } from '../../components/Button/Button';
import { DashboardStyles as S } from './Dashboard.styles';
import { colors } from '../../styles/theme';

/**
 * Dashboard — the AWS-style Console Home. Merges the old project dashboard with
 * the service catalog into a single landing page:
 *   1. Greeting + current-project context strip
 *   2. Live service search
 *   3. Clickable project stat cards (workers / services / deployments / devices)
 *   4. Recently visited services
 *   5. The full service catalog grouped by category
 *
 * Deep project management (service toggles, add workers/services, deployments)
 * lives on ProjectDetails (/projects/:id); this screen links out to it.
 */

const StatCard = ({ icon, value, label, onPress }) => (
  <TouchableOpacity style={S.statCard} activeOpacity={0.7} onPress={onPress}>
    <View style={S.statIconWrap}>
      <Ionicons name={icon} size={20} color={colors.primary} />
    </View>
    <Text style={S.statValue}>{value}</Text>
    <Text style={S.statLabel}>{label}</Text>
  </TouchableOpacity>
);

const ServiceCard = ({ svc, enabled, onPress }) => (
  <TouchableOpacity style={S.card} activeOpacity={0.7} onPress={onPress}>
    <View style={S.cardHeader}>
      <View style={S.iconWrap}>
        <Ionicons name={svc.icon} size={22} color={colors.primary} />
      </View>
      <View
        style={[
          S.serviceDot,
          { backgroundColor: enabled === undefined ? colors.border : enabled ? '#4CAF50' : colors.textMuted },
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
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [enabledMap, setEnabledMap] = useState({});
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState([]);

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
      // Non-fatal: catalog still renders, cards just show "unknown" status.
      console.error('Error loading service statuses:', err);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadProject(), loadStatuses()]);
    setLoading(false);
  }, [loadProject, loadStatuses]);

  useEffect(() => {
    loadAll();
    setRecent(getRecentServices());
  }, [loadAll]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadProject(), loadStatuses()]);
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

  const q = query.trim().toLowerCase();
  const filteredGroups = useMemo(() => {
    if (!q) return groups;
    return groups
      .map((group) => ({
        ...group,
        services: group.services.filter(
          (s) =>
            s.label.toLowerCase().includes(q) ||
            s.name.toLowerCase().includes(q) ||
            (s.description || '').toLowerCase().includes(q)
        ),
      }))
      .filter((group) => group.services.length > 0);
  }, [groups, q]);

  const totalCount = groups.reduce((n, g) => n + g.services.length, 0);
  const enabledCount = Object.values(enabledMap).filter(Boolean).length;

  // --- Loading / empty states ---------------------------------------------
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
      <ScrollView style={S.container} contentContainerStyle={[S.content, S.emptyContent]}>
        <View style={S.emptyState}>
          <Text style={S.emptyStateTitle}>Welcome to Aerekos Cloud</Text>
          <Text style={S.emptyStateDescription}>
            Projects organize your services and devices. Create your first project to get started.
          </Text>
          <Button
            title="Create Project"
            onPress={() => navigation.navigate('projectForm', { mode: 'create' })}
            style={S.createButton}
          />
        </View>
      </ScrollView>
    );
  }

  const workerCount = project?.workers?.length ?? 0;
  const serviceCount = project?.services?.length ?? 0;
  const deploymentCount = project?.deployments?.length ?? 0;

  return (
    <ScrollView
      style={S.container}
      contentContainerStyle={S.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Greeting + project context */}
      <View style={S.heroRow}>
        <View style={S.heroText}>
          <Text style={S.title}>Console Home</Text>
          {currentProject ? (
            <Text style={S.subtitle}>
              Project: <Text style={S.subtitleStrong}>{currentProject.name}</Text> · {totalCount} services · {enabledCount} enabled
            </Text>
          ) : (
            <Text style={S.subtitle}>Select a project to see its resources · {totalCount} services available</Text>
          )}
        </View>
        <View style={S.heroActions}>
          <TouchableOpacity
            style={S.heroBtn}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('projectForm', { mode: 'create' })}
          >
            <Ionicons name="add" size={16} color={colors.primary} />
            <Text style={S.heroBtnText}>New project</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={S.heroBtn}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('devices')}
          >
            <Ionicons name="server-outline" size={16} color={colors.primary} />
            <Text style={S.heroBtnText}>Devices</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={S.searchBar}>
        <Ionicons name="search" size={18} color={colors.textMuted} style={S.searchIcon} />
        <TextInput
          style={S.searchInput}
          placeholder="Search services (e.g. storage, queue, dns)…"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Project overview stat cards (hidden while actively searching) */}
      {!q && (
        <View style={S.statRow}>
          <StatCard
            icon="git-network-outline"
            value={workerCount}
            label="Workers"
            onPress={() =>
              currentProject
                ? navigation.navigate('projectDetails', { projectId: currentProject.id, isDashboard: true })
                : navigation.navigate('devices')
            }
          />
          <StatCard
            icon="cube-outline"
            value={serviceCount}
            label="Project services"
            onPress={() =>
              currentProject &&
              navigation.navigate('projectDetails', { projectId: currentProject.id, isDashboard: true })
            }
          />
          <StatCard
            icon="rocket-outline"
            value={deploymentCount}
            label="Deployments"
            onPress={() =>
              currentProject &&
              navigation.navigate('projectDetails', { projectId: currentProject.id, isDashboard: true })
            }
          />
          <StatCard
            icon="desktop-outline"
            value={`${enabledCount}/${totalCount}`}
            label="Managers enabled"
            onPress={() => navigation.navigate('devices')}
          />
        </View>
      )}

      {/* Recently visited */}
      {!q && recent.length > 0 && (
        <View style={S.recentSection}>
          <Text style={S.groupTitle}>Recently visited</Text>
          <View style={S.recentRow}>
            {recent.map((svc) => (
              <TouchableOpacity
                key={svc.name}
                style={S.recentChip}
                activeOpacity={0.7}
                onPress={() => openService(svc)}
              >
                <Ionicons name={svc.icon || 'apps-outline'} size={16} color={colors.primary} />
                <Text style={S.recentChipText} numberOfLines={1}>{svc.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {loading && (
        <View style={S.inlineLoading}>
          <ActivityIndicator size="small" color={colors.accent} />
        </View>
      )}

      {filteredGroups.length === 0 && (
        <Text style={S.emptyText}>No services match “{query}”.</Text>
      )}

      {/* Service catalog */}
      {filteredGroups.map((group) => (
        <View key={group.id} style={S.group}>
          <Text style={S.groupTitle}>{group.label}</Text>
          <View style={S.grid}>
            {group.services.map((svc) => (
              <ServiceCard
                key={svc.name}
                svc={svc}
                enabled={enabledMap[svc.name]}
                onPress={() => openService(svc)}
              />
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
};
