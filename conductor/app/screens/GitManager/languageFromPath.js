const MAP = {
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  json: 'json', yml: 'yaml', yaml: 'yaml',
  md: 'markdown', markdown: 'markdown',
  py: 'python', rb: 'ruby', go: 'go', rs: 'rust',
  java: 'java', kt: 'kotlin', swift: 'swift',
  css: 'css', scss: 'scss', html: 'html', xml: 'xml',
  sh: 'shell', bash: 'shell', zsh: 'shell',
  sql: 'sql', dockerfile: 'dockerfile',
  toml: 'ini', ini: 'ini', env: 'ini',
};

export function languageFromPath(path) {
  const name = String(path || '').split('/').pop() || '';
  if (/^dockerfile$/i.test(name)) return 'dockerfile';
  const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
  return MAP[ext] || 'plaintext';
}

export const README_NAMES = ['README.md', 'README.markdown', 'README.rst', 'README'];
