'use strict';

const PROD_PROJECT_ID = 'ea370977-3aff-4c76-95a6-a0c50fd2bce7';

function assertNotProdProject(projectId) {
  if (String(projectId || '') === PROD_PROJECT_ID) {
    throw new Error(`refusing to mutate production project ${PROD_PROJECT_ID}`);
  }
}

module.exports = { PROD_PROJECT_ID, assertNotProdProject };
