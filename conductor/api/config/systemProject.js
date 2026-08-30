'use strict';

const SYSTEM_PROJECT_ID = '9d8bde11-6933-4732-b746-602dcf72eaa5';
const AEREKOS_CLOUD_REPO = 'aerekos-cloud';

function isSystemProject(projectId) {
  return String(projectId || '') === SYSTEM_PROJECT_ID;
}

function isAerekosCloudFleet(projectId, repoName) {
  return isSystemProject(projectId) && String(repoName || '') === AEREKOS_CLOUD_REPO;
}

module.exports = { SYSTEM_PROJECT_ID, AEREKOS_CLOUD_REPO, isSystemProject, isAerekosCloudFleet };
