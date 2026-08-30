import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../styles/theme';
import { ApiReferenceStyles as S } from './ApiReference.styles';

function methodColor(m) {
  if (m === 'GET') return colors.success;
  if (m === 'POST') return colors.primary;
  if (m === 'DELETE') return colors.error;
  return colors.textMuted;
}

export const ApiReference = ({ examples = [], baseUrl }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(null);
  if (!examples.length) return null;

  const apiBase = baseUrl || (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3300` : 'http://localhost:3300');

  const copy = (text, id) => {
    if (Platform.OS === 'web' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  return (
    <View style={S.wrap}>
      <TouchableOpacity style={S.header} onPress={() => setOpen((v) => !v)} activeOpacity={0.7}>
        <Ionicons name="code-slash-outline" size={18} color={colors.textMuted} />
        <Text style={S.headerTitle}>API reference</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
      </TouchableOpacity>
      {open && examples.map((ex, i) => {
        const curl = [
          `curl -s -X ${ex.method} "${apiBase}${ex.path}"`,
          '  -H "Authorization: Bearer $TOKEN"',
          '  -H "Content-Type: application/json"',
          ex.body ? `  -d '${ex.body}'` : '',
        ].filter(Boolean).join(' \\\n');
        const id = `ex-${i}`;
        return (
          <View key={i} style={S.block}>
            <View style={S.row}>
              <Text style={[S.method, { color: methodColor(ex.method) }]}>{ex.method}</Text>
              <Text style={S.path} numberOfLines={2}>{ex.path}</Text>
            </View>
            {ex.desc ? <Text style={S.desc}>{ex.desc}</Text> : null}
            <View style={S.codeWrap}>
              <Text style={S.code} selectable>{curl}</Text>
              {Platform.OS === 'web' && (
                <TouchableOpacity style={S.copyBtn} onPress={() => copy(curl, id)}>
                  <Ionicons name={copied === id ? 'checkmark' : 'copy-outline'} size={14} color={colors.primary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
};
