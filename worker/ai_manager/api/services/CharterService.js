'use strict';

/**
 * Project charter / constitution — policy gates for agents (Phase 7–8).
 */

const DEFAULT_CHARTER = {
  version: 1,
  never_wipe_prod: true,
  ask_before_deploy: true,
  ask_before_pay: true,
  ask_before_external_send: true,
  no_env_read: true,
  no_docker_in_jail: true,
  spend_cap_usd_day: 50,
  injection_harden: true,
  allowed_projects_deny: ['ea370977-3aff-4c76-95a6-a0c50fd2bce7'],
};

class CharterService {
  constructor() {
    this.byProject = new Map();
  }

  get(projectId) {
    return this.byProject.get(projectId) || { ...DEFAULT_CHARTER, project_id: projectId };
  }

  set(projectId, patch = {}) {
    const cur = this.get(projectId);
    const next = {
      ...cur, ...patch, project_id: projectId, updated_at: Date.now(),
    };
    this.byProject.set(projectId, next);
    return next;
  }

  /**
   * @returns {{ allow: boolean, ask?: boolean, reason?: string }}
   */
  check(projectId, action, ctx = {}) {
    const c = this.get(projectId);
    if (c.allowed_projects_deny?.includes(projectId) && /deploy|wipe|prod/i.test(action)) {
      return { allow: false, reason: 'charter_deny_project' };
    }
    if (c.never_wipe_prod && /wipe|destroy|drop\s+database|rm\s+-rf\s+\/(\s|$)/i.test(action)) {
      return { allow: false, reason: 'never_wipe_prod' };
    }
    if (c.ask_before_deploy && /deploy/i.test(action)) {
      return { allow: false, ask: true, reason: 'ask_before_deploy' };
    }
    if (c.ask_before_pay && /pay|purchase|checkout/i.test(action)) {
      return { allow: false, ask: true, reason: 'ask_before_pay' };
    }
    if (c.ask_before_external_send && /send|email|slack|post_message/i.test(action)) {
      return { allow: false, ask: true, reason: 'ask_before_external_send' };
    }
    if (c.no_env_read && /\.env|secret/i.test(String(ctx.path || action))) {
      return { allow: false, reason: 'no_env_read' };
    }
    if (c.spend_cap_usd_day != null && ctx.spend_usd_today != null
      && Number(ctx.spend_usd_today) >= Number(c.spend_cap_usd_day)) {
      return { allow: false, reason: 'spend_cap' };
    }
    return { allow: true };
  }
}

const charter = new CharterService();

module.exports = { CharterService, charter, DEFAULT_CHARTER };
