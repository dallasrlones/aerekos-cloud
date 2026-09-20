export const RETIRED_PROJECT_IDS = new Set([
  'ea370977-3aff-4c76-95a6-a0c50fd2bce7',
]);

export const RETIRED_PROJECT_NAMES = new Set(['docunu-dev', 'docunu']);

export function isRetiredProject(project) {
  if (!project) return false;
  if (RETIRED_PROJECT_IDS.has(project.id)) return true;
  return RETIRED_PROJECT_NAMES.has(String(project.name || '').toLowerCase());
}

export function visibleProjects(list) {
  return (list || []).filter((p) => !isRetiredProject(p));
}
