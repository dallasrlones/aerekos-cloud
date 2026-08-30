const db = require('../utils/dbClient');

// IAM-shaped names; project-scoped RBAC. Policies store a JSON `document` (actions/resources, etc.)
const IamRole = db.model(
  'IamRole',
  {
    project_id: 'string',
    name: 'string',
    description: 'string',
    metadata: 'string'
  },
  {
    required: ['project_id', 'name'],
    indexes: ['project_id', 'name'],
    timestamps: true
  }
);

const IamPolicy = db.model(
  'IamPolicy',
  {
    project_id: 'string',
    name: 'string',
    effect: 'string',
    document: 'string',
    description: 'string',
    metadata: 'string'
  },
  {
    required: ['project_id', 'name', 'effect', 'document'],
    indexes: ['project_id', 'name'],
    timestamps: true
  }
);

// Many-to-many: which policies are bound to a role
const IamRolePolicyBinding = db.model(
  'IamRolePolicyBinding',
  {
    project_id: 'string',
    role_id: 'string',
    policy_id: 'string'
  },
  {
    required: ['project_id', 'role_id', 'policy_id'],
    indexes: ['project_id', 'role_id', 'policy_id'],
    timestamps: true
  }
);

module.exports = { IamRole, IamPolicy, IamRolePolicyBinding, db };
