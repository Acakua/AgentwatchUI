'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { readClaude, parseTranscriptChunk, resetCache } = require('../lib/claude.js');
const { localMidnight } = require('../lib/state.js');

test('parseTranscriptChunk deduplicates by message.id, last line wins', () => {
  const line = (id, tool) => JSON.stringify({
    type: 'assistant',
    timestamp: '2026-11-17T02:00:00.000Z',
    message: {
      id,
      model: 'claude-opus-5-5',
      usage: { input_tokens: 2, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
      content: tool ? [{ type: 'tool_use', name: tool }] : [{ type: 'text', text: 'x' }],
    },
  });
  const acc = parseTranscriptChunk(line('msg_1', 'Read') + '\n' + line('msg_1', 'Bash') + '\n', {});
  assert.strictEqual(acc.entries.size, 1);
  assert.strictEqual(acc.entries.get('msg_1').tool, 'Bash');
});

test('parseTranscriptChunk skips truncated JSON and synthetic/missing models', () => {
  const text = [
    '{"type":"assistant","message":{"id":"msg_2","model":"claude-opus-5-5","usage":{"input_tokens":1', // truncated
    JSON.stringify({ type: 'assistant', timestamp: '2026-11-17T02:00:00.000Z', message: { id: 'msg_3', model: '<synthetic>', usage: { input_tokens: 1 } } }),
    JSON.stringify({ type: 'assistant', timestamp: '2026-11-17T02:00:00.000Z', message: { id: 'msg_4', usage: { input_tokens: 1 } } }),
    JSON.stringify({ type: 'user', timestamp: '2026-11-17T02:00:00.000Z', message: { id: 'msg_5', model: 'claude-opus-5-5', usage: { input_tokens: 1 } } }),
  ].join('\n') + '\n';
  const acc = parseTranscriptChunk(text, {});
  assert.strictEqual(acc.entries.size, 0);
});

test('readClaude sums usage per model, splits today, sets tool and task', () => {
  resetCache();
  const now = 1794880000000;
  const mid = localMidnight(now);
  const line = (id, model, ts, tokens, tool) => JSON.stringify({
    type: 'assistant',
    timestamp: new Date(ts).toISOString(),
    message: {
      id,
      model,
      usage: tokens,
      content: tool ? [{ type: 'tool_use', name: tool }] : [{ type: 'text', text: 'x' }],
    },
  });

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aw-claude-'));
  const proj = path.join(dir, 'MyProject');
  const file = path.join(proj, 'session.jsonl');
  fs.mkdirSync(proj, { recursive: true });
  fs.writeFileSync(file, [
    line('m_before', 'claude-opus-5-5', mid - 3600000, { input_tokens: 100, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }),
    line('m_after', 'claude-opus-5-5', mid + 3600000, { input_tokens: 20, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, 'Bash'),
  ].join('\n') + '\n');
  fs.utimesSync(file, now / 1000, now / 1000);

  const { agents } = readClaude(dir, now);
  const opus = agents.find((a) => a.id === 'claude-opus-5-5');
  assert.ok(opus);
  assert.strictEqual(opus.usage.input, 120);
  assert.strictEqual(opus.usage.output, 15);
  assert.strictEqual(opus.usage.messages, 2);
  assert.strictEqual(opus.usage.sessions, 1);
  assert.strictEqual(opus.usageToday.input, 20);
  assert.strictEqual(opus.usageToday.output, 5);
  assert.strictEqual(opus.usageToday.messages, 1);
  assert.strictEqual(opus.tool, 'Bash');
  assert.strictEqual(opus.task, 'MyProject');

  fs.rmSync(dir, { recursive: true, force: true });
});
