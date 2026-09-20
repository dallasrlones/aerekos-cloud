import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SERVICE_CATALOG } from '../../services/serviceCatalog';
import { colors } from '../../styles/theme';
import { GlobalSearchStyles as S } from './GlobalSearch.styles';

const STATIC_ACTIONS = [
  { id: 'dashboard', label: 'Console Home', sub: 'Service catalog & project overview', icon: 'home-outline', screen: 'dashboard' },
  { id: 'devices', label: 'Devices', sub: 'Worker fleet', icon: 'hardware-chip-outline', screen: 'devices' },
  { id: 'projects', label: 'Projects', sub: 'All projects', icon: 'folder-outline', screen: 'projects' },
  { id: 'settings', label: 'Settings', sub: 'Account & tokens', icon: 'settings-outline', screen: 'settings' },
  { id: 'menu', label: 'Navigation menu', sub: 'Full app menu', icon: 'menu-outline', screen: 'menu' },
  { id: 'ai-agents', label: 'Icarus Agents', sub: 'AI Manager → Agents', icon: 'people-outline', screen: 'aiAgents' },
];

function scoreMatch(query, text) {
  if (!query) return 1;
  const q = query.toLowerCase();
  const t = (text || '').toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.includes(q)) return 50;
  const words = q.split(/\s+/).filter(Boolean);
  const hits = words.filter((w) => t.includes(w)).length;
  return hits > 0 ? hits * 20 : 0;
}

function buildIndex() {
  const catalog = SERVICE_CATALOG.map((s) => ({
    id: `svc-${s.name}`,
    label: s.label,
    sub: s.description || s.name,
    icon: s.icon || 'cube-outline',
    screen: s.route || 'managerConsole',
    params: s.route ? {} : { serviceName: s.name },
    keywords: `${s.name} ${s.label} ${s.category} ${s.description || ''}`,
  }));
  const setupActions = SERVICE_CATALOG.map((s) => ({
    id: `setup-${s.name}`,
    label: `Set up ${s.label}`,
    sub: `Setup wizard — ${s.description || s.name}`,
    icon: 'construct-outline',
    screen: s.route || 'managerConsole',
    params: s.route ? {} : { serviceName: s.name },
    keywords: `setup set up configure onboard wizard ${s.name} ${s.label} ${s.category}`,
  }));
  return [...STATIC_ACTIONS, ...catalog, ...setupActions];
}

const INDEX = buildIndex();

export const GlobalSearch = ({ visible, onClose, navigation }) => {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = React.useRef(null);

  const results = useMemo(() => {
    const q = query.trim();
    return INDEX
      .map((item) => ({
        ...item,
        score: Math.max(
          scoreMatch(q, item.label),
          scoreMatch(q, item.sub),
          scoreMatch(q, item.keywords || ''),
        ),
      }))
      .filter((item) => !q || item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
  }, [query]);

  const navigateTo = useCallback((item) => {
    if (!navigation || !item) return;
    if (item.params && Object.keys(item.params).length) {
      navigation.navigate(item.screen, item.params);
    } else {
      navigation.navigate(item.screen);
    }
    onClose();
  }, [navigation, onClose]);

  useEffect(() => {
    if (visible) {
      setQuery('');
      setActiveIdx(0);
      if (Platform.OS === 'web') {
        setTimeout(() => inputRef.current?.focus?.(), 50);
      }
    }
  }, [visible]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, results.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' && results[activeIdx]) {
        e.preventDefault();
        navigateTo(results[activeIdx]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, results, activeIdx, navigateTo, onClose]);

  if (!visible) return null;

  return (
    <TouchableOpacity style={S.overlay} activeOpacity={1} onPress={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={(e) => e?.stopPropagation?.()}>
        <View style={S.panel}>
          <View style={S.inputRow}>
            <Ionicons name="search" size={20} color={colors.textMuted} />
            <TextInput
              ref={inputRef}
              style={S.input}
              placeholder="Search services, screens…"
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={S.kbd}>esc</Text>
          </View>
          <Text style={S.hint}>↑↓ navigate · enter open · {Platform.OS === 'web' && navigator?.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+K</Text>
          <ScrollView style={S.list} keyboardShouldPersistTaps="handled">
            {results.length === 0 ? (
              <View style={S.empty}>
                <Text style={S.emptyText}>No matches for "{query}"</Text>
              </View>
            ) : results.map((item, i) => (
              <TouchableOpacity
                key={item.id}
                style={[S.item, i === activeIdx && S.itemActive]}
                onPress={() => navigateTo(item)}
                activeOpacity={0.7}
              >
                <Ionicons name={item.icon} size={20} color={colors.textMuted} />
                <View style={S.itemMain}>
                  <Text style={S.itemTitle}>{item.label}</Text>
                  <Text style={S.itemSub} numberOfLines={1}>{item.sub}</Text>
                </View>
                <Ionicons name="return-down-back-outline" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

export default GlobalSearch;
