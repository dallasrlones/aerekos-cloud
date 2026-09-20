import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Box } from '../../components/Box/Box';
import { Button } from '../../components/Button/Button';
import { aiManagerService } from '../../services/aiManagerService';
import { useProject } from '../../contexts/ProjectContext';
import { colors } from '../../styles/theme';
import { AiProviderFormStyles as S } from './AiProviderForm.styles';

function copy(text) {
  if (Platform.OS === 'web' && navigator?.clipboard) {
    navigator.clipboard.writeText(text);
    return;
  }
  Alert.alert('Copied', text);
}

export const AiBalancerDetails = ({ navigation, route }) => {
  const balancerId = route?.params?.balancerId;
  const { currentProject } = useProject();
  const projectId = currentProject?.id;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!projectId) { setLoading(false); return; }
    try {
      const intel = await aiManagerService.listIntelligence(projectId);
      setItems((intel || []).filter((i) => i.balancer_id && String(i.balancer_id) === String(balancerId)));
    } catch (_) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, balancerId]);

  useEffect(() => { load(); }, [load]);

  return (
    <ScrollView style={S.container} contentContainerStyle={S.content}>
      <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }} onPress={() => navigation.navigate('aiManager')} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={16} color={colors.textMuted} />
        <Text style={S.help}> AI Manager</Text>
      </TouchableOpacity>
      <Text style={S.title}>Load balancer</Text>
      <Text style={S.subtitle}>Attached target group. Chat origin stays the intelligence pretty URL.</Text>

      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <>
          <Box title="Balancer">
            <Text style={S.help}>{balancerId || '—'}</Text>
            {balancerId ? (
              <Button title="Copy id" variant="secondary" onPress={() => copy(balancerId)} style={{ marginTop: 8, alignSelf: 'flex-start' }} />
            ) : null}
          </Box>
          <Box title="Attached intelligence">
            {items.length === 0 ? (
              <Text style={S.help}>No intelligence endpoint currently references this balancer id.</Text>
            ) : items.map((i) => (
              <TouchableOpacity
                key={i.id}
                style={S.row}
                onPress={() => navigation.navigate('aiIntelligenceForm', { intelligenceId: i.id })}
              >
                <View style={S.rowMain}>
                  <Text style={S.rowName}>{i.name}</Text>
                  <Text style={S.rowSub}>{i.arn}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </Box>
        </>
      )}
    </ScrollView>
  );
};
