import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, Alert, Platform } from 'react-native';
import { Box } from '../../components/Box/Box';
import { Button } from '../../components/Button/Button';
import { computeManagerService } from '../../services/computeManagerService';
import { useProject } from '../../contexts/ProjectContext';
import { colors } from '../../styles/theme';
import { RunTaskStyles as S } from './RunTask.styles';
import { stackService } from '../../services/stackService';

const NAME_RE = /^[a-zA-Z0-9_-]+$/;
const PROD_PROJECT = 'ea370977-3aff-4c76-95a6-a0c50fd2bce7';

const parseEnv = (text) => {
  const env = {};
  text.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const idx = trimmed.indexOf('=');
    if (idx > 0) env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  });
  return env;
};

const parsePorts = (text) => {
  const ports = {};
  text.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const [container, host] = trimmed.split(':').map((s) => s.trim());
    if (container && host) ports[container] = host;
  });
  return ports;
};

export const LaunchContainer = ({ navigation }) => {
  const { currentProject, currentEnvironment } = useProject();
  const projectId = currentProject?.id;
  const [source, setSource] = useState('image');
  const [form, setForm] = useState({
    name: '',
    image: '',
    command: '',
    env: '',
    ports: '',
    run_mode: 'service',
    repo_id: '',
    git_ref: 'main',
    dockerfile: 'Dockerfile',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]);
  const [repos, setRepos] = useState([]);
  const [depError, setDepError] = useState('');
  const [uploadFile, setUploadFile] = useState(null);

  const update = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  };

  useEffect(() => {
    if (!projectId) return;
    computeManagerService.listProjectImages(projectId).then(setImages).catch(() => setImages([]));
    computeManagerService.listRepos(projectId).then(setRepos).catch(() => setRepos([]));
  }, [projectId]);

  const requireServices = async (names) => {
    const missing = [];
    for (const name of names) {
      try {
        const st = await computeManagerService.getServiceStatus(name);
        if (!st?.enabled && !st?.deployed) missing.push(name);
      } catch {
        missing.push(name);
      }
    }
    if (!missing.length) return true;
    if (projectId === PROD_PROJECT) {
      setDepError(`Need ${missing.join(', ')} enabled. Not auto-enabling on this project.`);
      return false;
    }
    setDepError(`Need ${missing.join(', ')}. Enable them from Services, then retry.`);
    return false;
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    else if (!NAME_RE.test(form.name.trim())) e.name = 'Use letters, numbers, dashes and underscores only';
    else if (form.name.trim().length > 64) e.name = 'Name must be 64 characters or fewer';
    if (source === 'image' && !form.image.trim()) e.image = 'Image is required';
    if (source === 'git' && !form.repo_id) e.repo_id = 'Pick a repository';
    if (source === 'upload' && Platform.OS === 'web' && !uploadFile) e.upload = 'Choose a source zip';
    if (!form.ports.trim() || !Object.keys(parsePorts(form.ports)).length) e.ports = 'A host-published port is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const commonTaskFields = () => {
    const data = { name: form.name.trim(), run_mode: form.run_mode, environment: currentEnvironment || 'prod' };
    const command = form.command.trim() ? form.command.trim().split(/\s+/) : [];
    if (command.length) data.command = command;
    const env = parseEnv(form.env);
    if (Object.keys(env).length) data.env = env;
    const ports = parsePorts(form.ports);
    if (Object.keys(ports).length) data.port_bindings = ports;
    return data;
  };

  const goDetails = (id) => navigation.navigate('containerDetails', { containerId: id, taskId: id });

  const handleSubmit = async () => {
    if (!projectId) {
      Alert.alert('No project', 'Select a project before launching a container.');
      return;
    }
    if (!validate()) return;
    setLoading(true);
    setDepError('');
    try {
      if (source === 'image') {
        const data = { ...commonTaskFields(), image: form.image.trim() };
        const task = await computeManagerService.createTask(projectId, data);
        await stackService.record(projectId, {
          service: 'compute_manager',
          resource: { name: data.name, image: data.image, desired: 1 },
        });
        Alert.alert('Container started', `"${form.name}" is now ${task?.status || 'running'}.`, [
          { text: 'OK', onPress: () => goDetails(task?.id) },
        ]);
        return;
      }
      if (source === 'git') {
        if (!(await requireServices(['git_manager', 'cicd_manager', 'registry_manager']))) return;
        const pipe = await computeManagerService.createPipeline(projectId, {
          name: `deploy-${form.name.trim()}`,
          repo_id: form.repo_id,
          repo_name: (repos.find((r) => r.id === form.repo_id) || {}).name || '',
          git_ref: form.git_ref || 'main',
          dockerfile: form.dockerfile || 'Dockerfile',
          state: 'idle',
        });
        const fields = commonTaskFields();
        const out = await computeManagerService.runPipeline(projectId, pipe.id, {
          action: 'deploy',
          container_name: form.name.trim(),
          run_mode: fields.run_mode,
          env: fields.env,
          port_bindings: fields.port_bindings,
          command: fields.command,
        });
        const task = out?.task;
        if (task?.id) {
          Alert.alert('Deployed', `"${form.name}" built and started.`, [
            { text: 'OK', onPress: () => goDetails(task.id) },
          ]);
        } else {
          Alert.alert('Deploy', out?.ok ? 'Pipeline finished.' : (out?.results?.[0]?.data?.message || 'Deploy finished without a container id.'));
        }
        return;
      }
      if (source === 'upload') {
        if (Platform.OS !== 'web') {
          Alert.alert('Upload', 'Source upload is available in the web console.');
          return;
        }
        if (!(await requireServices(['storage_manager', 'cicd_manager']))) return;
        if (!uploadFile) throw new Error('Choose a zip');
        const { chunkedUploadService } = require('../../services/chunkedUploadService');
        const { storageManagerService } = require('../../services/storageManagerService');
        try {
          await storageManagerService.createBucket(projectId, { name: 'compute-sources' });
        } catch (_) { /* exists */ }
        const key = `${form.name.trim()}-${Date.now()}.zip`;
        await chunkedUploadService.uploadFile(projectId, 'compute-sources', key, uploadFile, {});
        const pipe = await computeManagerService.createPipeline(projectId, {
          name: `upload-${form.name.trim()}`,
          source_object: `compute-sources/${key}`,
          dockerfile: form.dockerfile || 'Dockerfile',
          state: 'idle',
        });
        const fields = commonTaskFields();
        const out = await computeManagerService.runPipeline(projectId, pipe.id, {
          action: 'deploy',
          container_name: form.name.trim(),
          run_mode: fields.run_mode,
          env: fields.env,
          port_bindings: fields.port_bindings,
          command: fields.command,
        });
        const task = out?.task;
        if (task?.id) goDetails(task.id);
        else Alert.alert('Deploy', out?.ok ? 'Build finished.' : 'Upload deploy did not create a container.');
      }
    } catch (error) {
      const msg = error.response?.data?.error?.message || error.message || 'Failed to launch';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const pickUpload = () => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      Alert.alert('Upload', 'Source upload is available in the web console.');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip,application/zip';
    input.onchange = () => {
      const f = input.files && input.files[0];
      setUploadFile(f || null);
    };
    input.click();
  };

  return (
    <ScrollView style={S.container} contentContainerStyle={S.content}>
      <Text style={S.title}>Launch a container</Text>
      <Text style={S.subtitle}>From an image, a source repository, or an uploaded zip. Environment: {currentEnvironment || 'prod'}.</Text>

      {depError ? <Text style={S.errorText}>{depError}</Text> : null}

      <Box title="Source">
        <View style={S.modeRow}>
          <Button title="Image" onPress={() => setSource('image')} variant={source === 'image' ? 'primary' : 'secondary'} style={S.modeButton} />
          <Button title="Repository" onPress={() => setSource('git')} variant={source === 'git' ? 'primary' : 'secondary'} style={S.modeButton} />
          <Button title="Upload source" onPress={() => setSource('upload')} variant={source === 'upload' ? 'primary' : 'secondary'} style={S.modeButton} />
        </View>
      </Box>

      <Box title="Container">
        <View style={S.field}>
          <Text style={S.label}>Name *</Text>
          <TextInput style={[S.input, errors.name && S.inputError]} value={form.name} onChangeText={(v) => update('name', v)} placeholder="my-api" placeholderTextColor={colors.textMuted} autoCapitalize="none" autoCorrect={false} />
          {errors.name && <Text style={S.errorText}>{errors.name}</Text>}
        </View>

        {source === 'image' ? (
          <View style={S.field}>
            <Text style={S.label}>Image *</Text>
            <TextInput style={[S.input, errors.image && S.inputError]} value={form.image} onChangeText={(v) => update('image', v)} placeholder="nginx:latest" placeholderTextColor={colors.textMuted} autoCapitalize="none" autoCorrect={false} />
            {errors.image && <Text style={S.errorText}>{errors.image}</Text>}
            <Text style={S.help}>Type a ref, or pick a project image (not host inventory).</Text>
            {images.map((img) => (
              <Button key={img.ref} title={img.ref} onPress={() => update('image', img.ref)} variant="secondary" style={{ marginTop: 6 }} />
            ))}
          </View>
        ) : null}

        {source === 'git' ? (
          <View style={S.field}>
            <Text style={S.label}>Repository *</Text>
            {repos.length === 0 ? <Text style={S.help}>No git_manager repos in this project.</Text> : null}
            {repos.map((r) => (
              <Button key={r.id} title={r.name || r.id} onPress={() => update('repo_id', r.id)} variant={form.repo_id === r.id ? 'primary' : 'secondary'} style={{ marginTop: 6 }} />
            ))}
            {errors.repo_id && <Text style={S.errorText}>{errors.repo_id}</Text>}
            <Text style={[S.label, { marginTop: 12 }]}>Branch</Text>
            <TextInput style={S.input} value={form.git_ref} onChangeText={(v) => update('git_ref', v)} placeholder="main" placeholderTextColor={colors.textMuted} autoCapitalize="none" />
            <Text style={[S.label, { marginTop: 12 }]}>Dockerfile</Text>
            <TextInput style={S.input} value={form.dockerfile} onChangeText={(v) => update('dockerfile', v)} placeholder="Dockerfile" placeholderTextColor={colors.textMuted} autoCapitalize="none" />
          </View>
        ) : null}

        {source === 'upload' ? (
          <View style={S.field}>
            <Text style={S.help}>Zip of the app plus a Dockerfile. Web console only. Lands in object storage, then CI/CD builds.</Text>
            <Button title={uploadFile ? uploadFile.name : 'Choose zip'} onPress={pickUpload} variant="secondary" />
            {errors.upload && <Text style={S.errorText}>{errors.upload}</Text>}
            <Text style={[S.label, { marginTop: 12 }]}>Dockerfile</Text>
            <TextInput style={S.input} value={form.dockerfile} onChangeText={(v) => update('dockerfile', v)} placeholder="Dockerfile" placeholderTextColor={colors.textMuted} autoCapitalize="none" />
          </View>
        ) : null}

        <View style={S.field}>
          <Text style={S.label}>Run mode</Text>
          <View style={S.modeRow}>
            <Button title="Service" onPress={() => update('run_mode', 'service')} variant={form.run_mode === 'service' ? 'primary' : 'secondary'} style={S.modeButton} />
            <Button title="One-shot" onPress={() => update('run_mode', 'oneshot')} variant={form.run_mode === 'oneshot' ? 'primary' : 'secondary'} style={S.modeButton} />
          </View>
        </View>
      </Box>

      <Box title="Configuration">
        <View style={S.field}>
          <Text style={S.label}>Command</Text>
          <TextInput style={S.input} value={form.command} onChangeText={(v) => update('command', v)} placeholder="node server.js" placeholderTextColor={colors.textMuted} autoCapitalize="none" />
        </View>
        <View style={S.field}>
          <Text style={S.label}>Environment variables</Text>
          <TextInput style={[S.input, S.multiline]} value={form.env} onChangeText={(v) => update('env', v)} placeholder={'KEY=value'} placeholderTextColor={colors.textMuted} autoCapitalize="none" multiline />
        </View>
        <View style={S.field}>
          <Text style={S.label}>Port mappings *</Text>
          <TextInput style={[S.input, S.multiline, errors.ports && S.inputError]} value={form.ports} onChangeText={(v) => update('ports', v)} placeholder={'8080:18080'} placeholderTextColor={colors.textMuted} autoCapitalize="none" multiline />
          {errors.ports ? <Text style={S.errorText}>{errors.ports}</Text> : null}
        </View>
      </Box>

      <View style={S.buttons}>
        <Button title="Launch container" onPress={handleSubmit} loading={loading} disabled={loading} />
        <Button title="Cancel" onPress={() => navigation.goBack()} variant="secondary" style={S.cancel} />
      </View>
    </ScrollView>
  );
};

export const RunTask = LaunchContainer;
