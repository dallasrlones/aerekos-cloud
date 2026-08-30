'use strict';

const { requireShared } = require('../utils/loadWorkerShared');
const { evaluatePolicies } = requireShared('policyEvaluator');
const ServiceManager = require('./ServiceManager');
const WorkerRepository = require('../repos/WorkerRepository');

class PolicyEvaluator {
  constructor(deps = {}) {
    this.serviceManager = deps.serviceManager || ServiceManager.getInstance(WorkerRepository);
    this._cache = new Map();
    this.ttlMs = parseInt(process.env.IAM_EVAL_CACHE_TTL_MS || '30000', 10);
  }

  cacheKey({ projectId, roleName, roleId, action, resourceArn }) {
    return `${projectId}|${roleName || roleId || ''}|${action}|${resourceArn}`;
  }

  /**
   * Evaluate IAM policies via iam_manager (cached).
   */
  async evaluate({
    projectId,
    roleName,
    roleId,
    policyIds,
    action,
    resourceArn,
  }) {
    const key = this.cacheKey({ projectId, roleName, roleId, action, resourceArn });
    const hit = this._cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.result;

    const result = await this.serviceManager.proxyServiceRequest(
      'iam_manager',
      'POST',
      '/api/v1/evaluate',
      {
        project_id: projectId,
        role_name: roleName,
        role_id: roleId,
        policy_ids: policyIds,
        action,
        resource_arn: resourceArn,
      },
      {},
      projectId,
    );

    const evaluation = result.data?.evaluation || result.data;
    this._cache.set(key, { result: evaluation, expires: Date.now() + this.ttlMs });
    return evaluation;
  }

  /** In-process evaluation (tests / offline). */
  evaluateLocal(policies, request) {
    return evaluatePolicies(policies, request);
  }

  clearCache() {
    this._cache.clear();
  }
}

const singleton = new PolicyEvaluator();
module.exports = singleton;
module.exports.PolicyEvaluator = PolicyEvaluator;
