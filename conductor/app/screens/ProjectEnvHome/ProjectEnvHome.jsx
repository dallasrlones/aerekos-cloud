import React, { useCallback, useEffect, useState } from 'react';
import { Text, View, ActivityIndicator } from 'react-native';
import { useProject } from '../../contexts/ProjectContext';
import { recordServiceVisit } from '../../services/recentServices';
import { loadProjectInventory, serviceScreen, itemScreen } from '../../services/projectInventory';
import { Page, ListRow } from '../../components/ui';
import { useTheme } from '../../contexts/ThemeContext';

export const ProjectEnvHome = ({ navigation }) => {
  const { currentProject, currentEnvironment } = useProject();
  const { colors, spacing, typography } = useTheme();
  const projectId = currentProject?.id;
  const env = currentEnvironment || 'dev';
  const groupTitleStyle = {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  };
  const groupStyle = { marginBottom: spacing.xl };

  const [groups, setGroups] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!projectId) {
      setGroups([]);
      return;
    }
    setGroups(await loadProjectInventory(projectId, env));
  }, [projectId, env]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openService = (svc) => {
    recordServiceVisit(svc);
    const dest = serviceScreen(svc.name);
    navigation.navigate(dest.screen, dest.params);
  };

  const openItem = (svc, item) => {
    recordServiceVisit(svc);
    const dest = itemScreen(svc.name, item);
    navigation.navigate(dest.screen, dest.params);
  };

  return (
    <Page
      title={currentProject?.name || 'Project'}
      subtitle={`${env} · attached to this environment`}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      {loading ? <ActivityIndicator size="small" color={colors.accent} /> : null}
      {!loading && !groups.length ? (
        <Text style={{ color: colors.textMuted }}>Nothing attached to this environment yet.</Text>
      ) : null}

      {groups.map((group) => (
        <View key={group.id} style={groupStyle}>
          <Text style={groupTitleStyle}>{group.label}</Text>
          {group.services.map((svc) => (
            <View key={svc.name}>
              <ListRow
                icon={svc.icon}
                title={svc.label}
                subtitle={svc.subtitle}
                onPress={() => openService(svc)}
              />
              {svc.visibleItems.map((item) => (
                <View key={`${svc.name}-${item.id}`} style={{ paddingLeft: spacing.lg }}>
                  <ListRow
                    icon="ellipse-outline"
                    title={item.name}
                    subtitle={item.subtitle}
                    status={item.status || undefined}
                    onPress={() => openItem(svc, item)}
                  />
                </View>
              ))}
              {svc.shared.map((item) => (
                <View key={`${svc.name}-shared-${item.id}`} style={{ paddingLeft: spacing.lg }}>
                  <ListRow
                    icon="share-outline"
                    title={item.name}
                    subtitle={item.subtitle}
                    onPress={() => openItem(svc, item)}
                  />
                </View>
              ))}
              {svc.more ? (
                <View style={{ paddingLeft: spacing.lg }}>
                  <ListRow
                    icon="ellipsis-horizontal-outline"
                    title={`${svc.more} more`}
                    subtitle={`Open ${svc.label}`}
                    onPress={() => openService(svc)}
                  />
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ))}
    </Page>
  );
};
