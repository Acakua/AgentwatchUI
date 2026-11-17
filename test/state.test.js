'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { buildState } = require('../lib/state.js');

const roster = {
  roles: { coder: 'Coder', guest: 'Khách' },
  agents: [
    { id: 'byteplus/op-a', group: 'opencode', name: 'A', role: 'coder', color: '#111111' },
    { id: 'claude-c', group: 'claude', name: 'C', role: 'coder', color: '#222222' },
  ],
};

const NOW = 1794880000000;

function opencodeAgent(id, { lastActive = 0, incompleteUpdated = 0 } = {}) {
  return { id, group: 'opencode', lastActive, incompleteUpdated, activeSessions: 0, task: '', tool: '' };
}

function claudeAgent(id, lastActive) {
  return { id, group: 'claude', lastActive, incompleteUpdated: 0, activeSessions: 0, task: '', tool: '' };
}

test('opencode working/idle thresholds', () => {
  const state = buildState({
    now: NOW,
    roster,
    opencode: { agents: [opencodeAgent('byteplus/op-a', { lastActive: NOW - 10000 })], events: [] },
    claude: { agents: [], events: [] },
    review: null,
  });
  assert.strictEqual(state.agents[0].state, 'working');

  const idle = buildState({
    now: NOW,
    roster,
    opencode: { agents: [opencodeAgent('byteplus/op-a', { lastActive: NOW - 60000 })], events: [] },
    claude: { agents: [], events: [] },
    review: null,
  });
  assert.strictEqual(idle.agents[0].state, 'idle');

  const incomplete = buildState({
    now: NOW,
    roster,
    opencode: { agents: [opencodeAgent('byteplus/op-a', { lastActive: 0, incompleteUpdated: NOW - 60000 })], events: [] },
    claude: { agents: [], events: [] },
    review: null,
  });
  assert.strictEqual(incomplete.agents[0].state, 'working');
});

test('claude working/idle thresholds', () => {
  const working = buildState({
    now: NOW,
    roster,
    opencode: { agents: [], events: [] },
    claude: { agents: [claudeAgent('claude-c', NOW - 80000)], events: [] },
    review: null,
  });
  assert.strictEqual(working.agents[1].state, 'working');

  const idle = buildState({
    now: NOW,
    roster,
    opencode: { agents: [], events: [] },
    claude: { agents: [claudeAgent('claude-c', NOW - 100000)], events: [] },
    review: null,
  });
  assert.strictEqual(idle.agents[1].state, 'idle');
});

test('review flag overrides working and clears when expired', () => {
  const active = buildState({
    now: NOW,
    roster,
    opencode: { agents: [], events: [] },
    claude: { agents: [claudeAgent('claude-c', NOW - 1000)], events: [] },
    review: { by: 'claude-c', target: 'byteplus/op-a', note: 'check', since: NOW - 1000 },
  });
  assert.strictEqual(active.review.by, 'claude-c');
  assert.strictEqual(active.agents.find((a) => a.id === 'claude-c').state, 'reviewing');

  const expired = buildState({
    now: NOW,
    roster,
    opencode: { agents: [], events: [] },
    claude: { agents: [claudeAgent('claude-c', NOW - 1000)], events: [] },
    review: { by: 'claude-c', target: 'byteplus/op-a', note: 'check', since: NOW - 16 * 60 * 1000 },
  });
  assert.strictEqual(expired.review, null);
  assert.strictEqual(expired.agents.find((a) => a.id === 'claude-c').state, 'working');
});

test('unknown model appended as guest', () => {
  const state = buildState({
    now: NOW,
    roster,
    opencode: { agents: [opencodeAgent('byteplus/guest-model', { lastActive: NOW - 3600000 }), opencodeAgent('byteplus/old-guest', { lastActive: NOW - 3 * 24 * 3600000 })], events: [] },
    claude: { agents: [], events: [] },
    review: null,
  });
  const guest = state.agents.find((a) => a.id === 'byteplus/guest-model');
  assert.ok(guest);
  assert.strictEqual(guest.role, 'guest');
  assert.strictEqual(guest.name, 'guest-model');
  assert.strictEqual(guest.color, '#9aa0a6');
  // Guests silent for more than 24 h are left out.
  assert.strictEqual(state.agents.find((a) => a.id === 'byteplus/old-guest'), undefined);
});

test('missing data gives idle agents with zero usage', () => {
  const state = buildState({
    now: NOW,
    roster,
    opencode: { agents: [], events: [] },
    claude: { agents: [], events: [] },
    review: null,
  });
  assert.strictEqual(state.agents.length, 2);
  for (const a of state.agents) {
    assert.strictEqual(a.state, 'idle');
    assert.strictEqual(a.usage.total, 0);
    assert.strictEqual(a.usage.messages, 0);
  }
});
