import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Text, ScrollView, TextInput, TouchableOpacity, View } from 'react-native';
import { Page } from '../../components/ui';
import { Box } from '../../components/Box/Box';
import { Button } from '../../components/Button/Button';
import { NextSteps } from '../../components/NextSteps/NextSteps';
import { HostnameSheet } from '../../components/HostnameSheet/HostnameSheet';
import { useProject } from '../../contexts/ProjectContext';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import { colors } from '../../styles/theme';
import { SYSTEM_PROJECT_ID } from '../../services/projectInventory';
import { edgeService } from '../../services/edgeService';
import { GitCodeView } from './GitCodeView';
import { GitReadme } from './GitReadme';
import { parseUnifiedDiff } from './parseUnifiedDiff';
import { README_NAMES } from './languageFromPath';
import { GitStyles as S } from './GitManager.styles';

const TABS = [
  { id: 'files', label: 'Code' },
  { id: 'commits', label: 'Commits' },
  { id: 'pulls', label: 'Pull requests' },
  { id: 'issues', label: 'Issues' },
  { id: 'clone', label: 'Clone' },
];

function copyText(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(text);
}

function snippetBlock(title, body, extra) {
  return (
    <Box title={title}>
      <Text selectable style={{ fontFamily: 'monospace', fontSize: 12, color: colors.textPrimary }}>{body}</Text>
      <Button title="Copy" variant="secondary" onPress={() => copyText(body)} />
      {extra}
    </Box>
  );
}

function isGitOriginHost(h) {
  return Number(h.port) === 3130
    || String(h.target_id || '') === 'git_manager'
    || String(h.target_type || '') === 'platform';
}

function originBase(hosts) {
  const h = (hosts || []).find(isGitOriginHost);
  return h?.hostname ? `https://${h.hostname}` : '';
}

function cloneUrlFor(repo, hosts, typedName) {
  if (repo?.clone_url) return repo.clone_url;
  const base = originBase(hosts);
  const name = repo?.name || typedName;
  if (base && name) return `${base}/${encodeURIComponent(name)}.git`;
  return null;
}

function branchName(b) {
  return typeof b === 'string' ? b : (b?.name || '');
}

export const GitManager = ({ navigation, route }) => {
  const { currentProject, projects, isSystemProject } = useProject();
  const { getToken } = useAuth();
  const [view, setView] = useState('list');
  const [repos, setRepos] = useState([]);
  const [pulls, setPulls] = useState([]);
  const [error, setError] = useState(null);
  const [name, setName] = useState('');
  const [projectId, setProjectId] = useState(currentProject?.id || '');
  const [repo, setRepo] = useState(null);
  const [tree, setTree] = useState([]);
  const [treePath, setTreePath] = useState('');
  const [blob, setBlob] = useState(null);
  const [commits, setCommits] = useState([]);
  const [tab, setTab] = useState('files');
  const [prTitle, setPrTitle] = useState('');
  const [prSource, setPrSource] = useState('');
  const [prTarget, setPrTarget] = useState('main');
  const [pr, setPr] = useState(null);
  const [token, setToken] = useState('');
  const [gitHosts, setGitHosts] = useState([]);
  const [namedTunnels, setNamedTunnels] = useState([]);
  const [zones, setZones] = useState([]);
  const [originTunnel, setOriginTunnel] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formRow, setFormRow] = useState(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState(null);
  const [issues, setIssues] = useState([]);
  const [issueTitle, setIssueTitle] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [pipelineNote, setPipelineNote] = useState('');
  const [gitRef, setGitRef] = useState('main');
  const [branches, setBranches] = useState([]);
  const [readme, setReadme] = useState(null);

  const projectName = (id) => (projects || []).find((p) => p.id === id)?.name || id;
  const originPid = SYSTEM_PROJECT_ID || currentProject?.id;

  const loadOrigin = useCallback(async () => {
    if (!originPid) return;
    try {
      const [hosts, tunnels, z] = await Promise.all([
        edgeService.listHostnames(originPid).catch(() => []),
        edgeService.namedTunnels(originPid).catch(() => []),
        edgeService.listZones(originPid).catch(() => []),
      ]);
      const git = (hosts || []).filter(isGitOriginHost);
      setGitHosts(git);
      setNamedTunnels(tunnels || []);
      setZones(z || []);
      const prod = (tunnels || []).find((t) => t.default_bind || /prod/i.test(String(t.display_name || t.name || '')));
      setOriginTunnel(prod || tunnels?.[0] || null);
    } catch {
      setGitHosts([]);
    }
  }, [originPid]);

  const load = useCallback(async () => {
    const pid = currentProject?.id;
    if (!pid) return;
    try {
      const [r, p] = await Promise.all([
        api.get('/api/services/git_manager/api/v1/repos', { params: { project_id: pid } }),
        api.get('/api/services/git_manager/api/v1/pulls', { params: { project_id: pid } }),
      ]);
      setRepos(r.data?.repositories || r.data?.items || []);
      setPulls(p.data?.pulls || []);
      setError(null);
    } catch (e) {
      setError(e.response?.data?.error?.message || e.message);
    }
    try {
      const t = await getToken();
      if (t) setToken(t);
    } catch (_) { /* ignore */ }
    await loadOrigin();
  }, [currentProject?.id, getToken, loadOrigin]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (currentProject?.id && !projectId) setProjectId(currentProject.id);
  }, [currentProject?.id, projectId]);
  useEffect(() => {
    const want = route?.params?.repoId;
    if (!want || !repos.length) return;
    const row = repos.find((r) => r.id === want);
    if (row && repo?.id !== want) openRepo(row);
  }, [route?.params?.repoId, repos]);

  const loadTree = async (row, path, ref) => {
    const t = await api.get(`/api/services/git_manager/api/v1/repos/${row.id}/tree`, {
      params: { project_id: row.project_id, path: path || '', ref: ref || gitRef },
    });
    const entries = t.data?.entries || [];
    setTree(entries);
    const readmeEntry = README_NAMES.map((n) => entries.find((e) => e.type !== 'tree' && e.name === n)).find(Boolean);
    if (readmeEntry) {
      const readmePath = path ? `${path}/${readmeEntry.name}` : readmeEntry.name;
      try {
        const b = await api.get(`/api/services/git_manager/api/v1/repos/${row.id}/blob`, {
          params: { project_id: row.project_id, path: readmePath, ref: ref || gitRef },
        });
        setReadme({ name: readmeEntry.name, content: b.data?.binary ? '' : (b.data?.content || '') });
      } catch {
        setReadme(null);
      }
    } else {
      setReadme(null);
    }
  };

  const openRepo = async (row) => {
    setRepo(row);
    setView('repo');
    setTab('files');
    setTreePath('');
    setBlob(null);
    try {
      const [c, prs, br] = await Promise.all([
        api.get(`/api/services/git_manager/api/v1/repos/${row.id}/commits`, { params: { project_id: row.project_id } }),
        api.get('/api/services/git_manager/api/v1/pulls', { params: { repo_id: row.id, project_id: row.project_id } }),
        api.get(`/api/services/git_manager/api/v1/repos/${row.id}/branches`, { params: { project_id: row.project_id } }).catch(() => ({ data: {} })),
      ]);
      setCommits(c.data?.commits || []);
      setPulls(prs.data?.pulls || []);
      const branchList = br.data?.branches || br.data?.items || [];
      setBranches(branchList);
      const def = branchList.find((b) => b.default || branchName(b) === 'main') || branchList[0];
      const nextRef = branchName(def) || 'main';
      setGitRef(nextRef);
      await loadTree(row, '', nextRef);
      try {
        const iss = await api.get('/api/services/git_manager/api/v1/issues', {
          params: { repo_id: row.id, project_id: row.project_id },
        });
        setIssues(iss.data?.issues || []);
      } catch { setIssues([]); }
      try {
        const pipes = await api.get('/api/services/cicd_manager/api/v1/pipelines', {
          params: { project_id: row.project_id },
        });
        const mine = (pipes.data?.pipelines || pipes.data?.items || []).filter((p) => p.repo_name === row.name || p.repo_id === row.id);
        const last = mine[0];
        let extra = '';
        try { extra = last?.last_run_json ? JSON.parse(last.last_run_json) : {}; } catch { extra = {}; }
        setPipelineNote(last
          ? `${last.name} · ${last.state || 'idle'}${extra.reason ? ` · ${extra.reason}` : extra.action ? ` · ${extra.action}` : ''}`
          : 'No pipeline linked');
      } catch { setPipelineNote(''); }
    } catch (e) {
      setError(e.response?.data?.error?.message || e.message);
    }
  };

  const openBlob = async (entry) => {
    if (entry.type === 'tree') {
      const next = treePath ? `${treePath}/${entry.name}` : entry.name;
      setTreePath(next);
      setBlob(null);
      await loadTree(repo, next, gitRef);
      return;
    }
    const path = treePath ? `${treePath}/${entry.name}` : entry.name;
    const b = await api.get(`/api/services/git_manager/api/v1/repos/${repo.id}/blob`, {
      params: { project_id: repo.project_id, path, ref: gitRef },
    });
    setBlob({ path, ...b.data });
    setReadme(null);
  };

  const createRepo = async () => {
    try {
      const pid = projectId || currentProject?.id;
      const res = await api.post('/api/services/git_manager/api/v1/repos', {
        project_id: pid,
        name: name.trim(),
      });
      setName('');
      await load();
      const created = res.data?.repository;
      if (created) openRepo(created);
    } catch (e) {
      setError(e.response?.data?.error?.message || e.message);
    }
  };

  const createPr = async () => {
    try {
      await api.post('/api/services/git_manager/api/v1/pulls', {
        project_id: repo.project_id,
        repo_id: repo.id,
        title: prTitle || `${prSource} → ${prTarget}`,
        source_branch: prSource,
        target_branch: prTarget || 'main',
      });
      setPrTitle('');
      const prs = await api.get('/api/services/git_manager/api/v1/pulls', {
        params: { repo_id: repo.id, project_id: repo.project_id },
      });
      setPulls(prs.data?.pulls || []);
    } catch (e) {
      setError(e.response?.data?.error?.message || e.message);
    }
  };

  const openPr = async (row) => {
    try {
      const res = await api.get(`/api/services/git_manager/api/v1/pulls/${row.id}`, {
        params: { project_id: row.project_id || repo?.project_id },
      });
      setPr(res.data);
      setView('pr');
    } catch (e) {
      setError(e.response?.data?.error?.message || e.message);
    }
  };

  const mergePr = async () => {
    const target = pr?.pull?.target_branch || 'main';
    if (typeof window !== 'undefined' && window.confirm) {
      const fleet = repo?.name === 'aerekos-cloud';
      const msg = fleet
        ? 'This updates every device.'
        : target === 'main'
          ? 'This deploys prod.'
          : `This deploys ${target === 'develop' ? 'dev' : target}.`;
      if (!window.confirm(`Merge ${pr.pull.source_branch} → ${target}? ${msg}`)) return;
    }
    try {
      await api.post(`/api/services/git_manager/api/v1/pulls/${pr.pull.id}/merge`, {
        project_id: pr.pull.project_id,
      });
      setView('repo');
      await openRepo(repo);
    } catch (e) {
      setError(e.response?.data?.error?.message || e.message);
    }
  };

  const handleSaveOrigin = async ({ subdomain, domain, port, hostname }) => {
    if (!originPid) return;
    const tun = originTunnel;
    if (!tun) {
      setFormError('Attach an existing tunnel first (Edge). Do not mint a new one.');
      return;
    }
    if (!hostname) {
      setFormError('Hostname is required.');
      return;
    }
    setFormBusy(true);
    setFormError(null);
    try {
      await edgeService.attachHostname(originPid, {
        tunnel_id: tun.id || tun.cf_tunnel_id,
        subdomain,
        domain,
        port: port || 3130,
        previous_hostname: formRow?.hostname || '',
      });
      setFormOpen(false);
      setFormRow(null);
      await loadOrigin();
    } catch (err) {
      setFormError(err.response?.data?.error?.message || err.message || 'Save failed');
    } finally {
      setFormBusy(false);
    }
  };

  const handleUnbindOrigin = async (row) => {
    if (!originPid || !row?.hostname) return;
    const tun = namedTunnels.find((t) => t.id === row.tunnel_id || t.cf_tunnel_id === row.tunnel_id) || originTunnel;
    if (!tun) {
      setError('No tunnel on this hostname to detach.');
      return;
    }
    try {
      await edgeService.detachHostname(originPid, {
        hostname: row.hostname,
        tunnel_id: tun.id || tun.cf_tunnel_id,
      });
      await loadOrigin();
    } catch (e) {
      setError(e.response?.data?.error?.message || e.message);
    }
  };

  const cloneUrl = cloneUrlFor(repo, gitHosts, name.trim());
  const displayName = repo?.name || name.trim() || '<repo>';

  const copyBlocks = (r) => {
    const url = cloneUrlFor(r, gitHosts, r?.name || displayName);
    if (!url) {
      return (
        <Box title="Add an origin hostname">
          <Text>Bind a hostname on port 3130 (existing tunnel) before cloning. Repos stay private — clone still needs a console JWT or GIT_AUTH_TOKEN.</Text>
        </Box>
      );
    }
    const newCmd = `echo "# ${displayName}" >> README.md\ngit init\ngit add README.md\ngit commit -m "first commit"\ngit branch -M main\ngit remote add aerekos-git ${url}\ngit push -u aerekos-git main`;
    const existCmd = `git remote add aerekos-git ${url}\ngit push -u aerekos-git main`;
    const switchCmd = `git remote add aerekos-git ${url}\n# or replace origin:\ngit remote set-url origin ${url}\ngit remote -v`;
    return (
      <>
        {snippetBlock('Create a new repository on the command line', newCmd)}
        {snippetBlock('…or push an existing repository', existCmd)}
        {snippetBlock('…or switch the remote', switchCmd)}
        {snippetBlock('Auth (password = console JWT or GIT_AUTH_TOKEN)', '# username: anything; password: console JWT or GIT_AUTH_TOKEN\n# do not put the token in the clone URL\ngit config credential.helper osxkeychain')}
        {r?.lan_clone_url ? snippetBlock('LAN fallback (if TLS is intercepted)', r.lan_clone_url) : null}
        {token ? (
          <Text style={S.muted}>
            Signed in — use the console JWT as the HTTPS password via a credential helper. Do not commit it.
          </Text>
        ) : null}
      </>
    );
  };

  const originSection = (
    <Box title="Origin hostname">
      <Text style={S.muted}>
        Private Git over Smart HTTP. A bound hostname is only the front door — clone/fetch/push still require login.
      </Text>
      {namedTunnels.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          {namedTunnels.map((t) => (
            <Button
              key={t.id || t.cf_tunnel_id}
              title={t.display_name || t.name || t.device_hostname || 'tunnel'}
              variant={(originTunnel?.id || originTunnel?.cf_tunnel_id) === (t.id || t.cf_tunnel_id) ? 'primary' : 'secondary'}
              onPress={() => setOriginTunnel(t)}
            />
          ))}
        </View>
      ) : (
        <Text style={S.muted}>No existing tunnel. Attach one in Edge — this screen will not mint one.</Text>
      )}
      {gitHosts.map((h) => (
        <View key={h.id || h.hostname} style={S.hostRow}>
          <Text selectable style={{ flex: 1, color: colors.textPrimary }}>{h.hostname} → :{h.port || 3130}</Text>
          <Button title="Edit" variant="secondary" onPress={() => { setFormRow({ ...h, port: h.port || 3130 }); setFormError(null); setFormOpen(true); }} />
          <Button title="Unbind" variant="secondary" onPress={() => handleUnbindOrigin(h)} />
        </View>
      ))}
      {!gitHosts.length ? <Text style={S.muted}>No origin hostname yet.</Text> : null}
      <Button
        title="Add hostname"
        variant="secondary"
        onPress={() => { setFormRow({ port: 3130 }); setFormError(null); setFormOpen(true); }}
      />
    </Box>
  );

  const fileTable = () => {
    const folders = tree.filter((e) => e.type === 'tree').sort((a, b) => a.name.localeCompare(b.name));
    const files = tree.filter((e) => e.type !== 'tree').sort((a, b) => a.name.localeCompare(b.name));
    const rows = [...folders, ...files];
    const crumbs = treePath.split('/').filter(Boolean);
    return (
      <>
        <View style={S.crumbRow}>
          <TouchableOpacity onPress={async () => { setTreePath(''); setBlob(null); await loadTree(repo, '', gitRef); }}>
            <Text style={crumbs.length ? S.crumb : S.crumbCurrent}>{repo.name}</Text>
          </TouchableOpacity>
          {crumbs.map((seg, i) => {
            const next = crumbs.slice(0, i + 1).join('/');
            const last = i === crumbs.length - 1;
            return (
              <View key={next} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={S.crumbSep}>/</Text>
                <TouchableOpacity onPress={async () => { setTreePath(next); setBlob(null); await loadTree(repo, next, gitRef); }}>
                  <Text style={last ? S.crumbCurrent : S.crumb}>{seg}</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
        {branches.length ? (
          Platform.OS === 'web' ? (
            <select
              value={gitRef}
              onChange={async (e) => {
                const next = e.target.value;
                setGitRef(next);
                setBlob(null);
                await loadTree(repo, treePath, next);
              }}
              style={S.branchSelect}
            >
              {branches.map((b) => {
                const n = branchName(b);
                return <option key={n} value={n}>{n}</option>;
              })}
            </select>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              {branches.map((b) => {
                const n = branchName(b);
                return (
                  <Button
                    key={n}
                    title={n}
                    variant={n === gitRef ? 'primary' : 'secondary'}
                    onPress={async () => { setGitRef(n); setBlob(null); await loadTree(repo, treePath, n); }}
                  />
                );
              })}
            </View>
          )
        ) : null}
        {!blob ? (
          <View style={S.table}>
            <View style={S.tableHead}>
              <Text style={S.tableHeadText}>Name</Text>
            </View>
            {rows.map((e) => (
              <TouchableOpacity key={e.name} style={S.tableRow} onPress={() => openBlob(e)}>
                <Text style={S.tableIcon}>{e.type === 'tree' ? '▸' : ' '}</Text>
                <Text style={S.tableName}>{e.type === 'tree' ? `${e.name}/` : e.name}</Text>
              </TouchableOpacity>
            ))}
            {!rows.length ? (
              <View style={S.tableRow}>
                <Text style={S.muted}>Empty repository. Push a branch, then open a PR here.</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <>
            {blob.binary
              ? <Text>(binary file · {blob.size || 0} bytes)</Text>
              : <GitCodeView path={blob.path} content={blob.content} />}
            <Button title="Back to files" variant="secondary" onPress={async () => { setBlob(null); await loadTree(repo, treePath, gitRef); }} />
          </>
        )}
      </>
    );
  };

  if (view === 'pr' && pr?.pull) {
    return (
      <Page title={pr.pull.title || 'Pull request'} subtitle={`${pr.pull.source_branch} → ${pr.pull.target_branch}`}>
        <ScrollView>
          {error ? <Text style={S.error}>{error}</Text> : null}
          <Button title="Back" variant="secondary" onPress={() => setView('repo')} />
          <Box title="Files changed">
            {parseUnifiedDiff(pr.diff).length ? parseUnifiedDiff(pr.diff).map((f) => (
              <View key={f.path} style={{ marginBottom: 16 }}>
                <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{f.path}  +{f.added} −{f.removed}</Text>
                <GitCodeView path={f.path} content={f.lines.join('\n')} language="diff" height={280} />
              </View>
            )) : (
              <Text selectable style={{ fontFamily: 'monospace', fontSize: 12 }}>{pr.diff || '(empty or already merged)'}</Text>
            )}
          </Box>
          {(pr.checks || []).length ? (
            <Box title="Checks">
              {pr.checks.map((c) => (
                <Text key={c.id}>{c.name}: {c.status}{c.note ? ` · ${c.note}` : ''}</Text>
              ))}
            </Box>
          ) : null}
          {(pr.reviews || []).length ? (
            <Box title="Reviews">
              {pr.reviews.map((c) => (
                <Text key={c.id}>{c.author || 'user'}: {c.state}</Text>
              ))}
            </Box>
          ) : null}
          {(pr.comments || []).length ? (
            <Box title="Comments">
              {pr.comments.map((c) => (
                <Text key={c.id}>{c.author || 'user'}: {c.body}</Text>
              ))}
            </Box>
          ) : null}
          <Box title="Comment">
            <TextInput value={commentBody} onChangeText={setCommentBody} placeholder="comment" placeholderTextColor={colors.textMuted} style={S.input} />
            <Button title="Add comment" variant="secondary" onPress={async () => {
              try {
                await api.post(`/api/services/git_manager/api/v1/pulls/${pr.pull.id}/comments`, {
                  project_id: pr.pull.project_id, body: commentBody,
                });
                setCommentBody('');
                openPr(pr.pull);
              } catch (e) { setError(e.response?.data?.error?.message || e.message); }
            }} />
            <Button title="Approve" variant="secondary" onPress={async () => {
              try {
                await api.post(`/api/services/git_manager/api/v1/pulls/${pr.pull.id}/reviews`, {
                  project_id: pr.pull.project_id, state: 'approved',
                });
                openPr(pr.pull);
              } catch (e) { setError(e.response?.data?.error?.message || e.message); }
            }} />
            <Button title="Request changes" variant="secondary" onPress={async () => {
              try {
                await api.post(`/api/services/git_manager/api/v1/pulls/${pr.pull.id}/reviews`, {
                  project_id: pr.pull.project_id, state: 'changes_requested',
                });
                openPr(pr.pull);
              } catch (e) { setError(e.response?.data?.error?.message || e.message); }
            }} />
          </Box>
          {pr.pull.status === 'open' ? (
            <Button title="Merge" onPress={mergePr} />
          ) : (
            <Text>Status: {pr.pull.status}</Text>
          )}
        </ScrollView>
      </Page>
    );
  }

  if (view === 'repo' && repo) {
    return (
      <Page title={repo.name} subtitle={cloneUrl || 'Private repository'}>
        <ScrollView>
          {error ? <Text style={S.error}>{error}</Text> : null}
          <View style={S.titleRow}>
            <Button title="All repositories" variant="secondary" onPress={() => { setView('list'); load(); }} />
            <View style={S.privateBadge}><Text style={S.privateBadgeText}>Private</Text></View>
          </View>
          {cloneUrl ? <Text selectable style={S.muted}>{cloneUrl}</Text> : <Text style={S.muted}>Add an origin hostname to get a clone URL.</Text>}
          {pipelineNote ? <Text style={S.muted}>{pipelineNote}</Text> : null}
          <View style={S.tabRow}>
            {TABS.map((t) => (
              <TouchableOpacity key={t.id} style={[S.tab, tab === t.id && S.tabActive]} onPress={() => setTab(t.id)}>
                <Text style={[S.tabText, tab === t.id && S.tabTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {tab === 'files' ? (
            <>
              {fileTable()}
              {!blob && readme?.content ? (
                <GitReadme
                  name={readme.name}
                  content={readme.content}
                  repoId={repo.id}
                  projectId={repo.project_id}
                  gitRef={gitRef}
                  dir={treePath}
                />
              ) : null}
            </>
          ) : null}
          {tab === 'commits' ? (
            <Box title="Commits">
              {commits.map((c) => (
                <Text key={c.sha || c.id}>{String(c.sha || '').slice(0, 7)} {c.message || c.subject}</Text>
              ))}
              {!commits.length ? <Text>No commits yet.</Text> : null}
            </Box>
          ) : null}
          {tab === 'pulls' ? (
            <>
              <Box title="Open a pull request">
                <Text>Push a branch, then open a PR here.</Text>
                <TextInput value={prTitle} onChangeText={setPrTitle} placeholder="Title" placeholderTextColor={colors.textMuted} style={S.input} />
                <TextInput value={prSource} onChangeText={setPrSource} placeholder="source branch" autoCapitalize="none" placeholderTextColor={colors.textMuted} style={S.input} />
                <TextInput value={prTarget} onChangeText={setPrTarget} placeholder="target (main → prod)" autoCapitalize="none" placeholderTextColor={colors.textMuted} style={S.input} />
                <Button title="Create PR" onPress={createPr} />
              </Box>
              <Box title="Pull requests">
                {pulls.map((p) => (
                  <Box key={p.id} title={p.title || p.id}>
                    <Text>{p.source_branch} → {p.target_branch} · {p.status}</Text>
                    <Button title="Open" variant="secondary" onPress={() => openPr(p)} />
                  </Box>
                ))}
                {!pulls.length ? <Text>No pull requests.</Text> : null}
              </Box>
            </>
          ) : null}
          {tab === 'issues' ? (
            <>
              <Box title="New issue">
                <TextInput value={issueTitle} onChangeText={setIssueTitle} placeholder="Title" placeholderTextColor={colors.textMuted} style={S.input} />
                <Button title="Open issue" onPress={async () => {
                  try {
                    await api.post('/api/services/git_manager/api/v1/issues', {
                      project_id: repo.project_id, repo_id: repo.id, title: issueTitle,
                    });
                    setIssueTitle('');
                    const iss = await api.get('/api/services/git_manager/api/v1/issues', {
                      params: { repo_id: repo.id, project_id: repo.project_id },
                    });
                    setIssues(iss.data?.issues || []);
                  } catch (e) { setError(e.response?.data?.error?.message || e.message); }
                }} />
              </Box>
              <Box title="Issues">
                {issues.map((i) => (
                  <Text key={i.id}>{i.status === 'closed' ? '[x]' : '[ ]'} {i.title}</Text>
                ))}
                {!issues.length ? <Text>No issues.</Text> : null}
              </Box>
            </>
          ) : null}
          {tab === 'clone' ? (
            <>
              {originSection}
              {copyBlocks(repo)}
            </>
          ) : null}
        </ScrollView>
        <HostnameSheet
          visible={formOpen}
          title={formRow?.hostname ? `Edit ${formRow.hostname}` : 'Add origin hostname'}
          initial={formRow || { port: 3130 }}
          zones={zones}
          busy={formBusy}
          error={formError}
          onClose={() => { setFormOpen(false); setFormRow(null); }}
          onSave={handleSaveOrigin}
        />
      </Page>
    );
  }

  const subtitle = originBase(gitHosts)
    ? `Private origin ${originBase(gitHosts)}/<repo>.git — login required.`
    : 'Private Git origin. Add a hostname on port 3130, then clone with a credential helper.';

  return (
    <Page title="Git" subtitle={subtitle}>
      <ScrollView>
        {error ? <Text style={S.error}>{error}</Text> : null}
        <NextSteps navigation={navigation} filter={['add_remote', 'open_pr', 'bind']} />
        {originSection}
        {view === 'create' ? (
          <Box title="Create a repository">
            <TextInput value={name} onChangeText={setName} placeholder="repo name" autoCapitalize="none" placeholderTextColor={colors.textMuted} style={S.input} />
            <Text style={S.muted}>Project (quota / ACL) · always private</Text>
            {(projects || []).map((p) => (
              <Button key={p.id} title={p.name || p.id} variant={projectId === p.id ? 'primary' : 'secondary'} onPress={() => setProjectId(p.id)} />
            ))}
            <Button title="Create" onPress={createRepo} />
            <Button title="Cancel" variant="secondary" onPress={() => setView('list')} />
            {name.trim() ? copyBlocks({ name: name.trim() }) : null}
          </Box>
        ) : (
          <>
            <Button title="Create a repository" onPress={() => setView('create')} />
            {!repos.length ? (
              <Box title="Create a repository">
                <Text>Name it, pick a project, then copy the remotes. Every repo is private.</Text>
              </Box>
            ) : repos.map((r) => (
              <Box key={r.id} title={r.name}>
                <View style={S.titleRow}>
                  <Text>{projectName(r.project_id)}</Text>
                  <View style={S.privateBadge}><Text style={S.privateBadgeText}>Private</Text></View>
                </View>
                <Text selectable>{cloneUrlFor(r, gitHosts) || 'Add an origin hostname to clone'}</Text>
                <Button title="Open" variant="secondary" onPress={() => openRepo(r)} />
              </Box>
            ))}
            <Box title="Pull requests">
              {pulls.map((p) => (
                <Box key={p.id} title={p.title || p.id}>
                  <Text>{p.source_branch} → {p.target_branch} · {p.status}</Text>
                  <Button title="Open" variant="secondary" onPress={() => { const r = repos.find((x) => x.id === p.repo_id); if (r) setRepo(r); openPr(p); }} />
                </Box>
              ))}
              {!pulls.length ? <Text>Push a branch, then open a PR here.</Text> : null}
            </Box>
          </>
        )}
        {isSystemProject ? <Text style={S.muted}>aerekos-cloud merge updates every device.</Text> : null}
      </ScrollView>
      <HostnameSheet
        visible={formOpen}
        title={formRow?.hostname ? `Edit ${formRow.hostname}` : 'Add origin hostname'}
        initial={formRow || { port: 3130 }}
        zones={zones}
        busy={formBusy}
        error={formError}
        onClose={() => { setFormOpen(false); setFormRow(null); }}
        onSave={handleSaveOrigin}
      />
    </Page>
  );
};
