'use strict';

/** Kind catalog — no vendor literals in the agent loop. */
const KINDS = {
  'google-calendar': {
    name: 'google-calendar',
    auth: 'oauth2',
    docs: 'Google Calendar events',
    tools: [
      { name: 'list_events', write: false, description: 'List events in a time range' },
      { name: 'get_event', write: false, description: 'Get one event' },
      { name: 'create_event', write: true, description: 'Create an event' },
      { name: 'delete_event', write: true, description: 'Delete an event' },
    ],
  },
  gmail: {
    name: 'gmail',
    auth: 'oauth2',
    docs: 'Gmail inbox',
    tools: [
      { name: 'count_today', write: false, description: 'Count messages received today' },
      { name: 'list_messages', write: false, description: 'List messages' },
      { name: 'get_message', write: false, description: 'Get one message' },
      { name: 'send', write: true, description: 'Send a message' },
    ],
  },
  imap: {
    name: 'imap',
    auth: 'api_key',
    docs: 'Generic IMAP mailbox',
    tools: [
      { name: 'count_today', write: false, description: 'Count messages received today' },
      { name: 'list_messages', write: false, description: 'List messages' },
    ],
  },
  slack: {
    name: 'slack',
    auth: 'oauth2',
    docs: 'Slack workspace',
    tools: [
      { name: 'list_channels', write: false },
      { name: 'post_message', write: true },
    ],
  },
  github: {
    name: 'github',
    auth: 'oauth2',
    docs: 'GitHub',
    tools: [
      { name: 'list_issues', write: false },
      { name: 'create_issue', write: true },
    ],
  },
  'generic-http': {
    name: 'generic-http',
    auth: 'api_key',
    docs: 'Arbitrary HTTP endpoint (ActionPack)',
    tools: [
      { name: 'request', write: true, description: 'HTTP request; GET is treated as read if method=GET' },
    ],
  },
  'generic-mcp': {
    name: 'generic-mcp',
    auth: 'mcp',
    docs: 'MCP server tools',
    tools: [
      { name: 'call', write: true, description: 'Call a registered MCP tool' },
    ],
  },
};

function listKinds() {
  return Object.values(KINDS);
}

function getKind(name) {
  const k = KINDS[String(name || '').trim()];
  if (!k) {
    const e = new Error(`unknown connector kind: ${name}`);
    e.status = 400;
    throw e;
  }
  return k;
}

module.exports = { KINDS, listKinds, getKind };
