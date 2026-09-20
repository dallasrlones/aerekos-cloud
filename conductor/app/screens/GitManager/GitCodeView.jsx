import React, { useMemo } from 'react';
import { Platform, Text, View } from 'react-native';
import { colors } from '../../styles/theme';
import { languageFromPath } from './languageFromPath';

let Editor = null;
if (Platform.OS === 'web') {
  try {
    Editor = require('@monaco-editor/react').default;
  } catch {
    Editor = null;
  }
}

function defineTheme(monaco) {
  monaco.editor.defineTheme('aerekos', {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': colors.cardBackground,
      'editor.foreground': colors.textPrimary,
      'editorLineNumber.foreground': colors.textMuted,
      'editorLineNumber.activeForeground': colors.textSecondary,
      'editor.lineHighlightBackground': colors.surface,
      'editorCursor.foreground': colors.primary,
      'editor.selectionBackground': '#D4AF3733',
      'editorGutter.background': colors.cardBackground,
    },
  });
}

export function GitCodeView({ path, content, height = 420, language }) {
  const lang = language || languageFromPath(path);
  const value = content == null ? '' : String(content);
  const lineCount = Math.max(1, value.split('\n').length);
  const editorHeight = Math.min(Math.max(height, lineCount * 18 + 24), 720);

  const options = useMemo(() => ({
    readOnly: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    fontSize: 13,
    lineNumbers: 'on',
    renderLineHighlight: 'none',
    contextmenu: false,
  }), []);

  if (Editor) {
    return (
      <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.cardBackground }}>
        <Text style={{ paddingHorizontal: 12, paddingVertical: 8, color: colors.textMuted, fontSize: 12 }}>{path} · {lang}</Text>
        <Editor
          height={editorHeight}
          language={lang}
          value={value}
          theme="aerekos"
          beforeMount={defineTheme}
          options={options}
        />
      </View>
    );
  }

  return (
    <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 8 }}>
      <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 6 }}>{path}</Text>
      <Text selectable style={{ fontFamily: 'monospace', fontSize: 12, color: colors.textPrimary }}>{value}</Text>
    </View>
  );
}
