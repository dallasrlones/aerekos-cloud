import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Alert,
} from 'react-native';
import { Box } from '../../components/Box/Box';
import { Button } from '../../components/Button/Button';
import { ServiceSetupWizard } from '../../components/ServiceSetupWizard';
import { edgeService } from '../../services/edgeService';
import { useProject } from '../../contexts/ProjectContext';
import { colors } from '../../styles/theme';
import { EdgeManagerStyles as S } from './EdgeManager.styles';
import { ResourceCrud } from '../../components/ResourceCrud';
import { HookupBanner } from '../../components/ui';
import { EdgeHookupSheet } from '../../components/EdgeHookup/EdgeHookupSheet';
import { projectService } from '../../services/projectService';
import { HostnameSheet } from '../../components/HostnameSheet/HostnameSheet';
import {
  attachmentFromRule,
  companionTunnelsFor,
  consoleTunnelsFromNamed,
  hostnameOnConsoleFleet,
  isCatchAll,
} from '../../utils/tunnelAttachments';

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

export const EdgeManager = ({ navigation }) => {
  const { currentProject } = useProject();
  const projectId = currentProject?.id;
  const [tab, setTab] = useState('tunnels');
  const [probe, setProbe] = useState(null);
  const [tunnels, setTunnels] = useState([]);
  const [hostnames, setHostnames] = useState([]);
  const [namedTunnels, setNamedTunnels] = useState([]);
  const [zones, setZones] = useState([]);
  const [selectedTunnel, setSelectedTunnel] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [probing, setProbing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [edgeStatus, setEdgeStatus] = useState(null);
  const [edgeSheet, setEdgeSheet] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formRow, setFormRow] = useState(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState(null);

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

  const loadAttachments = useCallback(async (tunnel, named) => {
    if (!projectId || !tunnel) return;
    setSelectedTunnel(tunnel);
    setAttachments([]);
    setAttachmentsLoading(true);
    setError(null);
    try {
      const group = [tunnel, ...companionTunnelsFor(tunnel, named || namedTunnels)];
      const rows = [];
      for (const tun of group) {
        const id = tun.id || tun.cf_tunnel_id;
        if (!id) continue;
        try {
          const data = await edgeService.getIngress(projectId, id);
          for (const rule of data.ingress || []) {
            if (isCatchAll(rule)) continue;
            rows.push(attachmentFromRule(rule, tun));
          }
        } catch (err) {
          setError(err.response?.data?.error?.message || err.message || 'Failed to load hostnames');
        }
      }
      setAttachments(rows);
    } finally {
      setAttachmentsLoading(false);
    }
  }, [projectId, namedTunnels]);

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

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const goSecrets = () => navigation.navigate('createServiceSecret');

  const openCreate = () => {
    if (!selectedTunnel) return;
    if (!zones.length) loadZones().catch(() => {});
    setFormRow(null);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (row) => {
    if (!zones.length) loadZones().catch(() => {});
    setFormRow(row);
    setFormError(null);
    setFormOpen(true);
  };

  const tunnelForPort = (port, row) => {
    if (row?.tunnel_id) {
      return namedTunnels.find((t) => t.id === row.tunnel_id || t.cf_tunnel_id === row.tunnel_id)
        || selectedTunnel;
    }
    const companions = companionTunnelsFor(selectedTunnel, namedTunnels);
    if (String(port) !== '22' && companions[0]) return companions[0];
    return selectedTunnel;
  };

  const handleSaveAttachment = async ({ subdomain, domain, port, hostname }) => {
    if (!projectId || !selectedTunnel) return;
    if (!hostname || !port) {
      setFormError('Domain and port are required.');
      return;
    }
    setFormBusy(true);
    setFormError(null);
    try {
      const tun = tunnelForPort(port, formRow);
      await edgeService.attachHostname(projectId, {
        tunnel_id: tun.id || tun.cf_tunnel_id,
        subdomain,
        domain,
        port,
        previous_hostname: formRow?.hostname || '',
      });
      setFormOpen(false);
      await loadTunnels();
      await loadAttachments(selectedTunnel);
    } catch (err) {
      setFormError(err.response?.data?.error?.message || err.message || 'Save failed');
    } finally {
      setFormBusy(false);
    }
  };

  const handleRemoveAttachment = (row) => {
    if (!projectId || !row?.hostname) return;
    Alert.alert(
      'Remove hostname',
      `Remove ${row.hostname} from this tunnel? Other hostnames stay.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setError(null);
              await edgeService.detachHostname(projectId, {
                tunnel_id: row.tunnel_id || selectedTunnel.id || selectedTunnel.cf_tunnel_id,
                hostname: row.hostname,
              });
              await loadTunnels();
              await loadAttachments(selectedTunnel);
            } catch (err) {
              setError(err.response?.data?.error?.message || err.message || 'Remove failed');
            }
          },
        },
      ],
    );
  };

  const visibleTunnels = useMemo(
    () => consoleTunnelsFromNamed(namedTunnels, tunnels),
    [namedTunnels, tunnels],
  );
  const visibleHostnames = useMemo(
    () => (hostnames || []).filter((h) => hostnameOnConsoleFleet(h, namedTunnels)),
    [hostnames, namedTunnels],
  );

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
      {edgeStatus && edgeStatus.hooked_up === false && !visibleTunnels.some((t) => t.status === 'healthy') ? (
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

      {edgeStatus?.hooked_up || visibleTunnels.some((t) => t.status === 'healthy') ? null : (
        <ServiceSetupWizard
          serviceName="tunnel_manager"
          onEnabled={load}
          onNavigateToSecrets={goSecrets}
          navigation={navigation}
        />
      )}

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
          <Box title="Fleet tunnels">
            <Text style={S.hint}>
              prod-mini, dev-mini, and orin only. Click a tunnel to see hostname, domain, and port.
            </Text>
            {visibleTunnels.length === 0 ? (
              <Text style={S.hint}>No fleet tunnels attached yet.</Text>
            ) : (
              visibleTunnels.map((t) => (
                <TouchableOpacity
                  key={t.cf_tunnel_id || t.id || t.display_name}
                  style={[S.listItem, selectedTunnel?.cf_tunnel_id === t.cf_tunnel_id && S.listItemActive]}
                  onPress={() => loadAttachments(t)}
                >
                  <Text style={S.listTitle}>{t.display_name || t.name}</Text>
                  <Text style={S.listMeta}>
                    {t.device_hostname || 'unattached'} · {t.status || 'unknown'}
                    {companionTunnelsFor(t, namedTunnels).length ? ' · includes HTTP companion' : ''}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </Box>

          {selectedTunnel ? (
            <Box title={`${selectedTunnel.display_name || selectedTunnel.name} · attached hostnames`}>
              <Text style={S.hint}>
                Domain, subdomain, and origin port on this device
                {companionTunnelsFor(selectedTunnel, namedTunnels).length
                  ? ' (includes the Prod-Mini HTTP connector)'
                  : ''}
                . Save merges one rule — it does not replace the tunnel.
              </Text>
              <View style={S.row}>
                <Button title="Add hostname" onPress={openCreate} />
              </View>
              {attachmentsLoading ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 8 }} />
              ) : null}
              {!attachmentsLoading && attachments.length === 0 ? (
                <Text style={S.hint}>No hostname / port rules on this tunnel.</Text>
              ) : null}
              {attachments.map((row, idx) => (
                <View key={`${row.hostname}-${row.port}-${idx}`} style={S.listItem}>
                  <Text style={S.listTitle}>{row.hostname}</Text>
                  <Text style={S.listMeta}>
                    {[
                      row.subdomain ? `subdomain ${row.subdomain}` : null,
                      row.domain ? `domain ${row.domain}` : null,
                      row.port ? `port ${row.port}` : 'no port',
                      row.path ? `path ${row.path}` : null,
                      row.tunnel_name && row.tunnel_name !== (selectedTunnel.display_name || selectedTunnel.name)
                        ? `via ${row.tunnel_name}`
                        : null,
                    ].filter(Boolean).join(' · ')}
                  </Text>
                  {row.service ? <Text style={S.listMeta}>{row.service}</Text> : null}
                  <View style={S.row}>
                    <Button title="Edit" variant="secondary" onPress={() => openEdit(row)} />
                    <Button title="Remove" variant="secondary" onPress={() => handleRemoveAttachment(row)} />
                  </View>
                </View>
              ))}
            </Box>
          ) : null}

          <Box title="Hostnames">
            {visibleHostnames.length === 0 ? (
              <Text style={S.hint}>No hostnames on the fleet tunnels yet. Bind from a container.</Text>
            ) : visibleHostnames.map((h) => {
              const tun = namedTunnels.find((t) => t.cf_tunnel_id === h.tunnel_id || t.id === h.tunnel_id)
                || tunnels.find((t) => t.cf_tunnel_id === h.tunnel_id || t.id === h.tunnel_id);
              const label = tun?.companion_of || tun?.display_name || h.tunnel_id || '—';
              return (
                <View key={h.id || h.hostname} style={S.listItem}>
                  <Text style={S.listTitle}>{h.hostname}</Text>
                  <Text style={S.listMeta}>
                    Device {tun?.device_hostname || tun?.display_name || '—'} · {label} · :{h.port}
                  </Text>
                </View>
              );
            })}
          </Box>
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

      {tab === 'dns' ? (
        <ResourceCrud serviceName="domain_manager" enabled={!!projectId} title="DNS records" onChanged={loadZones} />
      ) : null}

      <HostnameSheet
        visible={formOpen}
        title={formRow ? `Edit ${formRow.hostname}` : 'Add hostname'}
        initial={formRow}
        zones={zones}
        busy={formBusy}
        error={formError}
        onClose={() => setFormOpen(false)}
        onSave={handleSaveAttachment}
      />
    </ScrollView>
  );
};
