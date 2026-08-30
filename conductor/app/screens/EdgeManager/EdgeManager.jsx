import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, RefreshControl, TextInput, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { Box } from '../../components/Box/Box';
import { Button } from '../../components/Button/Button';
import { ServiceSetupWizard } from '../../components/ServiceSetupWizard';
import { edgeService } from '../../services/edgeService';
import { useProject } from '../../contexts/ProjectContext';
import { colors } from '../../styles/theme';
import { EdgeManagerStyles as S } from './EdgeManager.styles';
import { ResourceCrud } from '../../components/ResourceCrud';
import { stackService } from '../../services/stackService';
import { HookupBanner } from '../../components/ui';
import { EdgeHookupSheet } from '../../components/EdgeHookup/EdgeHookupSheet';
import { projectService } from '../../services/projectService';

const TABS = [
  { id: 'connect', label: 'Connect Cloudflare' },
  { id: 'tunnels', label: 'Tunnels' },
  { id: 'dns', label: 'DNS Zones' },
];

const CF_SECRETS = [
  { name: 'cloudflare_api_token', label: 'API token' },
  { name: 'cloudflare_account_id', label: 'Account ID' },
  { name: 'cloudflare_zone_id', label: 'Zone ID (optional)' },
];

const DEFAULT_INGRESS = [
  { hostname: 'cloud.aerekos.com', service: 'http://conductor:3300' },
  { hostname: 'cloudapi.aerekos.com', service: 'http://conductor:3300' },
  { service: 'http_status:404' },
];

export const EdgeManager = ({ navigation }) => {
  const { currentProject } = useProject();
  const projectId = currentProject?.id;
  const [tab, setTab] = useState('connect');
  const [probe, setProbe] = useState(null);
  const [tunnels, setTunnels] = useState([]);
  const [hostnames, setHostnames] = useState([]);
  const [namedTunnels, setNamedTunnels] = useState([]);
  const [zones, setZones] = useState([]);
  const [selectedTunnel, setSelectedTunnel] = useState(null);
  const [ingressText, setIngressText] = useState('');
  const [tunnelName, setTunnelName] = useState('');
  const [createdToken, setCreatedToken] = useState(null);
  const [cloudflaredHint, setCloudflaredHint] = useState(null);
  const [probing, setProbing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [savingIngress, setSavingIngress] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [edgeStatus, setEdgeStatus] = useState(null);
  const [edgeSheet, setEdgeSheet] = useState(false);

  const runProbe = useCallback(async () => {
    if (!projectId) return;
    setProbing(true);
    setError(null);
    try {
      setProbe(await edgeService.probeCloudflare(projectId));
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Probe failed');
      setProbe(null);
    } finally {
      setProbing(false);
    }
  }, [projectId]);

  const loadTunnels = useCallback(async () => {
    if (!projectId) return;
    try {
      setTunnels(await edgeService.listTunnels(projectId));
      setHostnames(await edgeService.listHostnames(projectId).catch(() => []));
      setNamedTunnels(await edgeService.namedTunnels(projectId).catch(() => []));
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load tunnels');
      setTunnels([]);
    }
  }, [projectId]);

  const loadZones = useCallback(async () => {
    if (!projectId) return;
    try {
      setZones(await edgeService.listZones(projectId));
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load zones');
      setZones([]);
    }
  }, [projectId]);

  const loadIngress = useCallback(async (tunnel) => {
    if (!projectId || !tunnel) return;
    try {
      const data = await edgeService.getIngress(projectId, tunnel.id);
      setIngressText(JSON.stringify(data.ingress || DEFAULT_INGRESS, null, 2));
      setSelectedTunnel(tunnel);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load ingress');
    }
  }, [projectId]);

  const load = useCallback(async () => {
    await runProbe();
    if (projectId) {
      try { setEdgeStatus(await projectService.getEdgeStatus(projectId)); } catch { setEdgeStatus(null); }
    }
    if (tab === 'tunnels') await loadTunnels();
    if (tab === 'dns') await loadZones();
  }, [runProbe, loadTunnels, loadZones, tab, projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreateTunnel = async () => {
    if (!projectId || !tunnelName.trim()) return;
    setCreating(true);
    setCreatedToken(null);
    setCloudflaredHint(null);
    setError(null);
    try {
      const data = await edgeService.createTunnel(projectId, tunnelName.trim());
      await stackService.record(projectId, { service: 'tunnel_manager', resource: { name: tunnelName.trim() } });
      setCreatedToken(data.token || null);
      setCloudflaredHint(data.cloudflared || null);
      setTunnelName('');
      await loadTunnels();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Create tunnel failed');
    } finally {
      setCreating(false);
    }
  };

  const handleImport = async () => {
    if (!projectId) return;
    setImporting(true);
    setError(null);
    try {
      const data = await edgeService.importFromCloudflare(projectId);
      await loadTunnels();
      setError(null);
      if (data.imported?.length === 0) {
        setError(`No new tunnels imported (${data.skipped || 0} already in DB)`);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleReconcile = async () => {
    if (!projectId) return;
    setReconciling(true);
    try {
      await edgeService.reconcileTunnels(projectId);
      await loadTunnels();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Reconcile failed');
    } finally {
      setReconciling(false);
    }
  };

  const handleSaveIngress = async () => {
    if (!projectId || !selectedTunnel) return;
    setSavingIngress(true);
    setError(null);
    try {
      const ingress = JSON.parse(ingressText);
      await edgeService.setIngress(projectId, selectedTunnel.id, ingress);
      await loadTunnels();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Save ingress failed');
    } finally {
      setSavingIngress(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const goSecrets = () => navigation.navigate('createServiceSecret');

  return (
    <ScrollView
      style={S.container}
      contentContainerStyle={S.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={S.title}>Edge &amp; Delivery</Text>
      <Text style={S.subtitle}>
        Cloudflare tunnels, DNS, and public hostnames for cloud.aerekos.com
      </Text>
      {edgeStatus && edgeStatus.hooked_up === false ? (
        <HookupBanner
          title="Tunnels / DNS aren’t hooked up"
          body={edgeStatus.message || 'Uses existing Cloudflare secrets. Does not create an account.'}
          onPress={() => setEdgeSheet(true)}
        />
      ) : null}
      <EdgeHookupSheet
        visible={edgeSheet}
        projectId={projectId}
        status={edgeStatus}
        onClose={() => setEdgeSheet(false)}
        onDone={async () => { setEdgeSheet(false); await load(); }}
        navigation={navigation}
      />

      <View style={S.tabRow}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[S.tab, tab === t.id && S.tabActive]}
            onPress={() => setTab(t.id)}
          >
            <Text style={[S.tabText, tab === t.id && S.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? <Text style={S.error}>{error}</Text> : null}

      <ServiceSetupWizard
        serviceName="tunnel_manager"
        onEnabled={load}
        onNavigateToSecrets={goSecrets}
      />

      {tab === 'connect' && (
        <Box title="Connect Cloudflare">
          <Text style={S.hint}>
            Store your Cloudflare API token and account ID as project secrets. Values are injected
            into tunnel_manager and domain_manager when enabled.
          </Text>
          {CF_SECRETS.map((s) => {
            const ok = probe?.secrets?.[s.name];
            return (
              <Text key={s.name} style={[S.secretRow, ok ? S.secretOk : S.secretMissing]}>
                {ok ? '✓' : '○'} {s.label} ({s.name})
              </Text>
            );
          })}
          <View style={S.row}>
            <Button title="Add secrets" variant="secondary" onPress={goSecrets} />
            <Button title="Test connection" onPress={runProbe} loading={probing} />
          </View>
          {probing && !probe ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 8 }} />
          ) : null}
          {probe?.message ? (
            <Text style={probe.ready ? S.success : S.hint}>{probe.message}</Text>
          ) : null}
        </Box>
      )}

      {tab === 'tunnels' && (
        <>
          <Box title="Cloudflare Tunnels">
            <Text style={S.hint}>Create a tunnel to receive a one-time cloudflared token.</Text>
            <TextInput
              style={S.input}
              placeholder="tunnel name (e.g. prod-edge)"
              placeholderTextColor={colors.textMuted}
              value={tunnelName}
              onChangeText={setTunnelName}
            />
            <View style={S.row}>
              <Button title="Create tunnel" onPress={handleCreateTunnel} loading={creating} />
              <Button title="Import from CF" variant="secondary" onPress={handleImport} loading={importing} />
              <Button title="Reconcile status" variant="secondary" onPress={handleReconcile} loading={reconciling} />
            </View>
            {createdToken ? (
              <View style={S.tokenBox}>
                <Text style={S.tokenLabel}>One-time token — copy now; not shown again</Text>
                <Text style={S.tokenValue} selectable>{createdToken}</Text>
                {cloudflaredHint?.command ? (
                  <Text style={[S.hint, { marginTop: 8 }]} selectable>{cloudflaredHint.command}</Text>
                ) : null}
              </View>
            ) : null}
            {tunnels.length === 0 ? (
              <Text style={S.hint}>No tunnels yet. Create one or import existing CF tunnels.</Text>
            ) : (
              tunnels.map((t) => (
                <TouchableOpacity key={t.id} style={S.listItem} onPress={() => loadIngress(t)}>
                  <Text style={S.listTitle}>{t.display_name || t.name}</Text>
                  <Text style={S.listMeta}>
                    {t.device_hostname || 'unattached'} · {t.status || 'unknown'} · {t.ingress_rules || 0} rules · CNAME {t.cname_target || '—'}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </Box>

          <Box title="Hostnames">
            {hostnames.length === 0 ? (
              <Text style={S.hint}>No hostnames yet. Bind from a container — do not start here for the happy path.</Text>
            ) : hostnames.map((h) => {
              const tun = namedTunnels.find((t) => t.cf_tunnel_id === h.tunnel_id || t.id === h.tunnel_id)
                || tunnels.find((t) => t.cf_tunnel_id === h.tunnel_id || t.id === h.tunnel_id);
              return (
                <View key={h.id || h.hostname} style={S.listItem}>
                  <Text style={S.listTitle}>{h.hostname}</Text>
                  <Text style={S.listMeta}>
                    Device {tun?.device_hostname || tun?.display_name || '—'} · tunnel {tun?.display_name || h.tunnel_id || '—'} · :{h.port}
                  </Text>
                </View>
              );
            })}
          </Box>

          {selectedTunnel ? (
            <Box title={`Ingress — ${selectedTunnel.name}`}>
              <Text style={S.hint}>
                CNAME target: {selectedTunnel.cname_target}. Pair with domain_manager DNS records.
              </Text>
              <TextInput
                style={[S.input, { minHeight: 140, fontFamily: 'monospace' }]}
                multiline
                value={ingressText}
                onChangeText={setIngressText}
              />
              <View style={S.row}>
                <Button title="Save ingress" onPress={handleSaveIngress} loading={savingIngress} />
                <Button
                  title="Use prod defaults"
                  variant="secondary"
                  onPress={() => setIngressText(JSON.stringify(DEFAULT_INGRESS, null, 2))}
                />
              </View>
            </Box>
          ) : null}
        </>
      )}

      {tab === 'dns' && (
        <Box title="DNS Zones">
          <Text style={S.hint}>Zones visible with your Cloudflare API token.</Text>
          <Button title="Refresh zones" variant="secondary" onPress={loadZones} />
          {zones.length === 0 ? (
            <Text style={S.hint}>No zones loaded — run Test connection on Connect tab first.</Text>
          ) : (
            zones.map((z) => (
              <View key={z.id} style={S.listItem}>
                <Text style={S.listTitle}>{z.name}</Text>
                <Text style={S.listMeta}>{z.status} · {z.id}</Text>
              </View>
            ))
          )}
        </Box>
      )}

      {tab === 'tunnels' ? (
        <ResourceCrud serviceName="tunnel_manager" enabled={!!projectId} title="Tunnels" onChanged={loadTunnels} />
      ) : null}
      {tab === 'dns' ? (
        <ResourceCrud serviceName="domain_manager" enabled={!!projectId} title="DNS records" onChanged={loadZones} />
      ) : null}
    </ScrollView>
  );
};
