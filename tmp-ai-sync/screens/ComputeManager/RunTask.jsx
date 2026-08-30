import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, Alert } from 'react-native';
import { Box } from '../../components/Box/Box';
import { Button } from '../../components/Button/Button';
import { computeManagerService } from '../../services/computeManagerService';
import { useProject } from '../../contexts/ProjectContext';
import { colors } from '../../styles/theme';
import { RunTaskStyles as S } from './RunTask.styles';

const NAME_RE = /^[a-zA-Z0-9_-]+$/;

/** Parse "KEY=VALUE" lines into an object. */
const parseEnv = (text) => {
  const env = {};
  text.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const idx = trimmed.indexOf('=');
    if (idx > 0) {
      env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
  });
  return env;
};

/** Parse "containerPort:hostPort" lines into { containerPort: hostPort }. */
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

/**
 * Run a container (create + start a compute_manager task). Mirrors the
 * CreateDatabase form pattern.
 */
export const RunTask = ({ navigation }) => {
  const { currentProject } = useProject();
  const projectId = currentProject?.id;

  const [form, setForm] = useState({
    name: '',
    image: '',
    command: '',
    env: '',
    ports: '',
    run_mode: 'service',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const update = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Task name is required';
    else if (!NAME_RE.test(form.name.trim())) e.name = 'Use letters, numbers, dashes and underscores only';
    else if (form.name.trim().length > 64) e.name = 'Name must be 64 characters or fewer';
    if (!form.image.trim()) e.image = 'Image is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!projectId) {
      Alert.alert('No project', 'Select a project before running a task.');
      return;
    }
    if (!validate()) return;

    setLoading(true);
    try {
      const data = {
        name: form.name.trim(),
        image: form.image.trim(),
        run_mode: form.run_mode,
      };
      const command = form.command.trim() ? form.command.trim().split(/\s+/) : [];
      if (command.length) data.command = command;
      const env = parseEnv(form.env);
      if (Object.keys(env).length) data.env = env;
      const ports = parsePorts(form.ports);
      if (Object.keys(ports).length) data.port_bindings = ports;

      const task = await computeManagerService.createTask(projectId, data);
      Alert.alert('Task started', `"${form.name}" is now ${task?.status || 'running'}.`, [
        { text: 'OK', onPress: () => navigation.navigate('taskDetails', { taskId: task?.id }) },
      ]);
    } catch (error) {
      const msg = error.response?.data?.error?.message || error.message || 'Failed to run task';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={S.container} contentContainerStyle={S.content}>
      <Text style={S.title}>Run a task</Text>
      <Text style={S.subtitle}>Launch a container from an image on your worker.</Text>

      <Box title="Container">
        <View style={S.field}>
          <Text style={S.label}>Task name *</Text>
          <TextInput
            style={[S.input, errors.name && S.inputError]}
            value={form.name}
            onChangeText={(v) => update('name', v)}
            placeholder="my-api"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {errors.name && <Text style={S.errorText}>{errors.name}</Text>}
        </View>

        <View style={S.field}>
          <Text style={S.label}>Image *</Text>
          <TextInput
            style={[S.input, errors.image && S.inputError]}
            value={form.image}
            onChangeText={(v) => update('image', v)}
            placeholder="nginx:latest"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {errors.image && <Text style={S.errorText}>{errors.image}</Text>}
          <Text style={S.help}>Image must already exist on the worker.</Text>
        </View>

        <View style={S.field}>
          <Text style={S.label}>Run mode</Text>
          <View style={S.modeRow}>
            <Button
              title="Service"
              onPress={() => update('run_mode', 'service')}
              variant={form.run_mode === 'service' ? 'primary' : 'secondary'}
              style={S.modeButton}
            />
            <Button
              title="One-shot"
              onPress={() => update('run_mode', 'oneshot')}
              variant={form.run_mode === 'oneshot' ? 'primary' : 'secondary'}
              style={S.modeButton}
            />
          </View>
          <Text style={S.help}>
            {form.run_mode === 'service' ? 'Long-running; stays up until stopped.' : 'Runs once, then exits.'}
          </Text>
        </View>
      </Box>

      <Box title="Configuration (optional)">
        <View style={S.field}>
          <Text style={S.label}>Command</Text>
          <TextInput
            style={S.input}
            value={form.command}
            onChangeText={(v) => update('command', v)}
            placeholder="node server.js"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={S.help}>Overrides the image's default command.</Text>
        </View>

        <View style={S.field}>
          <Text style={S.label}>Environment variables</Text>
          <TextInput
            style={[S.input, S.multiline]}
            value={form.env}
            onChangeText={(v) => update('env', v)}
            placeholder={'KEY=value\nANOTHER=value'}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
          />
          <Text style={S.help}>One KEY=value per line.</Text>
        </View>

        <View style={S.field}>
          <Text style={S.label}>Port mappings</Text>
          <TextInput
            style={[S.input, S.multiline]}
            value={form.ports}
            onChangeText={(v) => update('ports', v)}
            placeholder={'8080:18080\n443:8443'}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
          />
          <Text style={S.help}>One containerPort:hostPort per line.</Text>
        </View>
      </Box>

      <View style={S.buttons}>
        <Button title="Run task" onPress={handleSubmit} loading={loading} disabled={loading} />
        <Button title="Cancel" onPress={() => navigation.goBack()} variant="secondary" style={S.cancel} />
      </View>
    </ScrollView>
  );
};
