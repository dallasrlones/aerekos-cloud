import React from 'react';
import { Text, TouchableOpacity, View, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AgentsWorkspace } from './AgentsWorkspace';
import { useProject } from '../../contexts/ProjectContext';
import { colors, spacing } from '../../styles/theme';
import { AIManagerStyles as S } from './AIManager.styles';

export function AiAgentsScreen({ navigation }) {
  const { currentProject, loading } = useProject();
  const projectId = currentProject?.id;

  return (
    <ScrollView
      style={S.container}
      contentContainerStyle={[S.content, { maxWidth: 980 }]}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity style={S.breadcrumb} onPress={() => navigation.navigate('aiManager')} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
        <Text style={S.hintText}>AI Manager</Text>
      </TouchableOpacity>
      <Text style={S.title}>Agents</Text>
      <Text style={S.subtitle}>Voice-first shop. Ask hangs out. Plan and Agent brief the manager, then preview before a folder, repo, service, or deploy.</Text>
      {loading || !projectId ? (
        <Text style={S.hintText}>{loading ? 'Loading project…' : 'Select a project in the header.'}</Text>
      ) : (
        <View style={{ marginTop: spacing.sm }}>
            <AgentsWorkspace projectId={projectId} navigation={navigation} />
        </View>
      )}
    </ScrollView>
  );
}
