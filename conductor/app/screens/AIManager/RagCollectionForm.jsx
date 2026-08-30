import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Box } from '../../components/Box/Box';
import { Button } from '../../components/Button/Button';
import { aiManagerService } from '../../services/aiManagerService';
import { useProject } from '../../contexts/ProjectContext';
import { colors } from '../../styles/theme';
import { AiProviderFormStyles as S } from './AiProviderForm.styles';

export const RagCollectionForm = ({ navigation, route }) => {
  const ragId = route?.params?.ragId;
  const isEdit = !!ragId;
  const { currentProject } = useProject();
  const projectId = currentProject?.id;

  const [form, setForm] = useState({ name: '', description: '', embeddings_integration: '' });
  const [embeds, setEmbeds] = useState([]);
  const [docs, setDocs] = useState([]);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [ingesting, setIngesting] = useState(false);
  const [searching, setSearching] = useState(false);

  const loadEmbeds = useCallback(async () => {
    if (!projectId) return;
    try { setEmbeds(await aiManagerService.listIntegrations(projectId, 'embeddings')); } catch (_) { setEmbeds([]); }
  }, [projectId]);

  const load = useCallback(async () => {
    if (!isEdit || !projectId) { setFetching(false); return; }
    try {
      const p = await aiManagerService.getRag(projectId, ragId);
      setForm({
        name: p.name || '',
        description: p.description || '',
        embeddings_integration: p.embeddings_integration || '',
      });
      setDocs(await aiManagerService.listRagDocuments(projectId, ragId));
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error?.message || err.message);
    } finally {
      setFetching(false);
    }
  }, [isEdit, projectId, ragId]);

  useEffect(() => { loadEmbeds(); }, [loadEmbeds]);
  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    if (!projectId) return;
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    setErrors(e);
    if (Object.keys(e).length) return;
    setLoading(true);
    try {
      const data = { ...form, name: form.name.trim().toLowerCase() };
      if (isEdit) await aiManagerService.updateRag(projectId, ragId, data);
      else {
        const created = await aiManagerService.createRag(projectId, data);
        navigation.navigate('aiRagForm', { ragId: created.id });
        return;
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleIngest = async () => {
    if (!text.trim()) return;
    setIngesting(true);
    try {
      await aiManagerService.ingestRagDocument(projectId, ragId, { title: title.trim() || 'document', text });
      setTitle('');
      setText('');
      setDocs(await aiManagerService.listRagDocuments(projectId, ragId));
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error?.message || err.message);
    } finally {
      setIngesting(false);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await aiManagerService.searchRag(projectId, ragId, query.trim());
      setHits(res.items || []);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error?.message || err.message);
    } finally {
      setSearching(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete RAG collection', `Delete "${form.name}" and detach it from all intelligence endpoints?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await aiManagerService.deleteRag(projectId, ragId);
            navigation.goBack();
          } catch (err) {
            Alert.alert('Error', err.response?.data?.error?.message || err.message);
          }
        },
      },
    ]);
  };

  if (fetching) {
    return (
      <View style={[S.container, S.center]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={S.container} contentContainerStyle={S.content}>
      <Text style={S.title}>{isEdit ? 'Edit RAG collection' : 'Create RAG collection'}</Text>
      <Text style={S.subtitle}>
        A knowledge collection you can attach to any number of intelligence endpoints.
      </Text>

      <Box title="Collection">
        <View style={S.field}>
          <Text style={S.label}>Name *</Text>
          <TextInput
            style={[S.input, errors.name && S.inputError]}
            value={form.name}
            onChangeText={(v) => setForm((p) => ({ ...p, name: v }))}
            placeholder="handbook"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
          />
          {errors.name ? <Text style={S.errorText}>{errors.name}</Text> : null}
        </View>
        <View style={S.field}>
          <Text style={S.label}>Description</Text>
          <TextInput
            style={S.input}
            value={form.description}
            onChangeText={(v) => setForm((p) => ({ ...p, description: v }))}
            placeholder="Product handbook"
            placeholderTextColor={colors.textMuted}
          />
        </View>
        <View style={S.field}>
          <Text style={S.label}>Embeddings endpoint</Text>
          <View style={S.chips}>
            <Button
              title="Hash fallback"
              variant={!form.embeddings_integration ? 'primary' : 'secondary'}
              onPress={() => setForm((p) => ({ ...p, embeddings_integration: '' }))}
              style={S.chip}
            />
            {embeds.map((e) => (
              <Button
                key={e.id}
                title={e.name}
                variant={form.embeddings_integration === e.name ? 'primary' : 'secondary'}
                onPress={() => setForm((p) => ({ ...p, embeddings_integration: e.name }))}
                style={S.chip}
              />
            ))}
          </View>
        </View>
      </Box>

      {isEdit ? (
        <>
          <Box title="Ingest document">
            <TextInput
              style={[S.input, { marginBottom: 8 }]}
              value={title}
              onChangeText={setTitle}
              placeholder="Title"
              placeholderTextColor={colors.textMuted}
            />
            <TextInput
              style={[S.input, S.multiline]}
              value={text}
              onChangeText={setText}
              placeholder="Paste knowledge text"
              placeholderTextColor={colors.textMuted}
              multiline
            />
            <Button title="Ingest" onPress={handleIngest} loading={ingesting} style={{ marginTop: 8 }} />
          </Box>
          <Box title={`Documents (${docs.length})`}>
            {docs.length === 0 ? <Text style={S.help}>None yet.</Text> : docs.map((d) => (
              <View key={d.id} style={{ marginBottom: 8 }}>
                <Text style={S.label}>{d.title}</Text>
                <Text style={S.help} numberOfLines={3}>{d.text}</Text>
                <Button
                  title="Delete"
                  variant="secondary"
                  onPress={async () => {
                    await aiManagerService.deleteRagDocument(projectId, ragId, d.id);
                    setDocs(await aiManagerService.listRagDocuments(projectId, ragId));
                  }}
                  style={{ marginTop: 4, alignSelf: 'flex-start' }}
                />
              </View>
            ))}
          </Box>
          <Box title="Search">
            <TextInput
              style={S.input}
              value={query}
              onChangeText={setQuery}
              placeholder="Query"
              placeholderTextColor={colors.textMuted}
              onSubmitEditing={handleSearch}
            />
            <Button title="Search" onPress={handleSearch} loading={searching} style={{ marginTop: 8 }} />
            {hits.map((h) => (
              <Text key={h.id || h.doc_id} style={[S.help, { marginTop: 8 }]}>
                {(h.score != null ? `${h.score.toFixed(3)} · ` : '')}{h.title}: {h.text}
              </Text>
            ))}
          </Box>
        </>
      ) : null}

      <View style={S.buttons}>
        <Button title={isEdit ? 'Save changes' : 'Create collection'} onPress={handleSubmit} loading={loading} />
        {isEdit ? <Button title="Delete collection" onPress={handleDelete} variant="danger" style={S.cancel} /> : null}
        <Button title="Cancel" onPress={() => navigation.goBack()} variant="secondary" style={S.cancel} />
      </View>
    </ScrollView>
  );
};
