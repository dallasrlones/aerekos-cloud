import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView } from 'react-native';
import { Button } from '../../components/Button/Button';
import { federationService } from '../../services/federationService';
import { colors, typography } from '../../styles/theme';
import { IcarusStyles as S } from './Icarus.styles';

function FedStatusChip({ status }) {
  const s = String(status || 'connecting').toLowerCase();
  const tone = s === 'active'
    ? { bg: '#D8E8D8', fg: '#2F6B2F' }
    : s === 'degraded' || s === 'connecting'
      ? { bg: '#F5E6C8', fg: '#8A6A20' }
      : { bg: '#F0D6D6', fg: '#8B2E2E' };
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

export function IcarusFederationPanel({ projectId }) {
  const [peer, setPeer] = useState(null);
  const [peers, setPeers] = useState([]);
  const [attaches, setAttaches] = useState([]);
  const [remotePeerJson, setRemotePeerJson] = useState('');
  const [grantToken, setGrantToken] = useState('');
  const [lastGrant, setLastGrant] = useState('');
  const [maturity, setMaturity] = useState('preview');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [proxyHint, setProxyHint] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const card = await federationService.getPeerCard();
      setPeer(card.peer || null);
      if (card.maturity) setMaturity(card.maturity);
      const pl = await federationService.listPeers();
      setPeers(pl.peers || []);
      const al = await federationService.listAttaches();
      setAttaches(al.attaches || []);
      if (al.maturity) setMaturity(al.maturity);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load federation');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const doCopy = (text, label) => {
    copyText(text);
    setCopied(label || 'copied');
    setTimeout(() => setCopied(''), 1500);
  };

  return (
    <ScrollView>
      <Text style={S.sectionSub}>
        Attach a remote conductor project via signed grant. Jobs stay on the home conductor.
        Maturity: {String(maturity || 'preview').toUpperCase()}.
      </Text>
      {error ? (
        <Text style={{ ...typography.caption, color: colors.danger || '#8B2E2E', marginBottom: 8 }}>{error}</Text>
      ) : null}
      {copied ? (
        <Text style={{ ...typography.caption, color: colors.textMuted, marginBottom: 8 }}>{copied}</Text>
      ) : null}

      <View style={S.drawerCard}>
        <Text style={typography.body}>This peer card</Text>
        <Text style={typography.caption} selectable>
          {peer ? JSON.stringify(peer, null, 2) : 'Loading…'}
        </Text>
        <Button
          title="Copy peer card"
          variant="secondary"
          onPress={() => doCopy(JSON.stringify(peer || {}), 'Peer card copied')}
          style={{ alignSelf: 'flex-start', marginTop: 8 }}
        />
        <Button title="Refresh" variant="secondary" onPress={load} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
      </View>

      <View style={S.drawerCard}>
        <Text style={typography.body}>Trust remote peer</Text>
        <Text style={typography.caption}>Paste a peer card JSON from another conductor.</Text>
        <TextInput
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 6,
            padding: 8,
            marginTop: 6,
            color: colors.textPrimary,
            minHeight: 80,
          }}
          value={remotePeerJson}
          onChangeText={setRemotePeerJson}
          placeholder='{"peer_id":"...","public_key":"...","base_url":"https://..."}'
          placeholderTextColor={colors.textMuted}
          multiline
          autoCapitalize="none"
        />
        <Button
          title="Register peer"
          loading={busy}
          onPress={async () => {
            setBusy(true);
            setError('');
            try {
              const parsed = JSON.parse(remotePeerJson);
              await federationService.registerPeer(parsed.peer || parsed);
              setRemotePeerJson('');
              await load();
            } catch (err) {
              setError(err.response?.data?.error?.message || err.message || 'Register failed');
            } finally {
              setBusy(false);
            }
          }}
          style={{ alignSelf: 'flex-start', marginTop: 8 }}
        />
        {(peers || []).map((p) => (
          <View key={p.peer_id || p.id} style={{ marginTop: 8 }}>
            <Text style={typography.body}>{p.label || p.peer_id}</Text>
            <Text style={typography.caption}>{p.base_url}</Text>
            <FedStatusChip status={p.status || 'trusted'} />
          </View>
        ))}
      </View>

      {projectId ? (
        <View style={S.drawerCard}>
          <Text style={typography.body}>Mint grant (home)</Text>
          <Text style={typography.caption}>Signed grant for this project — share with the remote conductor.</Text>
          <Button
            title="Mint grant"
            loading={busy}
            onPress={async () => {
              setBusy(true);
              setError('');
              try {
                const res = await federationService.mintGrant(projectId, { role: 'member' });
                setLastGrant(res.token || '');
                await load();
              } catch (err) {
                setError(err.response?.data?.error?.message || err.message || 'Mint failed');
              } finally {
                setBusy(false);
              }
            }}
            style={{ alignSelf: 'flex-start', marginTop: 8 }}
          />
          {lastGrant ? (
            <View style={{ marginTop: 8 }}>
              <Text style={typography.caption} selectable>Grant: {lastGrant.slice(0, 48)}…</Text>
              <Button title="Copy grant" variant="secondary" onPress={() => doCopy(lastGrant, 'Grant copied')} style={{ alignSelf: 'flex-start', marginTop: 6 }} />
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={S.drawerCard}>
        <Text style={typography.body}>Accept grant (remote)</Text>
        <TextInput
          style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 6, padding: 8, marginTop: 6, color: colors.textPrimary }}
          value={grantToken}
          onChangeText={setGrantToken}
          placeholder="Paste federation grant token"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
        />
        <Button
          title="Attach"
          loading={busy}
          onPress={async () => {
            if (!grantToken.trim()) return;
            setBusy(true);
            setError('');
            try {
              await federationService.attach(grantToken.trim());
              setGrantToken('');
              await load();
            } catch (err) {
              setError(err.response?.data?.error?.message || err.message || 'Attach failed');
            } finally {
              setBusy(false);
            }
          }}
          style={{ alignSelf: 'flex-start', marginTop: 8 }}
        />
      </View>

      <View style={S.drawerCard}>
        <Text style={typography.body}>Attached remote projects</Text>
        {(attaches || []).length === 0 ? (
          <Text style={typography.caption}>None yet.</Text>
        ) : attaches.map((a) => (
          <View key={a.id} style={{ marginTop: 10 }}>
            <Text style={typography.body}>{a.label || a.home_project_id}</Text>
            <Text style={typography.caption}>{a.home_peer_id} · {a.home_base_url}</Text>
            <FedStatusChip status={a.status} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
              <Button
                title="Refresh status"
                variant="secondary"
                onPress={async () => {
                  setBusy(true);
                  try {
                    const st = await federationService.attachStatus(a.id);
                    setAttaches((prev) => prev.map((x) => (x.id === a.id ? { ...x, status: st.status } : x)));
                  } catch (err) {
                    setError(err.response?.data?.error?.message || err.message || 'Status failed');
                  } finally {
                    setBusy(false);
                  }
                }}
              />
              <Button
                title="Proxy project"
                variant="secondary"
                onPress={async () => {
                  setBusy(true);
                  setProxyHint('');
                  try {
                    const data = await federationService.proxyProject(a.id);
                    setProxyHint(data?.project?.name || data?.name || JSON.stringify(data).slice(0, 120));
                    await load();
                  } catch (err) {
                    setError(err.response?.data?.error?.message || err.message || 'Proxy failed');
                  } finally {
                    setBusy(false);
                  }
                }}
              />
              <Button
                title="Detach"
                variant="secondary"
                onPress={async () => {
                  setBusy(true);
                  try {
                    await federationService.detach(a.id);
                    await load();
                  } catch (err) {
                    setError(err.response?.data?.error?.message || err.message || 'Detach failed');
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </View>
          </View>
        ))}
        {proxyHint ? (
          <Text style={{ ...typography.caption, marginTop: 8 }}>Home project: {proxyHint}</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

export default IcarusFederationPanel;
