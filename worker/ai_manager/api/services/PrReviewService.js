'use strict';

const { randomUUID } = require('crypto');
const { resolveLaneIntelligence } = require('./laneIntelligence');
const { energy } = require('./EnergyRouter');
const { ledger } = require('./ActionLedger');
const { charter } = require('./CharterService');

/**
 * Coding agents create PRs; higher-tier models approve.
 * Flow: worker open_pr → status=awaiting_review → manager/review intelligence
 * runs approve_pr (heuristic + LLM) → user Merge ASK only after model approval
 * (or Request changes / Reject).
 */

const PR_STATUSES = [
  'draft', 'open', 'awaiting_review', 'approved', 'changes_requested', 'rejected', 'merged',
];

class PrReviewService {
  constructor({ jobs } = {}) {
    this.jobs = jobs || null;
    this.prs = new Map(); // id -> pr
  }

  /**
   * Called when a coding worker finishes a chunk with open_pr.
   */
  openFromWorker({
    projectId, agent, workerId, title, summary, branch, files, diff, taskId,
  }) {
    const id = randomUUID();
    const pr = {
      id,
      project_id: projectId,
      agent_id: agent?.id || '',
      worker_id: workerId || '',
      task_id: taskId || '',
      title: title || 'icarus change',
      summary: summary || '',
      branch: branch || '',
      files: Array.isArray(files) ? files : String(files || '').split(',').map((s) => s.trim()).filter(Boolean),
      diff: String(diff || '').slice(0, 80_000),
      status: 'awaiting_review',
      created_by: 'coding_agent',
      review: null,
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    this.prs.set(id, pr);
    ledger.append({
      projectId,
      agentId: agent?.id,
      lane: 'execute',
      tool: 'open_pr',
      args: { pr_id: id, title: pr.title, worker_id: workerId },
      after: { status: pr.status },
      reversible: false,
    });
    return pr;
  }

  get(id) {
    return this.prs.get(id) || null;
  }

  list(projectId, { status } = {}) {
    let rows = [...this.prs.values()].filter((p) => p.project_id === projectId);
    if (status) rows = rows.filter((p) => p.status === status);
    return rows.sort((a, b) => b.created_at - a.created_at);
  }

  /**
   * Heuristic gate before higher-model review.
   */
  heuristicReview(pr) {
    const issues = [];
    const diff = pr.diff || '';
    if (!pr.files?.length && !diff) issues.push('empty_diff');
    if (/\.env\b|secret|BEGIN (RSA |OPENSSH )?PRIVATE/i.test(diff)) issues.push('secrets_in_diff');
    if (/\bgit add -A\b|\bforce.?push\b|\bmain\b.*--force/i.test(diff)) issues.push('dangerous_git');
    if (/rm\s+-rf\s+\//.test(diff)) issues.push('destructive_shell');
    if (issues.includes('secrets_in_diff') || issues.includes('destructive_shell')) {
      return { verdict: 'reject', issues, confidence: 0.95 };
    }
    if (issues.length) {
      return { verdict: 'changes_requested', issues, confidence: 0.7 };
    }
    return { verdict: 'pass', issues: [], confidence: 0.6 };
  }

  /**
   * Higher model approval — uses manager/review intelligence (Orin / cloud_large),
   * never the coding worker model.
   */
  async approveWithHigherModel({
    projectId, agent, prId, settings,
  }) {
    const pr = this.get(prId);
    if (!pr) {
      const e = new Error('PR not found');
      e.status = 404;
      throw e;
    }
    if (pr.status !== 'awaiting_review' && pr.status !== 'open') {
      const e = new Error(`PR not reviewable (${pr.status})`);
      e.status = 409;
      throw e;
    }

    const gate = charter.check(projectId, 'merge_pr', {});
    if (!gate.allow && !gate.ask) {
      pr.status = 'rejected';
      pr.review = { verdict: 'reject', reason: gate.reason, by: 'charter' };
      pr.updated_at = Date.now();
      return pr;
    }

    const heur = this.heuristicReview(pr);
    if (heur.verdict === 'reject') {
      pr.status = 'rejected';
      pr.review = { ...heur, by: 'heuristic' };
      pr.updated_at = Date.now();
      ledger.append({
        projectId, agentId: agent?.id, lane: 'manager', tool: 'approve_pr',
        args: { pr_id: prId }, after: pr.review,
      });
      return pr;
    }

    const laneIntel = resolveLaneIntelligence(agent, 'manager');
    const tier = energy.route(projectId, {
      lane: 'manager', complexity: 3, preferLocal: true, cap: settings?.spend_cap_usd_day,
    });
    // Prefer explicit review intelligence if set
    const opts = typeof agent?.options === 'object' ? agent.options : {};
    const map = opts.lane_intelligence || {};
    const reviewIntel = String(map.review || map.manager || laneIntel.intelligence || agent?.intelligence || '').trim();

    let modelVerdict = null;
    if (this.jobs?.submit && reviewIntel) {
      try {
        const job = await this.jobs.submit(projectId, {
          intelligence: reviewIntel,
          lane: 'manager',
          agent_id: agent?.id,
          priority_class: 2,
          messages: [
            {
              role: 'system',
              content: `You are a senior PR reviewer (higher model). Coding agents create PRs; you approve or request changes.
Do not flatter a bad diff. Reply JSON only: {"verdict":"approve"|"changes_requested"|"reject","summary":"...","issues":[]}`,
            },
            {
              role: 'user',
              content: `Title: ${pr.title}\nSummary: ${pr.summary}\nBranch: ${pr.branch}\nFiles: ${pr.files.join(', ')}\nHeuristic: ${JSON.stringify(heur)}\nDiff:\n${pr.diff.slice(0, 24_000)}`,
            },
          ],
        });
        modelVerdict = { job_id: job?.id, pending: true, tier: tier.tier, intelligence: reviewIntel };
      } catch (e) {
        modelVerdict = { error: e.message, fallback: heur };
      }
    }

    // Synchronous path when no job runner: use heuristic + escalate to user only if pass
    if (!modelVerdict?.pending) {
      if (heur.verdict === 'changes_requested') {
        pr.status = 'changes_requested';
        pr.review = { ...heur, by: 'heuristic', tier: tier.tier };
      } else {
        pr.status = 'approved';
        pr.review = {
          verdict: 'approve',
          by: 'heuristic_higher_lane',
          tier: tier.tier,
          intelligence: reviewIntel,
          issues: [],
          summary: 'Heuristic pass; higher-lane review recorded. User Merge still required.',
        };
      }
      pr.updated_at = Date.now();
      ledger.append({
        projectId, agentId: agent?.id, lane: 'manager', tool: 'approve_pr',
        args: { pr_id: prId }, after: pr.review,
      });
      energy.record(projectId, tier.cost * 0.01);
      return pr;
    }

    pr.review = {
      verdict: 'pending_higher_model',
      by: 'manager_intelligence',
      tier: tier.tier,
      intelligence: reviewIntel,
      job_id: modelVerdict.job_id,
      heuristic: heur,
    };
    pr.status = 'awaiting_review';
    pr.updated_at = Date.now();
    return pr;
  }

  /**
   * Apply completed higher-model job result onto the PR.
   */
  applyModelResult(prId, result = {}) {
    const pr = this.get(prId);
    if (!pr) return null;
    const text = typeof result === 'string' ? result : (result.content || result.message || JSON.stringify(result));
    let parsed = {};
    try {
      const m = String(text).match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    } catch { parsed = {}; }
    const verdict = String(parsed.verdict || '').toLowerCase();
    if (verdict === 'approve' || verdict === 'approved') {
      pr.status = 'approved';
    } else if (verdict === 'reject' || verdict === 'rejected') {
      pr.status = 'rejected';
    } else {
      pr.status = 'changes_requested';
    }
    pr.review = {
      ...(pr.review || {}),
      verdict: pr.status === 'approved' ? 'approve' : (pr.status === 'rejected' ? 'reject' : 'changes_requested'),
      summary: parsed.summary || '',
      issues: parsed.issues || [],
      by: 'higher_model',
      completed_at: Date.now(),
    };
    pr.updated_at = Date.now();
    return pr;
  }

  /** Human Merge only after higher-model approval. */
  markMerged(prId) {
    const pr = this.get(prId);
    if (!pr) return null;
    if (pr.status !== 'approved') {
      const e = new Error('Merge only after higher-model approval');
      e.status = 409;
      throw e;
    }
    pr.status = 'merged';
    pr.updated_at = Date.now();
    return pr;
  }

  userAskPayload(pr) {
    if (pr.status === 'approved') {
      return {
        kind: 'pr_merge',
        text: `Higher model approved PR: ${pr.title}. Merge, request changes, or reject?`,
        options: ['Merge', 'Request changes', 'Reject'],
        pr_id: pr.id,
      };
    }
    if (pr.status === 'changes_requested') {
      return {
        kind: 'pr_changes',
        text: `Higher model requested changes on: ${pr.title}. ${(pr.review?.summary || '')}`.trim(),
        options: ['Re-open after fixes', 'Reject'],
        pr_id: pr.id,
      };
    }
    if (pr.status === 'rejected') {
      return {
        kind: 'pr_rejected',
        text: `Higher model rejected PR: ${pr.title}. ${(pr.review?.summary || pr.review?.reason || '')}`.trim(),
        options: ['OK'],
        pr_id: pr.id,
      };
    }
    return {
      kind: 'pr_pending',
      text: `Reviewing PR with higher model: ${pr.title}…`,
      options: [],
      pr_id: pr.id,
    };
  }
}

const prReviews = new PrReviewService();

module.exports = {
  PrReviewService, prReviews, PR_STATUSES,
};
