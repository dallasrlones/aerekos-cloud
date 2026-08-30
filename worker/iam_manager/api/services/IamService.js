const { IamRole, IamPolicy, IamRolePolicyBinding } = require('../models');
const { evaluatePolicies, validatePolicyResources } = require('../../../shared/policyEvaluator');

const NAME_RE = /^[a-zA-Z][a-zA-Z0-9_.-]{0,127}$/;

class IamService {
  constructor(deps = {}) {
    this.IamRole = deps.IamRole || IamRole;
    this.IamPolicy = deps.IamPolicy || IamPolicy;
    this.IamRolePolicyBinding = deps.IamRolePolicyBinding || IamRolePolicyBinding;
  }

  assertProjectId(projectId) {
    if (!projectId || String(projectId).trim() === '') {
      const e = new Error('project_id is required');
      e.status = 400;
      throw e;
    }
  }

  validateName(name, label) {
    if (!name || !NAME_RE.test(String(name).trim())) {
      const e = new Error(
        `${label}: 1-128 chars, start with a letter, then letters, numbers, . _ -`
      );
      e.status = 400;
      throw e;
    }
    return String(name).trim();
  }

  parseDocument(doc) {
    if (doc == null) {
      const e = new Error('document is required (JSON object describing actions/resources)');
      e.status = 400;
      throw e;
    }
    if (typeof doc === 'string') {
      try {
        return JSON.stringify(JSON.parse(doc));
      } catch {
        const e = new Error('document must be valid JSON');
        e.status = 400;
        throw e;
      }
    }
    try {
      return JSON.stringify(doc);
    } catch {
      const e = new Error('document must be a JSON object');
      e.status = 400;
      throw e;
    }
  }

  documentToJson(documentStr) {
    try {
      return JSON.parse(documentStr || '{}');
    } catch {
      return {};
    }
  }

  assertEffect(eff) {
    const v = String(eff || '')
      .trim()
      .toLowerCase();
    if (v !== 'allow' && v !== 'deny') {
      const e = new Error('effect must be "allow" or "deny"');
      e.status = 400;
      throw e;
    }
    return v;
  }

  // ——— Roles ———
  async createRole(body) {
    this.assertProjectId(body.project_id);
    const name = this.validateName(body.name, 'name');
    const existing = await this.IamRole.findAll({
      where: { project_id: body.project_id, name }
    });
    if (existing.length) {
      const e = new Error(`Role "${name}" already exists in this project`);
      e.status = 409;
      e.code = 'ROLE_NAME_TAKEN';
      throw e;
    }
    return this.IamRole.create({
      project_id: body.project_id,
      name,
      description: body.description != null ? String(body.description) : '',
      metadata: this.normalizeMeta(body.metadata)
    });
  }

  normalizeMeta(meta) {
    if (meta == null) return '';
    if (typeof meta === 'string') return meta;
    return JSON.stringify(meta);
  }

  async listRoles(projectId) {
    this.assertProjectId(projectId);
    return this.IamRole.findAll({ where: { project_id: projectId } });
  }

  async getRole(id, projectId) {
    this.assertProjectId(projectId);
    const rows = await this.IamRole.findAll({ where: { id, project_id: projectId } });
    if (!rows.length) {
      const e = new Error('Role not found');
      e.status = 404;
      throw e;
    }
    return rows[0];
  }

  async updateRole(id, projectId, body) {
    await this.getRole(id, projectId);
    const patch = {};
    if (body.description != null) patch.description = String(body.description);
    if (body.metadata != null) patch.metadata = this.normalizeMeta(body.metadata);
    if (Object.keys(patch).length === 0) {
      return this.getRole(id, projectId);
    }
    await this.IamRole.update(id, patch);
    return this.getRole(id, projectId);
  }

  async deleteRole(id, projectId) {
    await this.getRole(id, projectId);
    const links = await this.IamRolePolicyBinding.findAll({
      where: { project_id: projectId, role_id: id }
    });
    for (const l of links) {
      await this.IamRolePolicyBinding.delete(l.id);
    }
    await this.IamRole.delete(id);
    return { deleted: true, id };
  }

  // ——— Policies ———
  async createPolicy(body) {
    this.assertProjectId(body.project_id);
    const name = this.validateName(body.name, 'name');
    const effect = this.assertEffect(body.effect);
    const document = this.parseDocument(body.document);
    const invalid = validatePolicyResources(body.document);
    if (invalid.length) {
      const e = new Error(`Invalid policy resources: ${invalid.join(', ')}`);
      e.status = 400;
      e.code = 'INVALID_POLICY_RESOURCES';
      throw e;
    }
    const existing = await this.IamPolicy.findAll({
      where: { project_id: body.project_id, name }
    });
    if (existing.length) {
      const e = new Error(`Policy "${name}" already exists in this project`);
      e.status = 409;
      e.code = 'POLICY_NAME_TAKEN';
      throw e;
    }
    return this.IamPolicy.create({
      project_id: body.project_id,
      name,
      effect,
      document,
      description: body.description != null ? String(body.description) : '',
      metadata: this.normalizeMeta(body.metadata)
    });
  }

  async listPolicies(projectId) {
    this.assertProjectId(projectId);
    return this.IamPolicy.findAll({ where: { project_id: projectId } });
  }

  async getPolicy(id, projectId) {
    this.assertProjectId(projectId);
    const rows = await this.IamPolicy.findAll({ where: { id, project_id: projectId } });
    if (!rows.length) {
      const e = new Error('Policy not found');
      e.status = 404;
      throw e;
    }
    return rows[0];
  }

  async updatePolicy(id, projectId, body) {
    await this.getPolicy(id, projectId);
    const patch = {};
    if (body.description != null) patch.description = String(body.description);
    if (body.metadata != null) patch.metadata = this.normalizeMeta(body.metadata);
    if (body.effect != null) patch.effect = this.assertEffect(body.effect);
    if (body.document != null) patch.document = this.parseDocument(body.document);
    if (Object.keys(patch).length === 0) {
      return this.getPolicy(id, projectId);
    }
    await this.IamPolicy.update(id, patch);
    return this.getPolicy(id, projectId);
  }

  async deletePolicy(id, projectId) {
    await this.getPolicy(id, projectId);
    const links = await this.IamRolePolicyBinding.findAll({
      where: { project_id: projectId, policy_id: id }
    });
    for (const l of links) {
      await this.IamRolePolicyBinding.delete(l.id);
    }
    await this.IamPolicy.delete(id);
    return { deleted: true, id };
  }

  // ——— Bindings ———
  async attachPolicyToRole(roleId, policyId, projectId) {
    await this.getRole(roleId, projectId);
    await this.getPolicy(policyId, projectId);
    const dup = await this.IamRolePolicyBinding.findAll({
      where: { project_id: projectId, role_id: roleId, policy_id: policyId }
    });
    if (dup.length) {
      const e = new Error('Policy is already attached to this role');
      e.status = 409;
      e.code = 'ALREADY_ATTACHED';
      throw e;
    }
    return this.IamRolePolicyBinding.create({
      project_id: projectId,
      role_id: roleId,
      policy_id: policyId
    });
  }

  async detachPolicyFromRole(roleId, policyId, projectId) {
    await this.getRole(roleId, projectId);
    await this.getPolicy(policyId, projectId);
    const rows = await this.IamRolePolicyBinding.findAll({
      where: { project_id: projectId, role_id: roleId, policy_id: policyId }
    });
    if (!rows.length) {
      const e = new Error('Binding not found');
      e.status = 404;
      throw e;
    }
    await this.IamRolePolicyBinding.delete(rows[0].id);
    return { detached: true, role_id: roleId, policy_id: policyId };
  }

  async listPoliciesForRole(roleId, projectId) {
    await this.getRole(roleId, projectId);
    const links = await this.IamRolePolicyBinding.findAll({
      where: { project_id: projectId, role_id: roleId }
    });
    const policies = [];
    for (const l of links) {
      const p = await this.getPolicy(l.policy_id, projectId);
      policies.push(p);
    }
    return { bindings: links, policies };
  }

  actionMatches(pattern, action) {
    if (!pattern || pattern === '*') return true;
    if (pattern === action) return true;
    if (pattern.endsWith('*') && String(action).startsWith(pattern.slice(0, -1))) return true;
    return false;
  }

  resourceMatches(pattern, resource) {
    if (!pattern || pattern === '*') return true;
    if (pattern === resource) return true;
    if (String(pattern).endsWith('*') && String(resource).startsWith(String(pattern).slice(0, -1))) return true;
    return false;
  }

  /**
   * Evaluate whether a principal may perform action on resource.
   * Uses policies attached to role_name / role_id when provided.
   * Default deny. Explicit deny wins.
   */
  async evaluateAccess(body = {}) {
    const projectId = body.project_id;
    this.assertProjectId(projectId);
    const action = String(body.action || body.scope || '').trim();
    const resource = String(body.resource || body.resource_arn || body.arn || '*').trim();

    let policies;
    const roleName = body.role_name || body.roleName;
    const roleId = body.role_id || body.roleId;
    if (roleName || roleId) {
      let role;
      if (roleId) {
        role = await this.getRole(roleId, projectId);
      } else {
        const rows = await this.IamRole.findAll({ where: { project_id: projectId, name: String(roleName).trim() } });
        if (!rows.length) {
          return { allowed: false, effect: 'deny', action, resource, matched: null, reason: 'role not found' };
        }
        role = rows[0];
      }
      const listed = await this.listPoliciesForRole(role.id, projectId);
      policies = listed.policies;
    } else {
      policies = await this.IamPolicy.findAll({ where: { project_id: projectId } });
    }

    const result = evaluatePolicies(policies, { action, resourceArn: resource });
    return {
      allowed: result.allowed,
      effect: result.allowed ? 'allow' : 'deny',
      action,
      resource,
      matched: result.matched,
      reason: result.reason,
    };
  }
}

module.exports = { IamService };
