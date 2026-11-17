'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { buildState } = require('../lib/state.js');
const { readOpencode } = require('../lib/opencode.js');
const { readClaude } = require('../lib/claude.js');

const REVIEW_DIR = path.join(os.homedir(), '.agentwatch');
const REVIEW_FILE = path.join(REVIEW_DIR, 'review.json');
const ROSTER_PATH = path.join(__dirname, '..', 'config', 'roster.json');
const DEFAULT_BY = 'claude-opus-5-5';

function opencodeDbPath() {
  return process.env.OPENCODE_DB || path.join(os.homedir(), '.local', 'share', 'opencode', 'opencode.db');
}

function claudeRoot() {
  return process.env.CLAUDE_PROJECTS_DIR || path.join(os.homedir(), '.claude', 'projects');
}

function readRoster() {
  try {
    return JSON.parse(fs.readFileSync(ROSTER_PATH, 'utf8'));
  } catch (_) {
    return { roles: {}, agents: [] };
  }
}

function readReview() {
  try {
    const r = JSON.parse(fs.readFileSync(REVIEW_FILE, 'utf8'));
    return r && typeof r === 'object' ? r : null;
  } catch (_) {
    return null;
  }
}

function defaultReviewer() {
  const { agents } = readClaude(claudeRoot(), Date.now());
  let best = null;
  for (const a of agents) if (!best || a.lastActive > best.lastActive) best = a;
  return best ? best.id : DEFAULT_BY;
}

function writeReview(obj) {
  fs.mkdirSync(REVIEW_DIR, { recursive: true });
  fs.writeFileSync(REVIEW_FILE, JSON.stringify(obj));
}

function clearReview() {
  try { fs.unlinkSync(REVIEW_FILE); } catch (_) { /* ignore */ }
}

function status() {
  const now = Date.now();
  const state = buildState({
    now,
    roster: readRoster(),
    opencode: readOpencode(opencodeDbPath(), now),
    claude: readClaude(claudeRoot(), now),
    review: readReview(),
  });
  for (const a of state.agents) {
    console.log(a.id + '\\t' + a.state + '\\t' + a.usage.total);
  }
  // Quota lines per provider.
  const providers = new Set();
  for (const a of state.agents) {
    providers.add(a.group === 'opencode' ? String(a.id).split('/')[0] : 'claude');
  }
  const qmap = new Map((state.quota || []).map((q) => [q.id, q]));
  for (const p of providers) {
    const q = qmap.get(p);
    if (q && q.blocked) {
      const until = new Date(q.resetAt);
      const hh = String(until.getHours()).padStart(2, '0');
      const mm = String(until.getMinutes()).padStart(2, '0');
      const remaining = Math.max(0, q.resetAt - now);
      const mins = Math.round(remaining / 60000);
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      const dur = h > 0 ? (h + 'h ' + m + 'm') : (m + 'm');
      console.log(p + '  BLOCKED until ' + hh + ':' + mm + ' (' + dur + ')');
    } else {
      console.log(p + '  ok');
    }
  }
}

function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (cmd === 'review' && args.includes('--done')) {
    clearReview();
    console.log('review cleared');
    return;
  }

  if (cmd === 'review') {
    const target = args[1];
    if (!target) {
      console.error('usage: aw.js review <targetAgentId> [note...] [--by <claudeAgentId>]');
      process.exit(1);
    }
    let by = null;
    const noteParts = [];
    for (let i = 2; i < args.length; i++) {
      if (args[i] === '--by') { by = args[i + 1]; i += 1; }
      else noteParts.push(args[i]);
    }
    const obj = { by: by || defaultReviewer(), target, note: noteParts.join(' '), since: Date.now() };
    writeReview(obj);
    console.log('review set: ' + obj.by + ' -> ' + obj.target);
    return;
  }

  if (cmd === 'status') {
    status();
    return;
  }

  console.error('usage: aw.js review <target> [note...] [--by <agent>] | review --done | status');
  process.exit(1);
}

main();
