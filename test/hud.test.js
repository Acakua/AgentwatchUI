'use strict';

const test = require('node:test');
const assert = require('node:assert');

test('hud module imports under Node without touching the DOM', async () => {
  const hud = await import('../public/js/hud.js');
  assert.ok(hud && typeof hud.initHud === 'function');
  assert.ok(typeof hud.update === 'function');
  assert.ok(typeof hud.formatClock === 'function');
  assert.ok(typeof hud.formatRemaining === 'function');
});

test('formatRemaining', async () => {
  const { formatRemaining } = await import('../public/js/hud.js');
  assert.strictEqual(formatRemaining(0), '0p');
  assert.strictEqual(formatRemaining(59999), '<1p');
  assert.strictEqual(formatRemaining(60000), '1p');
  assert.strictEqual(formatRemaining(8100000), '2g 15p');
  assert.strictEqual(formatRemaining(-1), '0p');
});

test('formatClock for a fixed local time', async () => {
  const { formatClock } = await import('../public/js/hud.js');
  const d = new Date(2026, 10, 17, 14, 37, 0);
  assert.strictEqual(formatClock(d.getTime()), '14:37');
});
