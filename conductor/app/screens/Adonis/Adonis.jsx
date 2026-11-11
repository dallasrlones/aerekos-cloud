import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Page } from '../../components/ui';
import { Box } from '../../components/Box/Box';
import { Button } from '../../components/Button/Button';
import { useProject } from '../../contexts/ProjectContext';
import api from '../../utils/api';
import { colors } from '../../styles/theme';
import { GitCodeView } from '../GitManager/GitCodeView';
import { containerService } from '../../services/containerService';
import { AdonisStyles as S } from './Adonis.styles';

const { canSwitchRef, defaultCommitMessage, isDirty } = require('./dirtyGuard');

let Monaco = null;
if (Platform.OS === 'web') {
  try {
    Monaco = require('@monaco-editor/react').default;
  } catch {
    Monaco = null;
  }
}

function branchName(b) {
  return typeof b === 'string' ? b : (b?.name || '');
}

function branchSha(b) {
  return typeof b === 'object' && b ? (b.sha || '') : '';
}

export const Adonis = ({ navigation, route }) => {
  const { currentProject } = useProject();
  const params = route?.params || {};
  const [projectId, setProjectId] = useState(params.projectId || currentProject?.id || '');
  const [repoId, setRepoId] = useState(params.repoId || '');
  const [repoName, setRepoName] = useState(params.repoName || '');
  const [gitRef, setGitRef] = useState(params.ref || 'main');
  const [repos, setRepos] = useState([]);
  const [branches, setBranches] = useState([]);
  const [tree, setTree] = useState([]);
  const [treePath, setTreePath] = useState('');
  const [blob, setBlob] = useState(null);
  const [content, setContent] = useState('');
  const [original, setOriginal] = useState('');
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [workspace, setWorkspace] = useState(null);
  const [termCmd, setTermCmd] = useState('pwd');
  const [termOut, setTermOut] = useState('');
  const [newBranch, setNewBranch] = useState('');
  const [addPath, setAddPath] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const dirty = useMemo(() => isDirty(original, content), [original, content]);
  const tipSha = useMemo(() => {
    const b = (branches || []).find((x) => branchName(x) === gitRef);
    return branchSha(b);
  }, [branches, gitRef]);

  const loadRepos = useCallback(async () => {
    const pid = projectId || currentProject?.id;
    if (!pid) return;
    setProjectId(pid);
    const r = await api.get('/api/services/git_manager/api/v1/repos', { params: { project_id: pid } });
    setRepos(r.data?.repositories || []);
  }, [projectId, currentProject?.id]);

  const loadBranches = async (id, pid) => {
    const br = await api.get(`/api/services/git_manager/api/v1/repos/${id}/branches`, {
      params: { project_id: pid },
    });
    setBranches(br.data?.branches || []);
  };

  const loadTree = async (id, pid, path, ref) => {
    const t = await api.get(`/api/services/git_manager/api/v1/repos/${id}/tree`, {
      params: { project_id: pid, path: path || '', ref: ref || gitRef },
    });
    setTree(t.data?.entries || []);
  };

  const openRepo = async (row, ref) => {
    setRepoId(row.id);
    setRepoName(row.name);
    setProjectId(row.project_id);
    const nextRef = ref || row.default_branch || 'main';
    setGitRef(nextRef);
    setBlob(null);
    setContent('');
    setOriginal('');
    setTreePath('');
    await loadBranches(row.id, row.project_id);
    await loadTree(row.id, row.project_id, '', nextRef);
  };

  useEffect(() => {
    (async () => {
      try {
        await loadRepos();
        if (params.repoId && (params.projectId || currentProject?.id)) {
          const pid = params.projectId || currentProject?.id;
          const got = await api.get(`/api/services/git_manager/api/v1/repos/${params.repoId}`, {
            params: { project_id: pid },
          });
          const row = got.data?.repository;
          if (row) await openRepo(row, params.ref);
        }
      } catch (e) {
        setError(e.response?.data?.error?.message || e.message);
      }
    })();
  }, []);

  const guardSwitch = () => canSwitchRef({
    dirty,
    confirm: () => (typeof window !== 'undefined' && window.confirm
      ? window.confirm('Discard unsaved changes?')
      : false),
  });

  const switchRef = async (next) => {
    if (!guardSwitch()) return;
    setGitRef(next);
    setBlob(null);
    setContent('');
    setOriginal('');
    await loadTree(repoId, projectId, treePath, next);
  };

  const openEntry = async (entry) => {
    if (entry.type === 'tree') {
      if (!guardSwitch()) return;
      const next = treePath ? `${treePath}/${entry.name}` : entry.name;
      setTreePath(next);
      setBlob(null);
      setContent('');
      setOriginal('');
      await loadTree(repoId, projectId, next, gitRef);
      return;
    }
    if (!guardSwitch()) return;
    const path = treePath ? `${treePath}/${entry.name}` : entry.name;
    const b = await api.get(`/api/services/git_manager/api/v1/repos/${repoId}/blob`, {
      params: { project_id: projectId, path, ref: gitRef },
    });
    const text = b.data?.binary ? '' : (b.data?.content || '');
    setBlob({ path, binary: b.data?.binary, size: b.data?.size });
    setContent(text);
    setOriginal(text);
  };

  const save = async (path, text, message) => {
    try {
      setBusy(true);
      setError(null);
      await api.post(`/api/services/git_manager/api/v1/repos/${repoId}/commit-file`, {
        project_id: projectId,
        branch: gitRef,
        path,
        content: text,
        message: message || defaultCommitMessage(path),
        base_sha: tipSha || undefined,
      });
      setOriginal(text);
      setStatus(`Saved ${path} → ${gitRef}`);
      await loadBranches(repoId, projectId);
      await loadTree(repoId, projectId, treePath, gitRef);
    } catch (e) {
      if (e.response?.status === 409) setError('Branch moved — reload and try again.');
      else setError(e.response?.data?.error?.message || e.message);
    } finally {
      setBusy(false);
    }
  };

  const createBranch = async () => {
    if (!newBranch.trim()) return;
    if (!guardSwitch()) return;
    try {
      setBusy(true);
      await api.post(`/api/services/git_manager/api/v1/repos/${repoId}/branches`, {
        project_id: projectId,
        name: newBranch.trim(),
        from: gitRef,
      });
      const name = newBranch.trim();
      setNewBranch('');
      await loadBranches(repoId, projectId);
      await switchRef(name);
    } catch (e) {
      setError(e.response?.data?.error?.message || e.message);
    } finally {
      setBusy(false);
    }
  };

  const ensureWorkspace = async () => {
    try {
      setBusy(true);
      setError(null);
      const res = await api.post('/api/adonis/workspaces', {
        project_id: projectId,
        repo_id: repoId,
        ref: gitRef,
      });
      setWorkspace(res.data?.workspace);
      setStatus(`Workspace ${res.data?.workspace?.status || 'ready'}`);
    } catch (e) {
      setError(e.response?.data?.error?.message || e.message);
    } finally {
      setBusy(false);
    }
  };

  const stopWorkspace = async () => {
    try {
      setBusy(true);
      await api.delete('/api/adonis/workspaces', {
        data: {
          project_id: projectId,
          repo_id: repoId,
          task_id: workspace?.task_id,
        },
      });
      setWorkspace(null);
      setStatus('Workspace stopped');
      setTermOut('');
    } catch (e) {
      setError(e.response?.data?.error?.message || e.message);
    } finally {
      setBusy(false);
    }
  };

  const runTerm = async () => {
    if (!workspace?.worker_id || !workspace?.container_id) {
      setError('Start a workspace first (needs worker + container).');
      return;
    }
    try {
      setBusy(true);
      const r = await containerService.exec(workspace.worker_id, workspace.container_id, termCmd);
      const out = [r.stdout, r.stderr].filter(Boolean).join('\n') || JSON.stringify(r);
      setTermOut(out);
    } catch (e) {
      setError(e.response?.data?.error?.message || e.message);
    } finally {
      setBusy(false);
    }
  };

  const deploy = async () => {
    try {
      setBusy(true);
      setError(null);
      const res = await api.post('/api/adonis/deploy', {
        project_id: projectId,
        repo_id: repoId,
        repo_name: repoName,
        ref: gitRef,
      });
      setStatus(`Deploy triggered (${res.data?.status || 'ok'})`);
    } catch (e) {
      setError(e.response?.data?.error?.message || e.message);
    } finally {
      setBusy(false);
    }
  };

  const folders = tree.filter((e) => e.type === 'tree').sort((a, b) => a.name.localeCompare(b.name));
  const files = tree.filter((e) => e.type !== 'tree').sort((a, b) => a.name.localeCompare(b.name));

  if (!repoId) {
    return (
      <Page title="Adonis" subtitle="Cloud IDE — pick a repository">
        <ScrollView>
          {error ? <Text style={S.error}>{error}</Text> : null}
          <Button title="Back to Git" variant="secondary" onPress={() => navigation?.navigate?.('gitManager')} />
          <Box title="Repositories">
            {!repos.length ? <Text style={S.muted}>No repositories in this project.</Text> : null}
            {repos.map((r) => (
              <View key={r.id} style={{ marginBottom: 8 }}>
                <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{r.name}</Text>
                <Button title="Open" variant="secondary" onPress={() => openRepo(r)} />
              </View>
            ))}
          </Box>
        </ScrollView>
      </Page>
    );
  }

  return (
    <Page title={`Adonis · ${repoName || repoId}`} subtitle={`${gitRef}${dirty ? ' · unsaved' : ''}`}>
      <ScrollView>
        {error ? <Text style={S.error}>{error}</Text> : null}
        {status ? <Text style={S.muted}>{status}</Text> : null}
        <View style={S.toolbar}>
          <Button title="Git" variant="secondary" onPress={() => navigation?.navigate?.('gitManager', { repoId })} />
          {Platform.OS === 'web' && branches.length ? (
            <select value={gitRef} onChange={(e) => switchRef(e.target.value)} style={S.branchSelect}>
              {branches.map((b) => {
                const n = branchName(b);
                return <option key={n} value={n}>{n}</option>;
              })}
            </select>
          ) : null}
          <TextInput
            value={newBranch}
            onChangeText={setNewBranch}
            placeholder="new-branch"
            autoCapitalize="none"
            placeholderTextColor={colors.textMuted}
            style={[S.input, { minWidth: 120, marginVertical: 0 }]}
          />
          <Button title="New branch" variant="secondary" onPress={createBranch} />
          <Button title="Add file" variant="secondary" onPress={() => setShowAdd((v) => !v)} />
          <Button title={busy ? '…' : 'Save'} onPress={() => blob?.path && save(blob.path, content)} />
          <Button title="Start workspace" variant="secondary" onPress={ensureWorkspace} />
          {workspace ? <Button title="Stop workspace" variant="secondary" onPress={stopWorkspace} /> : null}
          <Button title="Deploy" onPress={deploy} />
        </View>
        {showAdd ? (
          <Box title="Add file">
            <TextInput
              value={addPath}
              onChangeText={setAddPath}
              placeholder="path/to/file"
              autoCapitalize="none"
              placeholderTextColor={colors.textMuted}
              style={S.input}
            />
            <Button
              title="Create & commit"
              onPress={async () => {
                await save(addPath.trim(), '', `Add ${addPath.trim()}`);
                setShowAdd(false);
                setAddPath('');
              }}
            />
          </Box>
        ) : null}
        <View style={S.layout}>
          <View style={S.treePane}>
            <TouchableOpacity onPress={async () => {
              if (!guardSwitch()) return;
              setTreePath('');
              setBlob(null);
              await loadTree(repoId, projectId, '', gitRef);
            }}
            >
              <Text style={S.muted}>{repoName}/</Text>
            </TouchableOpacity>
            {[...folders, ...files].map((e) => (
              <TouchableOpacity key={e.name} style={S.treeRow} onPress={() => openEntry(e)}>
                <Text style={S.treeName}>{e.type === 'tree' ? `${e.name}/` : e.name}</Text>
              </TouchableOpacity>
            ))}
            {!tree.length ? <Text style={S.muted}>Empty tree</Text> : null}
          </View>
          <View style={S.editorPane}>
            {!blob ? (
              <Text style={S.muted}>Select a file to edit.</Text>
            ) : blob.binary ? (
              <Text>(binary · {blob.size || 0} bytes)</Text>
            ) : Monaco ? (
              <Monaco
                height={400}
                language="plaintext"
                value={content}
                onChange={(v) => setContent(v ?? '')}
                theme="vs"
                options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: 'on' }}
              />
            ) : (
              <TextInput
                value={content}
                onChangeText={setContent}
                multiline
                style={[S.input, { minHeight: 360, fontFamily: 'monospace', fontSize: 12 }]}
              />
            )}
            {blob && !blob.binary ? (
              <GitCodeView path={blob.path} content={content} height={120} />
            ) : null}
          </View>
        </View>
        <View style={S.bottomPane}>
          <Text style={{ fontWeight: '600', color: colors.textPrimary, marginBottom: 6 }}>
            Terminal {workspace ? `· ${workspace.status} · ${workspace.container_id || 'pending'}` : '· workspace not started'}
          </Text>
          <View style={S.toolbar}>
            <TextInput
              value={termCmd}
              onChangeText={setTermCmd}
              placeholder="command"
              autoCapitalize="none"
              placeholderTextColor={colors.textMuted}
              style={[S.input, { flex: 1, minWidth: 180, marginVertical: 0 }]}
            />
            <Button title="Run" variant="secondary" onPress={runTerm} />
          </View>
          <Text selectable style={S.termOut}>{termOut || ' '}</Text>
        </View>
      </ScrollView>
    </Page>
  );
};

export default Adonis;
