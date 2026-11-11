import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useProject } from '../../contexts/ProjectContext';
import api from '../../utils/api';
import { containerService } from '../../services/containerService';
import { languageFromPath } from '../GitManager/languageFromPath';
import { AdonisStyles as S, c9 } from './Adonis.styles';

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

function ToolBtn({ label, onPress, primary, danger, disabled }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        S.toolBtn,
        primary ? S.toolBtnPrimary : null,
        danger ? S.toolBtnDanger : null,
        disabled ? { opacity: 0.45 } : null,
      ]}
    >
      <Text style={S.toolBtnText}>{label}</Text>
    </TouchableOpacity>
  );
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
  const lang = useMemo(() => languageFromPath(blob?.path), [blob?.path]);
  const fileBase = blob?.path ? blob.path.split('/').pop() : '';
  const projectName = currentProject?.name || params.projectName || 'project';

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

  const save = useCallback(async (path, text, message) => {
    if (!path || !repoId || !projectId) return;
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
  }, [repoId, projectId, gitRef, tipSha, treePath]);

  const saveCurrent = useCallback(() => {
    if (busy || !blob?.path || blob.binary) return;
    if (!isDirty(original, content)) {
      setStatus(`No changes · ${blob.path}`);
      return;
    }
    return save(blob.path, content);
  }, [busy, blob, original, content, save]);

  const saveCurrentRef = useRef(saveCurrent);
  useEffect(() => {
    saveCurrentRef.current = saveCurrent;
  }, [saveCurrent]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const onKeyDown = (e) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key !== 's' && e.key !== 'S') return;
      e.preventDefault();
      e.stopPropagation();
      saveCurrentRef.current?.();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

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

  const goRoot = async () => {
    if (!guardSwitch()) return;
    setTreePath('');
    setBlob(null);
    setContent('');
    setOriginal('');
    await loadTree(repoId, projectId, '', gitRef);
  };

  const folders = tree.filter((e) => e.type === 'tree').sort((a, b) => a.name.localeCompare(b.name));
  const files = tree.filter((e) => e.type !== 'tree').sort((a, b) => a.name.localeCompare(b.name));

  if (!repoId) {
    return (
      <View style={S.pickerShell}>
        <View style={S.pickerCard}>
          <Text style={S.pickerTitle}>{projectName}</Text>
          <Text style={S.pickerSub}>Cloud IDE — pick a repository</Text>
          {error ? <Text style={S.errorText}>{error}</Text> : null}
          <ToolBtn label="← Git" onPress={() => navigation?.navigate?.('gitManager')} />
          <View style={{ height: 12 }} />
          {!repos.length ? <Text style={S.pickerSub}>No repositories in this project.</Text> : null}
          {repos.map((r) => (
            <View key={r.id} style={S.repoRow}>
              <Text style={S.repoName}>{r.name}</Text>
              <ToolBtn label="Open" primary onPress={() => openRepo(r)} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={S.shell}>
      <View style={S.menubar}>
        <Text style={S.brand}>{projectName}</Text>
        <TouchableOpacity onPress={() => navigation?.navigate?.('gitManager', { repoId })}>
          <Text style={S.menuItem}>Git</Text>
        </TouchableOpacity>
        <Text style={[S.menuItem, S.menuItemActive]}>File</Text>
        <Text style={S.menuItem}>Edit</Text>
        <Text style={S.menuItem}>View</Text>
        <Text style={S.menuItem}>Run</Text>
        <Text style={S.menuItem}>Deploy</Text>
        <View style={{ flex: 1 }} />
        <Text style={S.menuItem}>{repoName}</Text>
      </View>

      <View style={S.toolbar}>
        {Platform.OS === 'web' && branches.length ? (
          <select value={gitRef} onChange={(e) => switchRef(e.target.value)} style={S.branchSelect}>
            {branches.map((b) => {
              const n = branchName(b);
              return <option key={n} value={n}>{n}</option>;
            })}
          </select>
        ) : (
          <Text style={S.statusText}>{gitRef}</Text>
        )}
        <TextInput
          value={newBranch}
          onChangeText={setNewBranch}
          placeholder="new-branch"
          autoCapitalize="none"
          placeholderTextColor={c9.textMuted}
          style={S.tinyInput}
        />
        <ToolBtn label="New branch" onPress={createBranch} disabled={busy} />
        <ToolBtn label="Add file" onPress={() => setShowAdd((v) => !v)} />
        <ToolBtn label={busy ? '…' : 'Save'} primary onPress={saveCurrent} disabled={busy || !blob?.path || !dirty} />
        <ToolBtn label={workspace ? 'Stop WS' : 'Start WS'} onPress={workspace ? stopWorkspace : ensureWorkspace} disabled={busy} />
        <ToolBtn label="Deploy" primary onPress={deploy} disabled={busy} />
      </View>

      {error ? (
        <View style={S.errorBanner}>
          <Text style={S.errorText}>{error}</Text>
        </View>
      ) : null}

      {showAdd ? (
        <View style={S.addBar}>
          <TextInput
            value={addPath}
            onChangeText={setAddPath}
            placeholder="path/to/file"
            autoCapitalize="none"
            placeholderTextColor={c9.textMuted}
            style={[S.tinyInput, { flex: 1 }]}
          />
          <ToolBtn
            label="Create & commit"
            primary
            onPress={async () => {
              await save(addPath.trim(), '', `Add ${addPath.trim()}`);
              setShowAdd(false);
              setAddPath('');
            }}
          />
          <ToolBtn label="Cancel" onPress={() => setShowAdd(false)} />
        </View>
      ) : null}

      <View style={S.body}>
        <View style={S.sidebar}>
          <View style={S.sideHeader}>
            <Text style={S.sideTitle}>Environment</Text>
            <TouchableOpacity onPress={goRoot}>
              <Text style={S.menuItem}>↻</Text>
            </TouchableOpacity>
          </View>
          <Text style={S.openFilesLabel}>Workspace</Text>
          <ScrollView style={S.treeScroll}>
            <TouchableOpacity style={S.treeRow} onPress={goRoot}>
              <Text style={S.treeIcon}>▾</Text>
              <Text style={[S.treeName, S.treeNameDir]}>{repoName || 'repo'}</Text>
            </TouchableOpacity>
            {treePath ? (
              <TouchableOpacity
                style={S.treeRow}
                onPress={async () => {
                  if (!guardSwitch()) return;
                  const parts = treePath.split('/');
                  parts.pop();
                  const next = parts.join('/');
                  setTreePath(next);
                  setBlob(null);
                  setContent('');
                  setOriginal('');
                  await loadTree(repoId, projectId, next, gitRef);
                }}
              >
                <Text style={S.treeIcon}>‥</Text>
                <Text style={S.treeName}>{treePath}/</Text>
              </TouchableOpacity>
            ) : null}
            {[...folders, ...files].map((e) => {
              const path = treePath ? `${treePath}/${e.name}` : e.name;
              const active = blob?.path === path;
              return (
                <TouchableOpacity
                  key={e.name}
                  style={[S.treeRow, active ? S.treeRowActive : null]}
                  onPress={() => openEntry(e)}
                >
                  <Text style={S.treeIcon}>{e.type === 'tree' ? '▸' : '·'}</Text>
                  <Text style={[S.treeName, e.type === 'tree' ? S.treeNameDir : null]}>
                    {e.type === 'tree' ? `${e.name}/` : e.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {!tree.length ? <Text style={[S.statusText, { padding: 10 }]}>Empty tree</Text> : null}
          </ScrollView>
        </View>

        <View style={S.mainCol}>
          <View style={S.tabs}>
            {blob ? (
              <View style={[S.tab, S.tabActive]}>
                <Text style={[S.tabText, S.tabTextActive]}>
                  {fileBase}{dirty ? ' ●' : ''}
                </Text>
              </View>
            ) : (
              <View style={S.tab}>
                <Text style={S.tabText}>Welcome</Text>
              </View>
            )}
          </View>

          <View style={S.editorWrap}>
            {!blob ? (
              <View style={S.emptyEditor}>
                <Text style={S.emptyTitle}>{projectName}</Text>
                <Text style={S.emptyHint}>
                  Open a file from the Environment tree to edit. Save commits to {gitRef}.
                </Text>
              </View>
            ) : blob.binary ? (
              <View style={S.emptyEditor}>
                <Text style={S.emptyHint}>(binary · {blob.size || 0} bytes)</Text>
              </View>
            ) : Monaco ? (
              <Monaco
                height="100%"
                language={lang}
                value={content}
                onChange={(v) => setContent(v ?? '')}
                theme="vs-dark"
                onMount={(editor, monaco) => {
                  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                    saveCurrentRef.current?.();
                  });
                }}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  wordWrap: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  padding: { top: 8 },
                  renderLineHighlight: 'line',
                  fontFamily: 'Menlo, Monaco, Consolas, monospace',
                }}
              />
            ) : (
              <TextInput
                value={content}
                onChangeText={setContent}
                multiline
                placeholderTextColor={c9.textMuted}
                style={{
                  flex: 1,
                  minHeight: 320,
                  padding: 12,
                  color: c9.text,
                  backgroundColor: '#1e1e1e',
                  fontFamily: c9.mono,
                  fontSize: 13,
                  textAlignVertical: 'top',
                }}
              />
            )}
          </View>

          <View style={S.console}>
            <View style={S.consoleTabs}>
              <View style={[S.consoleTab, S.consoleTabActive]}>
                <Text style={S.consoleTabText}>
                  Console{workspace ? ` · ${workspace.status}` : ''}
                </Text>
              </View>
            </View>
            <View style={S.consoleBody}>
              <View style={S.termPromptRow}>
                <Text style={S.prompt}>$</Text>
                <TextInput
                  value={termCmd}
                  onChangeText={setTermCmd}
                  placeholder="command"
                  autoCapitalize="none"
                  placeholderTextColor={c9.textMuted}
                  style={S.termInput}
                  onSubmitEditing={runTerm}
                />
                <ToolBtn label="Run" onPress={runTerm} disabled={busy} />
              </View>
              <ScrollView style={{ flex: 1 }}>
                <Text selectable style={S.termOut}>
                  {termOut || (workspace
                    ? `workspace ${workspace.container_id || 'pending'} · ${workspace.status}`
                    : 'Start a workspace to run commands.')}
                </Text>
              </ScrollView>
            </View>
          </View>
        </View>
      </View>

      <View style={S.statusbar}>
        <Text style={S.statusText}>
          {dirty ? '● unsaved' : 'ready'}
          {status ? ` · ${status}` : ''}
        </Text>
        <Text style={[S.statusText, S.statusAccent]}>
          {gitRef}{blob?.path ? ` · ${blob.path}` : ''}{lang && blob ? ` · ${lang}` : ''}
        </Text>
      </View>
    </View>
  );
};

export default Adonis;
