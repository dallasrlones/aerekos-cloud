#!/usr/bin/env node
/**
 * post-receive hook helper. Reads ref updates on stdin (one "<old> <new> <ref>"
 * per line) and records each as a push event on the local git_manager API.
 * Invoked as: node notifyPush.js <projectId> <repoId> <repoName>
 */
const [, , projectId, repoId, repoName] = process.argv;
const port = process.env.PORT || '3130';
const base = process.env.GIT_MANAGER_SELF_URL || `http://127.0.0.1:${port}`;

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { input += c; });
process.stdin.on('end', async () => {
  const lines = input.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const [oldSha, newSha, ref] = line.split(/\s+/);
    try {
      await fetch(`${base}/api/v1/internal/push-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          repo_id: repoId,
          repo_name: repoName,
          ref,
          old_sha: oldSha,
          new_sha: newSha,
          pusher: process.env.GIT_PUSHER || ''
        })
      });
    } catch (e) {
      // Non-fatal: never block a push because bookkeeping failed.
      console.error('[git_manager] push notify failed:', e.message);
    }
  }
  process.exit(0);
});
