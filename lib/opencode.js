'use strict';

const _emitWarning = process.emitWarning;
process.emitWarning = function (warning, ...rest) {
  const arg = rest[0];
  if (arg === 'ExperimentalWarning' || (arg && arg.type === 'ExperimentalWarning')) return;
  return _emitWarning.call(process, warning, ...rest);
};

const { DatabaseSync } = require('node:sqlite');
const { localMidnight, ACTIVE_WINDOW_MS, usageShape } = require('./state.js');

const MAX_TEXT = 60;

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function addTok(dst, src) {
  dst.input += num(src.input);
  dst.output += num(src.output);
  dst.reasoning += num(src.reasoning);
  dst.cacheRead += num(src.cacheRead);
  dst.cacheWrite += num(src.cacheWrite);
  dst.cost += num(src.cost);
}

function empty() {
  return { agents: [], events: [] };
}

function readOpencode(dbPath, now) {
  if (!dbPath) return empty();
  let db;
  try {
    db = new DatabaseSync(dbPath, { readOnly: true });
  } catch (err) {
    console.error('opencode: ' + err.message);
    return empty();
  }
  try {
    return read(db, now);
  } catch (err) {
    console.error('opencode: ' + err.message);
    return empty();
  } finally {
    try { db.close(); } catch (_) { /* ignore */ }
  }
}

function read(db, now) {
  const midnight = localMidnight(now);
  const models = new Map();
  const titles = new Map();

  function agg(key) {
    let a = models.get(key);
    if (!a) {
      a = {
        id: key,
        group: 'opencode',
        sessions: new Set(),
        messages: 0,
        tokens: { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0, cost: 0 },
        todaySessions: new Set(),
        todayMessages: 0,
        tokensToday: { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0, cost: 0 },
        incompleteUpdated: 0,
        sessionTimes: new Map(),
        toolParts: new Map(),
      };
      models.set(key, a);
    }
    return a;
  }

  function touch(a, sid, ts) {
    a.sessionTimes.set(sid, Math.max(a.sessionTimes.get(sid) || 0, ts));
  }

  for (const s of db.prepare('SELECT id, title FROM session').all()) {
    titles.set(s.id, s.title || '');
  }

  const messageModel = new Map();
  const msgRows = db.prepare('SELECT id, session_id, time_created, time_updated, data FROM message').all();
  for (const m of msgRows) {
    let d;
    try { d = JSON.parse(m.data); } catch (_) { continue; }
    if (d.role !== 'assistant') continue;
    const modelID = d.modelID;
    if (!modelID) continue;
    const key = (d.providerID ? d.providerID + '/' : '') + modelID;
    messageModel.set(m.id, key);
    const a = agg(key);
    a.messages += 1;
    a.sessions.add(m.session_id);
    const t = d.tokens || {};
    const cache = t.cache || {};
    const tok = {
      input: num(t.input),
      output: num(t.output),
      reasoning: num(t.reasoning),
      cacheRead: num(cache.read),
      cacheWrite: num(cache.write),
      cost: typeof d.cost === 'number' ? d.cost : 0,
    };
    addTok(a.tokens, tok);
    const created = (d.time && d.time.created) || m.time_created || 0;
    if (created >= midnight) {
      addTok(a.tokensToday, tok);
      a.todaySessions.add(m.session_id);
      a.todayMessages += 1;
    }
    const ts = m.time_updated || 0;
    touch(a, m.session_id, ts);
    if (d.time && d.time.completed == null && ts > a.incompleteUpdated) {
      a.incompleteUpdated = ts;
    }
  }

  // Only recent tool parts, and only the small fields: tool outputs can be huge
  // and this runs every second.
  const recentParts = [];
  const partRows = db.prepare(
    "SELECT session_id, message_id, time_updated, json_extract(data,'$.tool') AS tool, " +
    "COALESCE(json_extract(data,'$.state.input.filePath'), json_extract(data,'$.state.input.command'), json_extract(data,'$.state.input.pattern'), '') AS hint " +
    "FROM part WHERE time_updated > ? AND json_extract(data,'$.type') = 'tool' ORDER BY time_updated"
  ).all(now - 24 * 3600 * 1000);
  for (const p of partRows) {
    const key = messageModel.get(p.message_id);
    if (!key) continue;
    const a = agg(key);
    const ts = p.time_updated || 0;
    touch(a, p.session_id, ts);
    const hint = String(p.hint || '').replace(/\s+/g, ' ');
    const text = (p.tool ? p.tool + (hint ? ' ' + hint : '') : hint).slice(0, MAX_TEXT);
    const entry = { tool: p.tool || '', text, t: ts };
    a.toolParts.set(p.session_id, entry);
    recentParts.push({ t: ts, agent: key, text });
  }

  const agents = [];
  const events = [];
  for (const a of models.values()) {
    let lastActive = 0;
    const activeSids = new Set();
    let activeMax = -1;
    let activeSid = null;
    for (const [sid, t] of a.sessionTimes) {
      if (t > lastActive) lastActive = t;
      if (now - t <= ACTIVE_WINDOW_MS) {
        activeSids.add(sid);
        if (t > activeMax) { activeMax = t; activeSid = sid; }
      }
    }
    let task = '';
    let tool = '';
    // No session inside the short window (model is thinking): use the newest one.
    if (!activeSid) for (const [sid, t] of a.sessionTimes) if (t > activeMax) { activeMax = t; activeSid = sid; }
    if (activeSid) {
      task = titles.get(activeSid) || '';
      const tp = a.toolParts.get(activeSid);
      if (tp) tool = tp.tool;
    }
    agents.push({
      id: a.id,
      group: 'opencode',
      lastActive,
      activeSessions: activeSids.size,
      incompleteUpdated: a.incompleteUpdated,
      task,
      tool,
      usage: usageShape({ sessions: a.sessions.size, messages: a.messages, ...a.tokens }),
      usageToday: usageShape({ sessions: a.todaySessions.size, messages: a.todayMessages, ...a.tokensToday }),
    });
  }

  for (const ev of recentParts.slice(-40)) events.push(ev);
  return { agents, events };
}

module.exports = { readOpencode };
