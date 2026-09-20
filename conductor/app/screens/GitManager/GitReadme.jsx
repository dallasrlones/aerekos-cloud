import React, { useEffect, useState } from 'react';
import { Image, Platform, Text, View } from 'react-native';
import { colors } from '../../styles/theme';
import { Box } from '../../components/Box/Box';
import api from '../../utils/api';

let Markdown = null;
let remarkGfm = null;
if (Platform.OS === 'web') {
  try {
    Markdown = require('react-markdown').default;
    remarkGfm = require('remark-gfm').default;
  } catch {
    Markdown = null;
  }
}

const MD_CSS = `
.markdown-body { color: #2C2C2C; font-size: 16px; line-height: 1.6; word-wrap: break-word; }
.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4 {
  margin: 1.2em 0 0.6em; font-weight: 600; line-height: 1.25;
}
.markdown-body h1 { font-size: 2em; border-bottom: 1px solid #E0E0E0; padding-bottom: 0.3em; }
.markdown-body h2 { font-size: 1.5em; border-bottom: 1px solid #E0E0E0; padding-bottom: 0.3em; }
.markdown-body h3 { font-size: 1.25em; }
.markdown-body p, .markdown-body ul, .markdown-body ol, .markdown-body table, .markdown-body pre {
  margin-bottom: 16px;
}
.markdown-body a { color: #0969da; text-decoration: none; }
.markdown-body a:hover { text-decoration: underline; }
.markdown-body ul, .markdown-body ol { padding-left: 2em; }
.markdown-body li { margin-bottom: 0.25em; }
.markdown-body code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 85%; background: #F5F5F5; padding: 0.2em 0.4em; border-radius: 6px;
}
.markdown-body pre {
  background: #F5F5F5; padding: 16px; overflow: auto; border-radius: 6px; line-height: 1.45;
}
.markdown-body pre code { background: transparent; padding: 0; font-size: 13px; }
.markdown-body table { border-collapse: collapse; display: block; overflow: auto; width: 100%; }
.markdown-body th, .markdown-body td { border: 1px solid #D0D0D0; padding: 6px 13px; }
.markdown-body th { background: #F5F5F5; font-weight: 600; }
.markdown-body blockquote { border-left: 4px solid #D0D0D0; padding: 0 1em; color: #6B6B6B; margin: 0 0 16px; }
.markdown-body img { max-width: 100%; }
.markdown-body hr { border: 0; border-top: 1px solid #E0E0E0; margin: 24px 0; }
`;

function joinPath(dir, href) {
  const raw = String(href || '').trim();
  if (!raw || /^[a-z]+:\/\//i.test(raw) || raw.startsWith('#') || raw.startsWith('/')) return raw;
  const base = String(dir || '').replace(/\/+$/, '');
  const parts = `${base ? `${base}/` : ''}${raw}`.split('/');
  const out = [];
  for (const p of parts) {
    if (!p || p === '.') continue;
    if (p === '..') out.pop();
    else out.push(p);
  }
  return out.join('/');
}

function ReadmeImage({ repoId, projectId, gitRef, dir, src, alt }) {
  const [uri, setUri] = useState(null);
  const resolved = joinPath(dir, src);
  useEffect(() => {
    let cancelled = false;
    if (!repoId || !resolved || /^[a-z]+:\/\//i.test(resolved)) {
      setUri(/^[a-z]+:\/\//i.test(src) ? src : null);
      return undefined;
    }
    api.get(`/api/services/git_manager/api/v1/repos/${repoId}/blob`, {
      params: { project_id: projectId, path: resolved, ref: gitRef },
    }).then((b) => {
      if (cancelled) return;
      if (b.data?.content_base64) {
        const ext = resolved.split('.').pop()?.toLowerCase() || 'png';
        const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
        setUri(`data:${mime};base64,${b.data.content_base64}`);
      }
    }).catch(() => { if (!cancelled) setUri(null); });
    return () => { cancelled = true; };
  }, [repoId, projectId, gitRef, resolved, src]);
  if (!uri) {
    return <Text style={{ color: colors.textMuted, fontSize: 12 }}>{alt || resolved}</Text>;
  }
  if (Platform.OS === 'web') {
    return <img src={uri} alt={alt || ''} style={{ maxWidth: '100%' }} />;
  }
  return <Image source={{ uri }} style={{ maxWidth: '100%', height: 240 }} resizeMode="contain" />;
}

export function GitReadme({ name, content, repoId, projectId, gitRef, dir }) {
  if (!content) return null;
  const folder = dir || '';
  const title = name || 'README.md';

  if (Platform.OS === 'web' && Markdown) {
    return (
      <Box title={title}>
        <style>{MD_CSS}</style>
        <div className="markdown-body">
          <Markdown
            remarkPlugins={remarkGfm ? [remarkGfm] : []}
            components={{
              img: ({ src, alt }) => (
                <ReadmeImage repoId={repoId} projectId={projectId} gitRef={gitRef} dir={folder} src={src} alt={alt} />
              ),
            }}
          >
            {content}
          </Markdown>
        </div>
      </Box>
    );
  }

  return (
    <Box title={title}>
      <Text selectable style={{ fontFamily: 'monospace', fontSize: 13, color: colors.textPrimary }}>
        {content}
      </Text>
    </Box>
  );
}
