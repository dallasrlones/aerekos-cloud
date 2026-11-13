'use strict';

import api from '../../utils/api';

export function confirmAttach(message) {
  if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
    return window.confirm(message);
  }
  return true;
}

export async function previewAttachFunction({ projectId, repoId, ref, path, name }) {
  const res = await api.post('/api/adonis/attach-function', {
    project_id: projectId,
    repo_id: repoId,
    ref,
    path,
    name,
    preview: true,
  });
  return res.data;
}

export async function commitAttachFunction({ projectId, repoId, ref, path, name }) {
  const res = await api.post('/api/adonis/attach-function', {
    project_id: projectId,
    repo_id: repoId,
    ref,
    path,
    name,
    confirm: true,
  });
  return res.data;
}

export async function previewExposeApi({ projectId, repoId, ref, path, method, publicPath, functionName }) {
  const res = await api.post('/api/adonis/expose-api', {
    project_id: projectId,
    repo_id: repoId,
    ref,
    path,
    method,
    public_path: publicPath,
    function_name: functionName,
    preview: true,
  });
  return res.data;
}

export async function commitExposeApi({ projectId, repoId, ref, path, method, publicPath, functionName }) {
  const res = await api.post('/api/adonis/expose-api', {
    project_id: projectId,
    repo_id: repoId,
    ref,
    path,
    method,
    public_path: publicPath,
    function_name: functionName,
    confirm: true,
  });
  return res.data;
}

export async function runIdeAttachAction(kind, ctx) {
  const isFn = kind === 'attach_function';
  const preview = isFn
    ? await previewAttachFunction(ctx)
    : await previewExposeApi(ctx);
  const text = preview.speak_text || preview.plan?.action || kind;
  if (!confirmAttach(`${text}\n\nUpdate project stack?`)) {
    return { cancelled: true };
  }
  return isFn ? commitAttachFunction(ctx) : commitExposeApi(ctx);
}
