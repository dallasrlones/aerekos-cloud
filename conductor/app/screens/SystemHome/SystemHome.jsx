import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View, ActivityIndicator } from 'react-native';
import { useProject } from '../../contexts/ProjectContext';
import { fleetService } from '../../services/fleetService';
import { GPU_FLEET_SERVICES, PLATFORM_DEVICE_SERVICES } from '../../config/platformDeviceServices';
import { getServiceMeta } from '../../services/serviceCatalog';
import { recordServiceVisit } from '../../services/recentServices';
import { Page, ListRow, HookupBanner } from '../../components/ui';
import { DashboardStyles as S } from '../Dashboard/Dashboard.styles';
import api from '../../utils/api';
import { managerService } from '../../services/managerService';

export const SystemHome = ({ navigation }) => {
  const { currentProject } = useProject();
  const [fleet, setFleet] = useState(null);
  const [ops, setOps] = useState(null);
  const [placements, setPlacements] = useState({});
  const [waiting, setWaiting] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadFleet = useCallback(async () => {
    try {
      setFleet(await fleetService.getHealth(currentProject?.id));
    } catch {
      setFleet(null);
    }
  }, [currentProject?.id]);

  const loadPlacements = useCallback(async () => {
    try {
      const rows = await managerService.listServices();
      const map = {};
      (rows || []).forEach((s) => {
        if (s?.name) map[s.name] = s;
      });
      setPlacements(map);
    } catch {
      setPlacements({});
    }
  }, []);

  const loadWaiting = useCallback(async () => {
    if (!currentProject?.id) {
      setWaiting(0);
      return;
    }
    try {
      const r = await api.get('/api/services/queue_manager/api/v1/queues/capacity-wait/messages', {
        params: { project_id: currentProject.id },
      });
      const items = r.data?.messages || r.data?.items || [];
      setWaiting(Array.isArray(items) ? items.length : Number(r.data?.count || 0));
    } catch {
      setWaiting(0);
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

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadFleet(), loadOps(), loadPlacements(), loadWaiting()]);
    setLoading(false);
  }, [loadFleet, loadOps, loadPlacements, loadWaiting]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadFleet(), loadOps(), loadPlacements(), loadWaiting()]);
    setRefreshing(false);
  };

  const openService = (meta) => {
    if (!meta) return;
    recordServiceVisit(meta);
    if (meta.route) navigation.navigate(meta.route);
    else navigation.navigate('managerConsole', { serviceName: meta.name });
  };

  const deviceServices = useMemo(
    () => PLATFORM_DEVICE_SERVICES.map((name) => getServiceMeta(name)).filter(Boolean),
    [],
  );

  const gpuServices = useMemo(
    () => GPU_FLEET_SERVICES.map((name) => getServiceMeta(name)).filter(Boolean),
    [],
  );

  const online = fleet?.summary?.online || 0;
  const total = fleet?.summary?.worker_count || 0;

  return (
    <Page
      title="System"
      subtitle="Fleet devices, GPU AI, and always-on device services"
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

      <View style={S.group}>
        <Text style={S.groupTitle}>
          Devices · {online}/{total} online
        </Text>
        {loading && !fleet ? (
          <ActivityIndicator size="small" />
        ) : (fleet?.workers || []).length ? (
          (fleet.workers || []).map((w) => (
            <ListRow
              key={w.id}
              icon="server-outline"
              title={w.display_name || w.hostname}
              subtitle={(() => {
                const ram = w.ram || {};
                const used = Number(ram.used_gb || 0);
                const tot = Number(ram.total_gb || 0);
                const free = Number(ram.free_gb != null ? ram.free_gb : Math.max(0, tot - used));
                const ramBit = tot ? `${used.toFixed(0)}/${tot.toFixed(0)} GB · ${free.toFixed(0)} free${ram.unified ? ' · unified' : ''}` : (w.version || 'unknown version');
                const roles = (w.roles || []).length ? ` · ${(w.roles || []).join(', ')}` : '';
                const ai = (w.loaded_ai || []).length ? ` · AI ${w.loaded_ai.join(', ')}` : '';
                return `${ramBit}${roles}${ai}`;
              })()}
              status={w.status === 'online' ? 'online' : 'offline'}
              onPress={() => navigation.navigate('deviceDetails', { deviceId: w.id })}
            />
          ))
        ) : (
          <Text style={S.emptyText}>No devices registered yet.</Text>
        )}
      </View>

      <View style={S.group}>
        <Text style={S.groupTitle}>GPU & AI</Text>
        {gpuServices.map((svc) => {
          const place = placements[svc.name];
          const device = place?.device || place?.worker_hostname;
          const subtitle = device
            ? `Runs on ${device}${place?.shared ? ' · shared' : ''} · Agents tab for Icarus`
            : (svc.description || 'Open AI Manager → Agents');
          return (
            <ListRow
              key={svc.name}
              icon={svc.icon}
              title={svc.label}
              subtitle={subtitle}
              onPress={() => openService(svc)}
            />
          );
        })}
      </View>

      <View style={S.group}>
        <Text style={S.groupTitle}>Device services</Text>
        {deviceServices.map((svc) => {
          const place = placements[svc.name];
          const device = place?.device || place?.worker_hostname;
          const subtitle = device
            ? `Runs on ${device}${place?.shared ? ' · shared' : ''}`
            : svc.description;
          return (
            <ListRow
              key={svc.name}
              icon={svc.icon}
              title={svc.label}
              subtitle={subtitle}
              onPress={() => openService(svc)}
            />
          );
        })}
      </View>

      <View style={S.group}>
        <Text style={S.groupTitle}>Fleet glance</Text>
        <ListRow
          icon="pulse-outline"
          title={`${online} of ${total} devices online`}
          subtitle={waiting ? `${waiting} waiting on capacity` : (ops?.broken ? `${ops.broken} broken ops` : 'No broken ops')}
          onPress={() => navigation.navigate('opsTimeline')}
        />
      </View>
    </Page>
  );
};
