export function parseUnifiedDiff(raw) {
  const text = String(raw || '');
  if (!text.trim()) return [];
  const files = [];
  let current = null;
  for (const line of text.split('\n')) {
    if (line.startsWith('diff --git ')) {
      if (current) files.push(current);
      const m = line.match(/b\/(.+)$/);
      current = { path: m ? m[1] : line.slice(11), added: 0, removed: 0, lines: [] };
      continue;
    }
    if (!current) continue;
    if (line.startsWith('+++ ') || line.startsWith('--- ') || line.startsWith('index ') || line.startsWith('new file') || line.startsWith('deleted file')) {
      current.lines.push(line);
      continue;
    }
    if (line.startsWith('+')) current.added += 1;
    if (line.startsWith('-') && !line.startsWith('--')) current.removed += 1;
    current.lines.push(line);
  }
  if (current) files.push(current);
  return files;
}
