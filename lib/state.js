'use strict';

const ACTIVE_WINDOW_MS = 25 * 1000;
const INCOMPLETE_WINDOW_MS = 10 * 60 * 1000;
const CLAUDE_ACTIVE_MS = 90 * 1000;
const REVIEW_TTL_MS = 15 * 60 * 1000;
const MAX_EVENTS = 30;

function zeroUsage() {
  return {
    sessions: 0,
    messages: 0,
    input: 0,
    output: 0,
    reasoning: 0,
    cacheRead: 0,
    cacheWrite: 0,
    total: 0,
    cost: 0,
  };
}

function usageShape({ sessions, messages, input, output, reasoning, cacheRead, cacheWrite, cost }) {
  const s = sessions || 0;
  const m = messages || 0;
  const i = input || 0;
  const o = output || 0;
  const r = reasoning || 0;
  const cr = cacheRead || 0;
  const cw = cacheWrite || 0;
  const c = cost || 0;
  return {
    sessions: s,
    messages: m,
    input: i,
    output: o,
    reasoning: r,
    cacheRead: cr,
    cacheWrite: cw,
    total: i + o + r + cr + cw,
    cost: c,
  };
}

function addUsage(a, b) {
  return usageShape({
    sessions: a.sessions + b.sessions,
    messages: a.messages + b.messages,
    input: a.input + b.input,
    output: a.output + b.output,
    reasoning: a.reasoning + b.reasoning,
    cacheRead: a.cacheRead + b.cacheRead,
    cacheWrite: a.cacheWrite + b.cacheWrite,
    cost: a.cost + b.cost,
  });
}

function localMidnight(now) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function guestName(id) {
  const i = id.lastIndexOf('/');
  return i === -1 ? id : id.slice(i + 1);
}

const FIVE_H_MS = 5 * 3600 * 1000;

function collectLimits(obj) {
  if (!obj || typeof obj !== 'object') return [];
  const keys = ['limits', 'limitEvents', 'quotaEvents', 'quota', 'limit', 'limit_events', 'quota_events'];
  const out = [];
  for (const k of keys) {
    const v = obj[k];
    if (Array.isArray(v)) out.push(...v);
  }
  return out;
}

function normLimit(e) {
  if (!e || typeof e !== 'object') return null;
  const id = e.id || e.provider || e.providerID || e.providerKey;
  if (!id) return null;
  const group = e.group || (String(id) === 'claude' ? 'claude' : 'opencode');
  const hitAt = Number(e.hitAt != null ? e.hitAt : (e.hit_at != null ? e.hit_at : (e.time != null ? e.time : (e.timestamp != null ? e.timestamp : 0))));
  const resetAt = Number(e.resetAt != null ? e.resetAt : (e.reset_at != null ? e.reset_at : 0));
  const text = (e.text != null ? e.text : (e.message != null ? e.message : '')).toString().slice(0, 60);
  if (!Number.isFinite(hitAt) || !Number.isFinite(resetAt)) return null;
  return { id: String(id), group, hitAt, resetAt, text };
}

function buildState({ now, roster, opencode, claude, review }) {
  const roles = (roster && roster.roles) || {};
  const rosterAgents = (roster && roster.agents) || [];

  const source = new Map();
  for (const a of (opencode && opencode.agents) || []) source.set(a.id, a);
  for (const a of (claude && claude.agents) || []) source.set(a.id, a);

  function computeState(group, lastActive, incompleteUpdated) {
    if (group === 'opencode') {
      if ((lastActive > 0 && now - lastActive <= ACTIVE_WINDOW_MS) ||
          (incompleteUpdated > 0 && now - incompleteUpdated <= INCOMPLETE_WINDOW_MS)) {
        return 'working';
      }
    } else if (group === 'claude') {
      if (lastActive > 0 && now - lastActive <= CLAUDE_ACTIVE_MS) return 'working';
    }
    return 'idle';
  }

  function makeAgent(base, src) {
    const lastActive = src ? (src.lastActive || 0) : 0;
    const incompleteUpdated = src ? (src.incompleteUpdated || 0) : 0;
    const state = computeState(base.group, lastActive, incompleteUpdated);
    const busy = state !== 'idle';
    return {
      id: base.id,
      group: base.group,
      name: base.name,
      role: base.role,
      roleLabel: base.roleLabel,
      color: base.color,
      state,
      task: busy && src ? (src.task || '') : '',
      tool: busy && src ? (src.tool || '') : '',
      activeSessions: src ? (src.activeSessions || 0) : 0,
      lastActive,
      usage: src ? (src.usage || zeroUsage()) : zeroUsage(),
      usageToday: src ? (src.usageToday || zeroUsage()) : zeroUsage(),
    };
  }

  const agents = [];
  const rosterIds = new Set();
  for (const ra of rosterAgents) {
    rosterIds.add(ra.id);
    agents.push(makeAgent({
      id: ra.id,
      group: ra.group,
      name: ra.name,
      role: ra.role,
      roleLabel: roles[ra.role] || ra.role,
      color: ra.color,
    }, source.get(ra.id)));
  }

  for (const a of source.values()) {
    if (rosterIds.has(a.id)) continue;
    // Guests appear only if they did something in the last 24 h.
    if (!(a.lastActive > 0 && now - a.lastActive <= 24 * 3600 * 1000)) continue;
    agents.push(makeAgent({
      id: a.id,
      group: a.group,
      name: guestName(a.id),
      role: 'guest',
      roleLabel: roles.guest || 'Khách',
      color: '#9aa0a6',
    }, a));
  }

  const knownIds = new Set(agents.map((a) => a.id));

  let validReview = null;
  if (review && review.by && review.target && typeof review.since === 'number') {
    if (now - review.since <= REVIEW_TTL_MS && knownIds.has(review.target)) {
      validReview = {
        by: review.by,
        target: review.target,
        note: review.note || '',
        since: review.since,
      };
      for (const a of agents) if (a.id === validReview.by) a.state = 'reviewing';
    }
  }

  const totals = {
    opencode: { all: zeroUsage(), today: zeroUsage() },
    claude: { all: zeroUsage(), today: zeroUsage() },
  };
  for (const a of agents) {
    const t = totals[a.group];
    if (!t) continue;
    t.all = addUsage(t.all, a.usage);
    t.today = addUsage(t.today, a.usageToday);
  }

  const events = [];
  for (const ev of (opencode && opencode.events) || []) events.push(ev);
  for (const ev of (claude && claude.events) || []) events.push(ev);
  events.sort((a, b) => (b.t || 0) - (a.t || 0));

  // Provider last successful activity (max agent lastActive per provider).
  const providerLastActive = new Map();
  for (const a of agents) {
    const pid = a.group === 'opencode' ? String(a.id).split('/')[0] : 'claude';
    const prev = providerLastActive.get(pid) || 0;
    if ((a.lastActive || 0) > prev) providerLastActive.set(pid, a.lastActive || 0);
  }

  const rawLimits = [];
  rawLimits.push(...collectLimits(opencode));
  rawLimits.push(...collectLimits(claude));

  const byProvider = new Map();
  for (const r of rawLimits) {
    const e = normLimit(r);
    if (!e) continue;
    const key = e.id + '|' + e.group;
    const prev = byProvider.get(key);
    if (!prev || e.hitAt > prev.hitAt) byProvider.set(key, e);
  }

  const quota = [];
  for (const e of byProvider.values()) {
    let timeBlocked;
    if (e.resetAt > 0) timeBlocked = now < e.resetAt;
    else timeBlocked = (now - e.hitAt) < FIVE_H_MS;
    const newer = (providerLastActive.get(e.id) || 0) > e.hitAt;
    const blocked = timeBlocked && !newer;
    quota.push({
      id: e.id,
      group: e.group,
      label: (roster && roster.providers && roster.providers[e.id]) || (e.group === 'claude' ? 'Claude Code' : e.id),
      hitAt: e.hitAt,
      resetAt: e.resetAt,
      blocked,
      text: e.text,
    });
  }
  quota.sort((a, b) => (b.hitAt || 0) - (a.hitAt || 0));

  const blockedUntilByProvider = new Map();
  for (const q of quota) {
    blockedUntilByProvider.set(q.id, q.blocked ? q.resetAt : 0);
  }
  for (const a of agents) {
    const pid = a.group === 'opencode' ? String(a.id).split('/')[0] : 'claude';
    a.blockedUntil = blockedUntilByProvider.get(pid) || 0;
  }

  return {
    now,
    agents,
    review: validReview,
    totals,
    events: events.slice(0, MAX_EVENTS),
    quota,
  };
}

module.exports = {
  buildState,
  zeroUsage,
  usageShape,
  addUsage,
  localMidnight,
  ACTIVE_WINDOW_MS,
  INCOMPLETE_WINDOW_MS,
  CLAUDE_ACTIVE_MS,
  REVIEW_TTL_MS,
  MAX_EVENTS,
};
