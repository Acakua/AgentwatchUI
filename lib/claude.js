'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { localMidnight, CLAUDE_ACTIVE_MS, usageShape } = require('./state.js');

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_AGE_MS = 30 * DAY_MS;

const cache = new Map();

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

function zero() {
  return { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0, cost: 0 };
}

function lastToolName(content) {
  if (!Array.isArray(content)) return '';
  let name = '';
  for (const c of content) if (c && c.type === 'tool_use' && c.name) name = c.name;
  return name;
}

function parseTranscriptChunk(text, acc) {
  if (!acc.entries) acc.entries = new Map();
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let obj;
    try { obj = JSON.parse(line); } catch (_) { continue; }
    if (obj.type !== 'assistant') continue;
    const m = obj.message;
    if (!m || !m.id) continue;
    const model = m.model;
    if (!model || model === '<synthetic>') continue;
    const u = m.usage || {};
    acc.entries.set(m.id, {
      model,
      input: num(u.input_tokens),
      output: num(u.output_tokens),
      cacheRead: num(u.cache_read_input_tokens),
      cacheWrite: num(u.cache_creation_input_tokens),
      ts: obj.timestamp ? Date.parse(obj.timestamp) : 0,
      tool: lastToolName(m.content),
    });
  }
  return acc;
}

function listJsonl(rootDir) {
  const out = [];
  if (!rootDir || !fs.existsSync(rootDir)) return out;
  const walk = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && p.endsWith('.jsonl')) out.push(p);
    }
  };
  walk(rootDir);
  return out;
}

function measureConsumed(text) {
  const idx = text.lastIndexOf('\n');
  if (idx === -1) return 0;
  return Buffer.byteLength(text.slice(0, idx + 1), 'utf8');
}

function readFull(file) {
  return fs.readFileSync(file, 'utf8');
}

function readAppended(file, offset) {
  const fd = fs.openSync(file, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    if (size <= offset) return '';
    const buf = Buffer.alloc(size - offset);
    fs.readSync(fd, buf, 0, size - offset, offset);
    return buf.toString('utf8');
  } finally {
    fs.closeSync(fd);
  }
}

function readClaude(rootDir, now) {
  const midnight = localMidnight(now);
  const files = listJsonl(rootDir);
  const perModel = new Map();
  const ownerActivity = new Map();

  function pModel(model) {
    let p = perModel.get(model);
    if (!p) {
      p = {
        sessions: new Set(),
        ids: new Set(),
        tokens: zero(),
        tokensToday: zero(),
        todaySessions: new Set(),
        todayIds: new Set(),
        newestTs: -1,
        newestTool: '',
        newestFile: '',
      };
      perModel.set(model, p);
    }
    return p;
  }

  for (const file of files) {
    let st;
    try { st = fs.statSync(file); } catch (_) { continue; }
    const mtimeMs = Math.floor(st.mtimeMs) || 0;
    const size = st.size;
    if (now - mtimeMs > MAX_AGE_MS) continue;

    const cached = cache.get(file);
    let entries;
    if (cached && cached.mtimeMs === mtimeMs && cached.size === size) {
      entries = cached.entries;
    } else {
      entries = new Map();
      let offset = 0;
      if (cached && cached.size > 0 && cached.size <= size && cached.offset <= size) {
        offset = cached.offset;
        entries = cached.entries;
        const text = readAppended(file, offset);
        offset += measureConsumed(text);
        parseTranscriptChunk(text, { entries });
      } else {
        const text = readFull(file);
        offset = measureConsumed(text);
        parseTranscriptChunk(text, { entries });
      }
      cache.set(file, { mtimeMs, size, offset, entries });
    }

    let owner = null;
    let ownerTs = -1;
    for (const [id, e] of entries) {
      if (e.ts > ownerTs) { ownerTs = e.ts; owner = e.model; }
      const p = pModel(e.model);
      p.sessions.add(file);
      p.ids.add(id);
      addTok(p.tokens, e);
      if (e.ts >= midnight) {
        p.todaySessions.add(file);
        p.todayIds.add(id);
        addTok(p.tokensToday, e);
      }
      if (e.ts > p.newestTs) { p.newestTs = e.ts; p.newestTool = e.tool; p.newestFile = file; }
    }
    if (owner) {
      const oa = ownerActivity.get(owner) || { maxMtime: 0, active: 0 };
      if (mtimeMs > oa.maxMtime) oa.maxMtime = mtimeMs;
      if (now - mtimeMs <= CLAUDE_ACTIVE_MS) oa.active += 1;
      ownerActivity.set(owner, oa);
    }
  }

  const agents = [];
  for (const [model, p] of perModel) {
    const oa = ownerActivity.get(model);
    agents.push({
      id: model,
      group: 'claude',
      lastActive: oa ? oa.maxMtime : 0,
      activeSessions: oa ? oa.active : 0,
      incompleteUpdated: 0,
      task: p.newestFile ? path.basename(path.dirname(p.newestFile)) : '',
      tool: p.newestTool || '',
      usage: usageShape({ sessions: p.sessions.size, messages: p.ids.size, ...p.tokens }),
      usageToday: usageShape({ sessions: p.todaySessions.size, messages: p.todayIds.size, ...p.tokensToday }),
    });
  }

  return { agents, events: [] };
}

function resetCache() {
  cache.clear();
}

module.exports = { readClaude, parseTranscriptChunk, resetCache };
