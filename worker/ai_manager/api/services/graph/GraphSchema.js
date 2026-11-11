'use strict';

/** Labels and relationship types for Icarus plan-as-graph (Neo4j SOR). */

const LABELS = {
  Project: 'IcarusProject',
  Plan: 'Plan',
  Task: 'Task',
  Gate: 'Gate',
  Agent: 'Agent',
  WorldFact: 'WorldFact',
  Artifact: 'Artifact',
  Checkpoint: 'Checkpoint',
  Skill: 'Skill',
  Decision: 'Decision',
};

const RELS = {
  HAS_PLAN: 'HAS_PLAN',
  CONTAINS: 'CONTAINS',
  BEFORE: 'BEFORE',
  PARALLEL: 'PARALLEL',
  MUTEX: 'MUTEX',
  INVALIDATES: 'INVALIDATES',
  ASSIGNED_TO: 'ASSIGNED_TO',
  PRODUCED: 'PRODUCED',
  ATTACHES: 'ATTACHES',
  PARENT: 'PARENT',
  STEERED_BY: 'STEERED_BY',
  EXPLAINS: 'EXPLAINS',
  CHECKPOINT_OF: 'CHECKPOINT_OF',
};

const TASK_STATUSES = [
  'pending', 'ready', 'running', 'blocked', 'done', 'failed', 'cancelled', 'invalidated',
];

const CONSTRAINTS = `
CREATE CONSTRAINT icarus_plan_id IF NOT EXISTS FOR (p:Plan) REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT icarus_task_id IF NOT EXISTS FOR (t:Task) REQUIRE t.id IS UNIQUE;
CREATE CONSTRAINT icarus_gate_id IF NOT EXISTS FOR (g:Gate) REQUIRE g.id IS UNIQUE;
CREATE CONSTRAINT icarus_agent_id IF NOT EXISTS FOR (a:Agent) REQUIRE a.id IS UNIQUE;
CREATE CONSTRAINT icarus_artifact_id IF NOT EXISTS FOR (a:Artifact) REQUIRE a.id IS UNIQUE;
CREATE CONSTRAINT icarus_checkpoint_id IF NOT EXISTS FOR (c:Checkpoint) REQUIRE c.id IS UNIQUE;
CREATE INDEX icarus_task_status IF NOT EXISTS FOR (t:Task) ON (t.status);
CREATE INDEX icarus_task_project IF NOT EXISTS FOR (t:Task) ON (t.project_id);
CREATE INDEX icarus_plan_project IF NOT EXISTS FOR (p:Plan) ON (p.project_id);
`;

module.exports = {
  LABELS, RELS, TASK_STATUSES, CONSTRAINTS,
};
