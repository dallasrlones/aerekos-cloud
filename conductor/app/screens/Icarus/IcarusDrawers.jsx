import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import { Button } from '../../components/Button/Button';
import { aiManagerService } from '../../services/aiManagerService';
import { authService } from '../../services/authService';
import { projectService } from '../../services/projectService';
import websocketService from '../../services/websocketService';
import api from '../../utils/api';
import { colors, spacing, typography } from '../../styles/theme';
import { IcarusStyles as S } from './Icarus.styles';
import { IcarusVisual } from '../AIManager/IcarusVisual';
import { IcarusFederationPanel } from './IcarusFederationPanel';

function StatusChip({ status }) {
  const s = String(status || 'active').toLowerCase();
  const tone = s === 'pending'
    ? { bg: '#F5E6C8', fg: '#8A6A20' }
    : s === 'revoked' || s === 'expired'
      ? { bg: '#F0D6D6', fg: '#8B2E2E' }
      : { bg: '#D8E8D8', fg: '#2F6B2F' };
  return (
    <View style={{
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: tone.bg,
      marginTop: 4,
    }}
    >
      <Text style={{ ...typography.caption, color: tone.fg, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {s}
      </Text>
    </View>
  );
}

function copyText(text) {
  if (!text) return;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(String(text));
    }
  } catch (_) { /* ignore */ }
}

export function IcarusFriendsDrawer({ projectId, initialTab = 'local' }) {
  const [tab, setTab] = useState(initialTab === 'federation' ? 'federation' : 'local');
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [peers, setPeers] = useState([]);
  const [maturity, setMaturity] = useState('ga');
  const [role, setRole] = useState('member');
  const [inviteEmail, setInviteEmail] = useState('');
  const [acceptToken, setAcceptToken] = useState('');
  const [lastToken, setLastToken] = useState('');
  const [lastEmail, setLastEmail] = useState('');
  const [meId, setMeId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [rpgNote, setRpgNote] = useState('');
  const [assistChapter, setAssistChapter] = useState('welcome');

  const myRole = (members || []).find((m) => String(m.user_id) === String(meId))?.role;
  const isOwner = myRole === 'owner' || (!members?.length); // open project → bootstrap as owner

  const load = useCallback(async () => {
    if (!projectId) return;
    setError('');
    try {
      try {
        const me = await authService.getCurrentUser();
        if (me.success && me.user?.id) setMeId(me.user.id);
      } catch (_) { /* ignore */ }
      const mem = await projectService.listMembers(projectId);
      setMembers(mem.members || []);
      if (mem.maturity) setMaturity(mem.maturity);
      try {
        const inv = await projectService.listInvites(projectId);
        setInvites(inv.invites || []);
        if (inv.maturity) setMaturity(inv.maturity);
      } catch (_) {
        setInvites([]);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load friends');
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!projectId) return undefined;
    const room = `ai:live:${projectId}`;
    websocketService.subscribeRoom(room, { projectId });
    const unsub = websocketService.on('ai:friend.presence', (data) => {
      if (Array.isArray(data?.peers)) setPeers(data.peers);
    });
    return () => {
      try { unsub(); } catch (_) { /* ignore */ }
    };
  }, [projectId]);

  const createInvite = async () => {
    if (!projectId) return;
    setBusy(true);
    setError('');
    try {
      const body = { role };
      if (inviteEmail.trim()) body.email = inviteEmail.trim();
      const res = await projectService.createInvite(projectId, body);
      const tok = res.invite?.token || '';
      setLastToken(tok);
      setLastEmail(res.invite?.email || inviteEmail.trim() || '');
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Invite failed');
    } finally {
      setBusy(false);
    }
  };

  const accept = async () => {
    if (!acceptToken.trim()) return;
    setBusy(true);
    setError('');
    try {
      await projectService.acceptInvite(acceptToken.trim());
      setAcceptToken('');
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Accept failed');
    } finally {
      setBusy(false);
    }
  };

  const doCopy = (text, label) => {
    copyText(text);
    setCopied(label || 'copied');
    setTimeout(() => setCopied(''), 1500);
  };

  if (!projectId) {
    return (
      <View style={S.sectionBody}>
        <Text style={S.sectionTitle}>Friends</Text>
        <Text style={typography.caption}>Select a project to share.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={S.sectionBody}>
      <Text style={S.sectionTitle}>Friends</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        {['local', 'federation'].map((id) => (
          <TouchableOpacity
            key={id}
            onPress={() => setTab(id)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderBottomWidth: 2,
              borderBottomColor: tab === id ? (colors.accent || '#2F6B2F') : 'transparent',
            }}
          >
            <Text style={{
              ...typography.body,
              color: tab === id ? colors.textPrimary : colors.textMuted,
              textTransform: 'capitalize',
            }}
            >
              {id === 'local' ? 'Local' : 'Federation'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'federation' ? (
        <IcarusFederationPanel projectId={projectId} />
      ) : (
      <>
      <Text style={S.sectionSub}>
        Share this project on the same conductor — invite link, roles, live presence.
        Maturity: {String(maturity || 'ga').toUpperCase()}.
      </Text>
      {error ? (
        <Text style={{ ...typography.caption, color: colors.danger || '#8B2E2E', marginBottom: 8 }}>{error}</Text>
      ) : null}
      {copied ? (
        <Text style={{ ...typography.caption, color: colors.textMuted, marginBottom: 8 }}>{copied}</Text>
      ) : null}

      <View style={S.drawerCard}>
        <Text style={typography.body}>Live presence</Text>
        <Text style={typography.caption}>Who is in `ai:live` for this project right now.</Text>
        {(peers || []).length === 0 ? (
          <Text style={{ ...typography.caption, marginTop: 6 }}>No peers reported yet — open Chat to join the room.</Text>
        ) : peers.map((p) => (
          <View key={`${p.user_id}-${p.joined_at}`} style={{ marginTop: 6 }}>
            <Text style={typography.body}>{p.username || p.user_id || 'peer'}</Text>
            <StatusChip status={p.status || 'active'} />
          </View>
        ))}
      </View>

      <View style={S.drawerCard}>
        <Text style={typography.body}>Light RPG with friends</Text>
        <Text style={typography.caption}>
          Share a campaign milestone or open read-only assist for a friend (same conductor only).
        </Text>
        {(members || []).filter((m) => String(m.user_id) !== String(meId)).slice(0, 6).map((m) => (
          <View key={`rpg-${m.user_id}`} style={{ marginTop: 8 }}>
            <Text style={typography.body}>{m.username || m.email || m.user_id}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
              <Button
                title="Share milestone"
                variant="secondary"
                loading={busy}
                onPress={async () => {
                  setBusy(true);
                  setRpgNote('');
                  try {
                    const r = await api.post('/api/campaign/friends/share-milestone', {
                      friendUserId: m.user_id,
                      badge: { id: 'shared_setup', label: 'Shared a setup win' },
                    });
                    setRpgNote(r.data?.message || 'Milestone shared');
                  } catch (err) {
                    setError(err.response?.data?.error?.message || err.message || 'Share failed');
                  } finally {
                    setBusy(false);
                  }
                }}
                style={{ alignSelf: 'flex-start' }}
              />
              <Button
                title="Assist (read-only)"
                variant="secondary"
                loading={busy}
                onPress={async () => {
                  setBusy(true);
                  setRpgNote('');
                  try {
                    const r = await api.post('/api/campaign/friends/assist', {
                      friendUserId: m.user_id,
                      chapterId: assistChapter || 'welcome',
                    });
                    setRpgNote(r.data?.hint || 'Assist opened');
                  } catch (err) {
                    setError(err.response?.data?.error?.message || err.message || 'Assist failed');
                  } finally {
                    setBusy(false);
                  }
                }}
                style={{ alignSelf: 'flex-start' }}
              />
            </View>
          </View>
        ))}
        {(members || []).filter((m) => String(m.user_id) !== String(meId)).length === 0 ? (
          <Text style={{ ...typography.caption, marginTop: 6 }}>
            Invite a friend first — RPG share needs another member on this project.
          </Text>
        ) : null}
        <TextInput
          value={assistChapter}
          onChangeText={setAssistChapter}
          placeholder="Chapter id for assist (e.g. welcome)"
          placeholderTextColor={colors.textMuted}
          style={{
            marginTop: 8,
            borderWidth: 1,
            borderColor: colors.border || '#ddd',
            borderRadius: 6,
            padding: 8,
            color: colors.textPrimary,
          }}
        />
        {rpgNote ? (
          <Text style={{ ...typography.caption, marginTop: 8, color: colors.textMuted }}>{rpgNote}</Text>
        ) : null}
      </View>

      <View style={S.drawerCard}>
        <Text style={typography.body}>Active members</Text>
        {(members || []).length === 0 ? (
          <Text style={typography.caption}>No membership ACL yet — project is open until the first invite or member.</Text>
        ) : members.map((m) => (
          <View key={m.id || m.user_id} style={{ marginTop: 8 }}>
            <Text style={typography.body}>{m.username || m.email || m.user_id}</Text>
            <Text style={typography.caption}>{m.role} · {m.user_id}</Text>
            <StatusChip status={m.status || 'active'} />
            {isOwner && m.role !== 'owner' ? (
              <Button
                title="Revoke"
                variant="secondary"
                onPress={async () => {
                  setBusy(true);
                  try {
                    await projectService.revokeMember(projectId, m.user_id);
                    await load();
                  } catch (err) {
                    setError(err.response?.data?.error?.message || err.message || 'Revoke failed');
                  } finally {
                    setBusy(false);
                  }
                }}
                style={{ alignSelf: 'flex-start', marginTop: 6 }}
              />
            ) : null}
          </View>
        ))}
        <Button title="Refresh" variant="secondary" onPress={load} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
        {myRole && myRole !== 'owner' ? (
          <Button
            title="Leave project"
            variant="secondary"
            loading={busy}
            onPress={async () => {
              setBusy(true);
              try {
                await projectService.leaveProject(projectId);
                await load();
              } catch (err) {
                setError(err.response?.data?.error?.message || err.message || 'Leave failed');
              } finally {
                setBusy(false);
              }
            }}
            style={{ alignSelf: 'flex-start', marginTop: 8 }}
          />
        ) : null}
        {isOwner && (members || []).length > 0 ? (
          <Button
            title="Clear membership (reopen)"
            variant="secondary"
            loading={busy}
            onPress={async () => {
              setBusy(true);
              try {
                await projectService.clearMembership(projectId);
                await load();
              } catch (err) {
                setError(err.response?.data?.error?.message || err.message || 'Clear failed');
              } finally {
                setBusy(false);
              }
            }}
            style={{ alignSelf: 'flex-start', marginTop: 8 }}
          />
        ) : null}
      </View>

      {isOwner ? (
        <View style={S.drawerCard}>
          <Text style={typography.body}>Create invite</Text>
          <Text style={typography.caption}>AWS RAM-style share token. Friend accepts with the token below.</Text>
          <TextInput
            style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 6, padding: 8, marginTop: 6, color: colors.textPrimary }}
            value={role}
            onChangeText={setRole}
            placeholder="Role: owner | member | viewer"
            placeholderTextColor={colors.textMuted}
          />
          <TextInput
            style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 6, padding: 8, marginTop: 6, color: colors.textPrimary }}
            value={inviteEmail}
            onChangeText={setInviteEmail}
            placeholder="Optional email (mailto / copy — no SMTP)"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Button title="Create invite" loading={busy} onPress={createInvite} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
          {lastToken ? (
            <View style={{ marginTop: 8 }}>
              <Text style={typography.caption} selectable>Token: {lastToken}</Text>
              {lastEmail ? (
                <Text style={typography.caption} selectable>Email: {lastEmail}</Text>
              ) : null}
              <Button title="Copy token" variant="secondary" onPress={() => doCopy(lastToken, 'Token copied')} style={{ alignSelf: 'flex-start', marginTop: 6 }} />
              {lastEmail ? (
                <Button
                  title="Copy mailto"
                  variant="secondary"
                  onPress={() => doCopy(
                    `mailto:${lastEmail}?subject=Project%20invite&body=Token%3A%20${encodeURIComponent(lastToken)}`,
                    'Mailto copied',
                  )}
                  style={{ alignSelf: 'flex-start', marginTop: 6 }}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {isOwner ? (
        <View style={S.drawerCard}>
          <Text style={typography.body}>Pending invites</Text>
          {(invites || []).filter((i) => i.status === 'pending').length === 0 ? (
            <Text style={typography.caption}>None pending.</Text>
          ) : invites.filter((i) => i.status === 'pending').map((i) => (
            <View key={i.id} style={{ marginTop: 8 }}>
              <Text style={typography.caption}>{i.role} · expires {i.expires_at || '—'}{i.email ? ` · ${i.email}` : ''}</Text>
              <Text style={typography.caption} selectable>{i.token}</Text>
              <StatusChip status={i.status} />
              <Button title="Copy token" variant="secondary" onPress={() => doCopy(i.token, 'Token copied')} style={{ alignSelf: 'flex-start', marginTop: 6 }} />
              {i.email ? (
                <Button
                  title="Copy mailto"
                  variant="secondary"
                  onPress={() => doCopy(
                    `mailto:${i.email}?subject=Project%20invite&body=Token%3A%20${encodeURIComponent(i.token)}`,
                    'Mailto copied',
                  )}
                  style={{ alignSelf: 'flex-start', marginTop: 6 }}
                />
              ) : null}
              <Button
                title="Revoke invite"
                variant="secondary"
                onPress={async () => {
                  setBusy(true);
                  try {
                    await projectService.revokeInvite(projectId, i.id);
                    await load();
                  } catch (err) {
                    setError(err.response?.data?.error?.message || err.message || 'Revoke invite failed');
                  } finally {
                    setBusy(false);
                  }
                }}
                style={{ alignSelf: 'flex-start', marginTop: 6 }}
              />
            </View>
          ))}
        </View>
      ) : null}

      <View style={S.drawerCard}>
        <Text style={typography.body}>Accept invite</Text>
        <TextInput
          style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 6, padding: 8, marginTop: 6, color: colors.textPrimary }}
          value={acceptToken}
          onChangeText={setAcceptToken}
          placeholder="Paste invite token"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
        />
        <Button title="Accept" loading={busy} onPress={accept} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
      </View>
      </>
      )}
    </ScrollView>
  );
}

export function IcarusSkillsDrawer({ projectId, agent, skills = [], onRefresh }) {
  const [catalog, setCatalog] = useState([]);
  const [marketplace, setMarketplace] = useState([]);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const loadCatalog = useCallback(async () => {
    if (!projectId) return;
    try {
      const [cat, market] = await Promise.all([
        aiManagerService.listSkillCatalog(projectId),
        aiManagerService.icarusMarketplace(projectId).catch(() => []),
      ]);
      setCatalog(Array.isArray(cat) ? cat : []);
      setMarketplace(Array.isArray(market) ? market : []);
    } catch { /* optional */ }
  }, [projectId]);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);

  const ensureCatalog = async () => {
    setBusy(true);
    try {
      await aiManagerService.ensureSkillCatalog(projectId);
      await loadCatalog();
    } finally { setBusy(false); }
  };

  const createCatalogSkill = async () => {
    const name = String(newName || '').trim();
    if (!name) return;
    setBusy(true);
    try {
      await aiManagerService.createSkillCatalogItem(projectId, {
        name,
        display_name: name,
        template: { kind: 'prompt', body: '', version: '1.0.0' },
        source: 'user',
      });
      setNewName('');
      await loadCatalog();
    } finally { setBusy(false); }
  };

  const installListing = async (listingId) => {
    setBusy(true);
    try {
      await aiManagerService.marketplaceInstall(projectId, listingId);
      await loadCatalog();
      await onRefresh?.();
    } finally { setBusy(false); }
  };

  return (
    <ScrollView style={S.sectionBody}>
      <Text style={S.sectionTitle}>Skills</Text>
      <Text style={S.sectionSub}>Agent skills and marketplace packs for this project friend.</Text>
      <Text style={{ ...typography.caption, marginTop: spacing.sm }}>Project catalog</Text>
      {(catalog || []).length === 0 ? (
        <Text style={typography.caption}>No catalog skills yet — ensure built-ins or create one.</Text>
      ) : catalog.map((sk) => (
        <View key={sk.id || sk.name} style={S.drawerCard}>
          <Text style={typography.body}>{sk.display_name || sk.name}</Text>
          <Text style={typography.caption}>{sk.source || 'user'} · {sk.status || 'ready'}</Text>
        </View>
      ))}
      <TextInput
        style={{
          borderWidth: 1, borderColor: colors.border, borderRadius: 6, padding: 8, marginTop: 8, color: colors.textPrimary,
        }}
        value={newName}
        onChangeText={setNewName}
        placeholder="New skill name"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
      />
      <Button title="Create catalog skill" variant="secondary" onPress={createCatalogSkill} loading={busy} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
      <Button title="Ensure built-in catalog" variant="secondary" onPress={ensureCatalog} loading={busy} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
      <Text style={{ ...typography.caption, marginTop: spacing.md }}>Attached to agent</Text>
      {(skills || []).length === 0 ? (
        <Text style={typography.caption}>No skills attached yet.</Text>
      ) : skills.map((sk) => (
        <View key={sk.id || sk.name} style={S.drawerCard}>
          <Text style={typography.body}>{sk.name || sk.id}</Text>
          <Text style={typography.caption}>{sk.description || sk.summary || ''}</Text>
        </View>
      ))}
      <Button title="Refresh" variant="secondary" onPress={() => { onRefresh?.(); loadCatalog(); }} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
      {(marketplace || []).length > 0 ? (
        <>
          <Text style={{ ...typography.caption, marginTop: spacing.md }}>Marketplace</Text>
          {marketplace.map((row) => (
            <View key={row.id} style={S.drawerCard}>
              <Text style={typography.body}>{row.name}</Text>
              <Text style={typography.caption}>{row.description || row.visibility || ''}</Text>
              <Button
                title="Install"
                variant="secondary"
                loading={busy}
                onPress={() => installListing(row.id)}
                style={{ alignSelf: 'flex-start', marginTop: 6 }}
              />
            </View>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

export function IcarusConnectorsDrawer({
  projectId, connectors = [], kinds = [], onRefresh,
}) {
  const [form, setForm] = useState({ name: 'mail', kind: 'gmail', secret_ref: '' });
  const [busy, setBusy] = useState(false);
  const create = async () => {
    setBusy(true);
    try {
      await aiManagerService.createConnector(projectId, form);
      await onRefresh?.();
    } finally { setBusy(false); }
  };
  return (
    <ScrollView style={S.sectionBody}>
      <Text style={S.sectionTitle}>Connectors</Text>
      <Text style={S.sectionSub}>Gmail and other connector kinds for the agent shop.</Text>
      {(connectors || []).map((c) => (
        <View key={c.id} style={S.drawerCard}>
          <Text style={typography.body}>{c.name}</Text>
          <Text style={typography.caption}>{c.kind} · {c.status || 'ok'}</Text>
        </View>
      ))}
      <Text style={{ ...typography.caption, marginTop: spacing.md }}>Add connector</Text>
      <TextInput
        style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 6, padding: 8, marginTop: 6, color: colors.textPrimary }}
        value={form.name}
        onChangeText={(name) => setForm((f) => ({ ...f, name }))}
        placeholder="Name"
        placeholderTextColor={colors.textMuted}
      />
      <TextInput
        style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 6, padding: 8, marginTop: 6, color: colors.textPrimary }}
        value={form.kind}
        onChangeText={(kind) => setForm((f) => ({ ...f, kind }))}
        placeholder="Kind"
        placeholderTextColor={colors.textMuted}
      />
      <TextInput
        style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 6, padding: 8, marginTop: 6, color: colors.textPrimary }}
        value={form.secret_ref}
        onChangeText={(secret_ref) => setForm((f) => ({ ...f, secret_ref }))}
        placeholder="Secret ref"
        placeholderTextColor={colors.textMuted}
      />
      {(kinds || []).length ? (
        <Text style={{ ...typography.caption, marginTop: 6 }}>
          Kinds: {kinds.map((k) => k.id || k.name || k).join(', ')}
        </Text>
      ) : null}
      <Button title="Create" onPress={create} loading={busy} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
    </ScrollView>
  );
}

export function IcarusCronDrawer({ projectId, agent, crons = [], onRefresh }) {
  const [name, setName] = useState('monday-inbox');
  const [schedule, setSchedule] = useState('0 9 * * 1');
  const [objective, setObjective] = useState('count inbox');
  const [busy, setBusy] = useState(false);
  if (!agent) {
    return (
      <View style={S.sectionBody}>
        <Text style={S.sectionTitle}>Cron</Text>
        <Text style={typography.caption}>Setup Icarus first.</Text>
      </View>
    );
  }
  return (
    <ScrollView style={S.sectionBody}>
      <Text style={S.sectionTitle}>Cron</Text>
      <Text style={S.sectionSub}>Scheduled handoffs for this agent.</Text>
      {(crons || []).map((c) => (
        <View key={c.id} style={S.drawerCard}>
          <Text style={typography.body}>{c.name}</Text>
          <Text style={typography.caption}>{c.schedule}</Text>
          <Button
            title="Fire"
            variant="secondary"
            onPress={() => aiManagerService.agentFireCron(projectId, agent.id, c.id).then(onRefresh)}
            style={{ alignSelf: 'flex-start', marginTop: 6 }}
          />
        </View>
      ))}
      <TextInput
        style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 6, padding: 8, marginTop: 8, color: colors.textPrimary }}
        value={name}
        onChangeText={setName}
        placeholder="Name"
        placeholderTextColor={colors.textMuted}
      />
      <TextInput
        style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 6, padding: 8, marginTop: 6, color: colors.textPrimary }}
        value={schedule}
        onChangeText={setSchedule}
        placeholder="Cron schedule"
        placeholderTextColor={colors.textMuted}
      />
      <TextInput
        style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 6, padding: 8, marginTop: 6, color: colors.textPrimary }}
        value={objective}
        onChangeText={setObjective}
        placeholder="Objective"
        placeholderTextColor={colors.textMuted}
      />
      <Button
        title="Create cron"
        loading={busy}
        onPress={async () => {
          setBusy(true);
          try {
            await aiManagerService.agentCreateCron(projectId, agent.id, {
              name, schedule, handoff: { objective },
            });
            await onRefresh?.();
          } finally { setBusy(false); }
        }}
        style={{ alignSelf: 'flex-start', marginTop: 8 }}
      />
    </ScrollView>
  );
}

export function IcarusAdvancedDrawer({
  session,
}) {
  const {
    agent, projectId, pulseLive, stream, timeline, fs, openFs, termOut, runTerm, pins, rolls, settings,
  } = session;
  const [cmd, setCmd] = useState('pwd');
  const [specName, setSpecName] = useState('booking-icarus');
  const [specSpecialty, setSpecSpecialty] = useState('booking');
  const [specNote, setSpecNote] = useState('');
  const [specBusy, setSpecBusy] = useState(false);
  if (!agent) {
    return (
      <View style={S.sectionBody}>
        <Text style={S.sectionTitle}>Advanced</Text>
        <Text style={typography.caption}>Setup Icarus first.</Text>
      </View>
    );
  }
  return (
    <ScrollView style={S.sectionBody}>
      <Text style={S.sectionTitle}>Advanced</Text>
      <Text style={S.sectionSub}>
        FS jail, terminal, friend memory (pins/rolls), and the old orbit shop viz.
        App memory stores live under Apps → Memory.
      </Text>
      <IcarusVisual
        pulse={pulseLive || { work: session.work, workers: session.workers, open_asks: session.openAsks, gateway: session.gateway }}
        stream={stream}
        timeline={timeline}
        style={{ height: 180, marginBottom: spacing.md }}
      />
      <View style={S.drawerCard}>
        <Text style={typography.body}>Specialist agents (Want14)</Text>
        <Text style={typography.caption}>
          Create a parallel Icarus specialist (e.g. booking). Primary stays the companion; specialists talk via AgentBus.
        </Text>
        <TextInput
          style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 6, padding: 8, marginTop: 6, color: colors.textPrimary }}
          value={specName}
          onChangeText={setSpecName}
          placeholder="agent name"
          placeholderTextColor={colors.textMuted}
        />
        <TextInput
          style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 6, padding: 8, marginTop: 6, color: colors.textPrimary }}
          value={specSpecialty}
          onChangeText={setSpecSpecialty}
          placeholder="specialty (booking|general)"
          placeholderTextColor={colors.textMuted}
        />
        <Button
          title="Create specialist"
          variant="secondary"
          loading={specBusy}
          onPress={async () => {
            setSpecBusy(true);
            setSpecNote('');
            try {
              const out = await aiManagerService.createSpecialist(projectId, {
                name: specName.trim(),
                specialty: specSpecialty.trim() || 'general',
              });
              setSpecNote(`Created ${out?.agent?.name || specName} (${out?.agent?.id || 'ok'})`);
            } catch (err) {
              setSpecNote(err.response?.data?.error?.message || err.message || 'Create failed');
            } finally {
              setSpecBusy(false);
            }
          }}
          style={{ alignSelf: 'flex-start', marginTop: 8 }}
        />
        {specNote ? <Text style={{ ...typography.caption, marginTop: 6 }}>{specNote}</Text> : null}
      </View>
      <View style={S.drawerCard}>
        <Text style={typography.body}>Friend memory</Text>
        <Text style={typography.caption}>{(pins || []).length} pins · rolls keys: {Object.keys(rolls || {}).join(', ') || 'none'}</Text>
        <Button
          title="Refresh rolls"
          variant="secondary"
          onPress={() => aiManagerService.agentRefreshRolls(projectId, agent.id)}
          style={{ alignSelf: 'flex-start', marginTop: 6 }}
        />
      </View>
      <View style={S.drawerCard}>
        <Text style={typography.body}>Write policy</Text>
        <Text style={typography.caption}>
          {settings?.write_policy || settings?.fs_policy || 'Uses agent settings / ASK approve for destructive tools.'}
        </Text>
      </View>
      <View style={S.drawerCard}>
        <Text style={typography.body}>FS jail</Text>
        <Button title="List ." variant="secondary" onPress={() => openFs('.')} style={{ alignSelf: 'flex-start', marginTop: 6 }} />
        {(fs?.entries || []).slice(0, 30).map((e) => (
          <Text key={e.name || e.path} style={typography.caption}>{e.name || e.path}</Text>
        ))}
      </View>
      <View style={S.drawerCard}>
        <Text style={typography.body}>Terminal</Text>
        <TextInput
          style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 6, padding: 8, marginTop: 6, color: colors.textPrimary }}
          value={cmd}
          onChangeText={setCmd}
          placeholderTextColor={colors.textMuted}
        />
        <Button title="Run" variant="secondary" onPress={() => runTerm(cmd)} style={{ alignSelf: 'flex-start', marginTop: 6 }} />
        {termOut ? <Text style={typography.caption} selectable>{termOut}</Text> : null}
      </View>
    </ScrollView>
  );
}
