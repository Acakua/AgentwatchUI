'use strict';

require('../lib/opencode.js'); // installs sqlite ExperimentalWarning suppression

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { DatabaseSync } = require('node:sqlite');

const { readOpencode } = require('../lib/opencode.js');
const { localMidnight } = require('../lib/state.js');

function createDb() {
  const file = path.join(os.tmpdir(), 'aw-opencode-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.db');
  const db = new DatabaseSync(file);
  db.exec('CREATE TABLE session (id TEXT, title TEXT)');
  db.exec('CREATE TABLE message (id TEXT, session_id TEXT, time_created INTEGER, time_updated INTEGER, data TEXT)');
  db.exec('CREATE TABLE part (session_id TEXT, message_id TEXT, time_updated INTEGER, data TEXT)');
  return { file, db };
}

function assistantData({ modelID, providerID, input, output, reasoning, cacheRead, cacheWrite, cost, created, completed }) {
  const d = {
    role: 'assistant',
    providerID,
    modelID,
    cost: cost || 0,
    tokens: { input, output, reasoning, cache: { read: cacheRead, write: cacheWrite } },
    time: { created },
  };
  if (completed != null) d.time.completed = completed;
  return JSON.stringify(d);
}

test('readOpencode sums usage per model and splits today', () => {
  const { file, db } = createDb();
  const now = 1794880000000;
  const mid = localMidnight(now);

  db.prepare('INSERT INTO session (id, title) VALUES (?, ?)').run('ses_a', 'Session A');
  db.prepare('INSERT INTO session (id, title) VALUES (?, ?)').run('ses_b', 'Session B');

  db.prepare('INSERT INTO message (id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?)')
    .run('m1', 'ses_a', mid - 1000, mid - 1000, assistantData({ modelID: 'foo', providerID: 'byteplus', input: 100, output: 10, reasoning: 1, cacheRead: 2, cacheWrite: 3, cost: 0, created: mid - 1000, completed: mid - 1000 }));
  db.prepare('INSERT INTO message (id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?)')
    .run('m2', 'ses_a', mid + 1000, mid + 1000, assistantData({ modelID: 'foo', providerID: 'byteplus', input: 20, output: 5, reasoning: 0, cacheRead: 0, cacheWrite: 0, cost: 0, created: mid + 1000, completed: mid + 1000 }));
  db.prepare('INSERT INTO message (id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?)')
    .run('m3', 'ses_b', mid + 1000, mid + 1000, assistantData({ modelID: 'bar', providerID: 'byteplus', input: 50, output: 1, reasoning: 0, cacheRead: 0, cacheWrite: 0, cost: 0, created: mid + 1000, completed: mid + 1000 }));

  const { agents } = readOpencode(file, now);
  const foo = agents.find((a) => a.id === 'byteplus/foo');
  const bar = agents.find((a) => a.id === 'byteplus/bar');

  assert.ok(foo);
  assert.strictEqual(foo.usage.input, 120);
  assert.strictEqual(foo.usage.output, 15);
  assert.strictEqual(foo.usage.cacheRead, 2);
  assert.strictEqual(foo.usage.cacheWrite, 3);
  assert.strictEqual(foo.usage.messages, 2);
  assert.strictEqual(foo.usage.sessions, 1);
  assert.strictEqual(foo.usageToday.input, 20);
  assert.strictEqual(foo.usageToday.messages, 1);

  assert.ok(bar);
  assert.strictEqual(bar.usage.input, 50);
  assert.strictEqual(bar.usageToday.input, 50);

  db.close();
  fs.rmSync(file, { force: true });
});

test('readOpencode marks active session, tool, events and incomplete', () => {
  const { file, db } = createDb();
  const now = 1794880000000;

  db.prepare('INSERT INTO session (id, title) VALUES (?, ?)').run('ses_a', 'Active Task');

  db.prepare('INSERT INTO message (id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?)')
    .run('m1', 'ses_a', now - 1000, now - 500, assistantData({ modelID: 'foo', providerID: 'byteplus', input: 1, output: 1, reasoning: 0, cacheRead: 0, cacheWrite: 0, cost: 0, created: now - 1000, completed: null }));

  db.prepare('INSERT INTO part (session_id, message_id, time_updated, data) VALUES (?, ?, ?, ?)')
    .run('ses_a', 'm1', now - 400, JSON.stringify({ type: 'tool', tool: 'edit', state: { status: 'completed', input: { filePath: 'src/a.js' } } }));

  const { agents, events } = readOpencode(file, now);
  const foo = agents.find((a) => a.id === 'byteplus/foo');
  assert.ok(foo);
  assert.strictEqual(foo.activeSessions, 1);
  assert.strictEqual(foo.task, 'Active Task');
  assert.strictEqual(foo.tool, 'edit');
  assert.ok(foo.incompleteUpdated > 0);
  assert.ok(events.some((e) => e.agent === 'byteplus/foo' && e.text === 'edit src/a.js'));

  db.close();
  fs.rmSync(file, { force: true });
});

test('readOpencode returns empty agents when DB is missing', () => {
  const { agents, events } = readOpencode(path.join(os.tmpdir(), 'does-not-exist-' + Math.random() + '.db'), Date.now());
  assert.deepStrictEqual(agents, []);
  assert.deepStrictEqual(events, []);
});
