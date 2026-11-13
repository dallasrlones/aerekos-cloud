'use strict';

/** fleet-apply-rebuild-v1 — marker for Slice 0 live DoD (must appear in rebuilt conductor image) */
const FLEET_APPLY_MARKER = 'fleet-apply-rebuild-v1';
const SYSTEM_PROJECT_ID = '9d8bde11-6933-4732-b746-602dcf72eaa5';
const SYSTEM_PROJECT_NAME = 'system';
const AEREKOS_CLOUD_REPO = 'aerekos-cloud';

function isSystemProject(projectId, projectName) {
  if (String(projectId || '') === SYSTEM_PROJECT_ID) return true;
  if (String(projectName || '').trim().toLowerCase() === SYSTEM_PROJECT_NAME) return true;
  return false;
}

function isAerekosCloudFleet(projectId, repoName) {
  return isSystemProject(projectId) && String(repoName || '') === AEREKOS_CLOUD_REPO;
}

module.exports = {
  FLEET_APPLY_MARKER,
  SYSTEM_PROJECT_ID,
  SYSTEM_PROJECT_NAME,
  AEREKOS_CLOUD_REPO,
  isSystemProject,
  isAerekosCloudFleet,
};
