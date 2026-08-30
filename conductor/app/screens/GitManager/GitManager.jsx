import React, { useCallback, useEffect, useState } from 'react';
import { Text, ScrollView, TextInput, View } from 'react-native';
import { Page } from '../../components/ui';
import { Box } from '../../components/Box/Box';
import { Button } from '../../components/Button/Button';
import { NextSteps } from '../../components/NextSteps/NextSteps';
import { useProject } from '../../contexts/ProjectContext';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import { colors } from '../../styles/theme';

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

export const GitManager = ({ navigation }) => {
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
  const [gitBound, setGitBound] = useState(true);
  const [bindBusy, setBindBusy] = useState(false);

  const projectName = (id) => (projects || []).find((p) => p.id === id)?.name || id;

  const load = useCallback(async () => {
    try {
      const [r, p] = await Promise.all([
        api.get('/api/services/git_manager/api/v1/repos'),
        api.get('/api/services/git_manager/api/v1/pulls'),
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
    try {
      if (currentProject?.id) {
        const hosts = await api.get('/api/services/domain_manager/api/v1/dns/hostnames', {
          params: { project_id: currentProject.id },
        });
        const list = hosts.data?.hostnames || [];
        setGitBound(list.some((h) => h.hostname === 'git.aerekos.com'));
      }
    } catch {
      setGitBound(true);
    }
  }, [currentProject?.id, getToken]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (currentProject?.id && !projectId) setProjectId(currentProject.id);
  }, [currentProject?.id, projectId]);

  const openRepo = async (row) => {
    setRepo(row);
    setView('repo');
    setTab('files');
    setTreePath('');
    setBlob(null);
    try {
      const [t, c, prs] = await Promise.all([
        api.get(`/api/services/git_manager/api/v1/repos/${row.id}/tree`, { params: { project_id: row.project_id } }),
        api.get(`/api/services/git_manager/api/v1/repos/${row.id}/commits`, { params: { project_id: row.project_id } }),
        api.get('/api/services/git_manager/api/v1/pulls', { params: { repo_id: row.id, project_id: row.project_id } }),
      ]);
      setTree(t.data?.entries || []);
      setCommits(c.data?.commits || []);
      setPulls(prs.data?.pulls || []);
    } catch (e) {
      setError(e.response?.data?.error?.message || e.message);
    }
  };

  const openBlob = async (entry) => {
    if (entry.type === 'tree') {
      const next = treePath ? `${treePath}/${entry.name}` : entry.name;
      setTreePath(next);
      const t = await api.get(`/api/services/git_manager/api/v1/repos/${repo.id}/tree`, {
        params: { project_id: repo.project_id, path: next },
      });
      setTree(t.data?.entries || []);
      setBlob(null);
      return;
    }
    const path = treePath ? `${treePath}/${entry.name}` : entry.name;
    const b = await api.get(`/api/services/git_manager/api/v1/repos/${repo.id}/blob`, {
      params: { project_id: repo.project_id, path },
    });
    setBlob({ path, ...b.data });
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
    const confirm = () => doMerge();
    if (typeof window !== 'undefined' && window.confirm) {
      const fleet = repo?.name === 'aerekos-cloud';
      const msg = fleet
        ? 'This updates every device.'
        : target === 'main'
          ? 'This deploys prod.'
          : `This deploys ${target === 'develop' ? 'dev' : target}.`;
      if (!window.confirm(`Merge ${pr.pull.source_branch} → ${target}? ${msg}`)) return;
    }
    confirm();
  };

  const doMerge = async () => {
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

  const bindGit = async () => {
    setBindBusy(true);
    try {
      await api.post('/api/edge/bind', {
        project_id: currentProject?.id,
        hostname: 'git.aerekos.com',
        port: 3130,
      });
      setGitBound(true);
    } catch (e) {
      setError(e.response?.data?.error?.message || e.message);
    } finally {
      setBindBusy(false);
    }
  };

  const cloneUrl = repo?.clone_url || (repo ? `https://git.aerekos.com/${repo.name}.git` : 'https://git.aerekos.com/<repo>.git');
  const tokenUrl = token && repo ? `https://git:${token}@git.aerekos.com/${repo.name}.git` : '';
  const displayName = repo?.name || name.trim() || 'aerekos-cloud';

  const copyBlocks = (r) => {
    const url = r?.clone_url || `https://git.aerekos.com/${displayName}.git`;
    const newCmd = `echo "# ${displayName}" >> README.md\ngit init\ngit add README.md\ngit commit -m "first commit"\ngit branch -M main\ngit remote add aerekos-git ${url}\ngit push -u aerekos-git main`;
    const existCmd = `git remote add aerekos-git ${url}\ngit push -u aerekos-git main`;
    const switchCmd = `git remote add aerekos-git ${url}\n# or replace origin:\ngit remote set-url origin ${url}\ngit remote -v`;
    return (
      <>
        {snippetBlock('Create a new repository on the command line', newCmd)}
        {snippetBlock('…or push an existing repository', existCmd)}
        {snippetBlock('…or switch the remote', switchCmd)}
        {snippetBlock('Auth (password = console JWT or GIT_AUTH_TOKEN)', '# username: anything; password: console JWT or GIT_AUTH_TOKEN\ngit config credential.helper osxkeychain')}
        {tokenUrl ? snippetBlock('HTTPS with token', tokenUrl) : null}
        {r?.lan_clone_url ? snippetBlock('LAN fallback (if public TLS is intercepted)', r.lan_clone_url) : null}
      </>
    );
  };

  if (view === 'pr' && pr?.pull) {
    return (
      <Page title={pr.pull.title || 'Pull request'} subtitle={`${pr.pull.source_branch} → ${pr.pull.target_branch}`}>
        <ScrollView>
          {error ? <Text>{error}</Text> : null}
          <Button title="Back" variant="secondary" onPress={() => setView('repo')} />
          <Box title="Diff">
            <Text selectable style={{ fontFamily: 'monospace', fontSize: 12 }}>{pr.diff || '(empty or already merged)'}</Text>
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
      <Page title={repo.name} subtitle={cloneUrl}>
        <ScrollView>
          {error ? <Text>{error}</Text> : null}
          <Button title="All repositories" variant="secondary" onPress={() => { setView('list'); load(); }} />
          <Text selectable>{cloneUrl}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 }}>
            {['files', 'commits', 'pulls', 'clone'].map((t) => (
              <Button key={t} title={t} variant={tab === t ? 'primary' : 'secondary'} onPress={() => setTab(t)} />
            ))}
          </View>
          {tab === 'files' ? (
            <Box title={treePath || '/'}>
              {treePath ? (
                <Button title=".." variant="secondary" onPress={async () => {
                  const parts = treePath.split('/').filter(Boolean);
                  parts.pop();
                  const next = parts.join('/');
                  setTreePath(next);
                  const t = await api.get(`/api/services/git_manager/api/v1/repos/${repo.id}/tree`, {
                    params: { project_id: repo.project_id, path: next },
                  });
                  setTree(t.data?.entries || []);
                  setBlob(null);
                }} />
              ) : null}
              {tree.map((e) => (
                <Button key={e.name} title={`${e.type === 'tree' ? '📁' : '📄'} ${e.name}`} variant="secondary" onPress={() => openBlob(e)} />
              ))}
              {!tree.length ? <Text>Empty repository. Push a branch, then open a PR here.</Text> : null}
              {blob ? (
                <Text selectable style={{ fontFamily: 'monospace', fontSize: 12, marginTop: 12 }}>
                  {blob.binary ? '(binary file)' : (blob.content || '')}
                </Text>
              ) : null}
            </Box>
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
                <TextInput value={prTitle} onChangeText={setPrTitle} placeholder="Title" placeholderTextColor={colors.textMuted} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 8, marginVertical: 6, color: colors.textPrimary }} />
                <TextInput value={prSource} onChangeText={setPrSource} placeholder="source branch" autoCapitalize="none" placeholderTextColor={colors.textMuted} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 8, marginVertical: 6, color: colors.textPrimary }} />
                <TextInput value={prTarget} onChangeText={setPrTarget} placeholder="target (main → prod)" autoCapitalize="none" placeholderTextColor={colors.textMuted} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 8, marginVertical: 6, color: colors.textPrimary }} />
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
          {tab === 'clone' ? copyBlocks(repo) : null}
        </ScrollView>
      </Page>
    );
  }

  return (
    <Page title="Git" subtitle="GitHub-shaped origin. Clone https://git.aerekos.com/<repo>.git — push a branch, open a PR, merge.">
      <ScrollView>
        {error ? <Text>{error}</Text> : null}
        <NextSteps navigation={navigation} filter={['add_remote', 'open_pr', 'bind']} />
        {!gitBound ? (
          <Box title="Git needs a public URL">
            <Text>Bind git.aerekos.com to this host’s :3130 on the prod tunnel.</Text>
            <Button title={bindBusy ? 'Binding…' : 'Bind git.aerekos.com'} onPress={bindGit} />
          </Box>
        ) : null}
        {view === 'create' ? (
          <Box title="Create a repository">
            <TextInput value={name} onChangeText={setName} placeholder="repo name" autoCapitalize="none" placeholderTextColor={colors.textMuted} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 8, marginVertical: 6, color: colors.textPrimary }} />
            <Text style={{ color: colors.textMuted, marginBottom: 6 }}>Project (quota / ACL)</Text>
            {(projects || []).map((p) => (
              <Button key={p.id} title={p.name || p.id} variant={projectId === p.id ? 'primary' : 'secondary'} onPress={() => setProjectId(p.id)} />
            ))}
            <Button title="Create" onPress={createRepo} />
            <Button title="Cancel" variant="secondary" onPress={() => setView('list')} />
            {name.trim() ? copyBlocks({ name: name.trim(), clone_url: `https://git.aerekos.com/${name.trim()}.git` }) : null}
          </Box>
        ) : (
          <>
            <Button title="Create a repository" onPress={() => setView('create')} />
            {!repos.length ? (
              <Box title="Create a repository">
                <Text>Name it, pick a project, then copy the remotes.</Text>
              </Box>
            ) : repos.map((r) => (
              <Box key={r.id} title={r.name}>
                <Text>{projectName(r.project_id)}</Text>
                <Text selectable>{r.clone_url}</Text>
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
        {isSystemProject ? <Text style={{ color: colors.textMuted, marginTop: 12 }}>aerekos-cloud merge updates every device.</Text> : null}
      </ScrollView>
    </Page>
  );
};
