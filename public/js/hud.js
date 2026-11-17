// HUD: usage panels, event log and agent detail card.
// DOM is built once in initHud; update() only rewrites text/row HTML so the
// collapsed state and the open detail card survive every 2 s poll.

const STATE_LABEL = {
  working: 'Đang làm',
  idle: 'Chờ',
  reviewing: 'Đang xem',
};

const STATE_CLASS = {
  working: 'is-working',
  idle: 'is-idle',
  reviewing: 'is-reviewing',
};

const EMPTY_USAGE = {
  sessions: 0, messages: 0, input: 0, output: 0, reasoning: 0,
  cacheRead: 0, cacheWrite: 0, total: 0, cost: 0,
};

const SHELL = [
  '<div class="hud-top hud-panel">',
  '<span class="hud-title">AGENTWATCH</span>',
  '<span class="hud-clock" data-slot="clock">--:--:--</span>',
  '<span class="hud-counts" data-slot="counts">Đang làm: 0 · Chờ: 0</span>',
  '</div>',
  '<section class="hud-panel hud-side hud-left" data-panel="opencode">',
  '<header class="hud-head" data-toggle="opencode"><span class="hud-head-title">OPENCODE</span><span class="hud-fold">-</span></header>',
  '<div class="hud-body">',
  '<div class="hud-totals" data-slot="opencode-totals"></div>',
  '<div class="hud-rows" data-slot="opencode-rows"></div>',
  '</div>',
  '</section>',
  '<div class="hud-right-col">',
  '<section class="hud-panel hud-side hud-right" data-panel="claude">',
  '<header class="hud-head" data-toggle="claude"><span class="hud-head-title">CLAUDE CODE</span><span class="hud-fold">-</span></header>',
  '<div class="hud-body">',
  '<div class="hud-totals" data-slot="claude-totals"></div>',
  '<div class="hud-rows" data-slot="claude-rows"></div>',
  '</div>',
  '</section>',
  '<aside class="hud-panel hud-detail" data-panel="detail" hidden>',
  '<header class="hud-head" data-toggle="detail"><span class="hud-head-title">CHI TIẾT</span><span class="hud-fold">-</span></header>',
  '<div class="hud-body" data-slot="detail"></div>',
  '</aside>',
  '</div>',
  '<aside class="hud-panel hud-log" data-panel="events">',
  '<header class="hud-head" data-toggle="events"><span class="hud-head-title">SỰ KIỆN</span><span class="hud-fold">-</span></header>',
  '<div class="hud-body"><ol class="hud-events" data-slot="events"></ol></div>',
  '</aside>',
  '<div class="hud-offline" data-slot="offline" hidden>Mất kết nối máy chủ</div>',
].join('');

let ui = null;
let lastState = null;
let detailId = null;
const collapsed = { opencode: false, claude: false, events: false, detail: false };

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function esc(value) {
  return String(value === null || value === undefined ? '' : value).replace(/[&<>"']/g, (c) => ESC_MAP[c]);
}

function safeColor(value) {
  const color = String(value || '');
  return /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : '#9aa0a6';
}

function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

function hhmmss(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return '--:--:--';
  const d = new Date(n);
  return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
}

export function formatTokens(value) {
  const n = Number(value);
  const v = Number.isFinite(n) ? Math.abs(n) : 0;
  const sign = Number.isFinite(n) && n < 0 ? '-' : '';
  if (v < 1000) return sign + String(Math.round(v));

  const units = [
    { div: 1e12, suffix: 'T' },
    { div: 1e9, suffix: 'B' },
    { div: 1e6, suffix: 'M' },
    { div: 1e3, suffix: 'K' },
  ];
  let index = units.findIndex((u) => v >= u.div);
  if (index === -1) index = units.length - 1;

  const compact = (scaled) => {
    const decimals = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
    return Number(scaled.toFixed(decimals));
  };

  let scaled = compact(v / units[index].div);
  if (scaled >= 1000 && index > 0) {
    index -= 1;
    scaled = compact(v / units[index].div);
  }
  return sign + String(scaled) + units[index].suffix;
}

function formatInt(value) {
  const n = Math.round(Number(value) || 0);
  const digits = String(Math.abs(n));
  let out = '';
  for (let i = 0; i < digits.length; i += 1) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += '.';
    out += digits[i];
  }
  return (n < 0 ? '-' : '') + out;
}

function formatCost(value) {
  return '$' + (Number(value) || 0).toFixed(2);
}

function usageTotal(usage) {
  if (!usage) return 0;
  const total = Number(usage.total);
  if (Number.isFinite(total)) return total;
  return (Number(usage.input) || 0)
    + (Number(usage.output) || 0)
    + (Number(usage.reasoning) || 0)
    + (Number(usage.cacheRead) || 0)
    + (Number(usage.cacheWrite) || 0);
}

function totalsHtml(today, all) {
  return '<div class="hud-total">'
    + '<span class="hud-total-label">Hôm nay</span>'
    + '<span class="hud-total-val">' + formatTokens(usageTotal(today)) + '</span>'
    + '<span class="hud-total-cost">' + formatCost(today && today.cost) + '</span>'
    + '</div><div class="hud-total">'
    + '<span class="hud-total-label">Tất cả</span>'
    + '<span class="hud-total-val">' + formatTokens(usageTotal(all)) + '</span>'
    + '<span class="hud-total-cost">' + formatCost(all && all.cost) + '</span>'
    + '</div>';
}

function rowHtml(agent, groupTotal) {
  const usage = agent.usage || {};
  const today = agent.usageToday || {};
  const total = usageTotal(usage);
  let share = groupTotal > 0 ? Math.round((total / groupTotal) * 100) : 0;
  if (total > 0) share = Math.max(2, share);
  share = Math.max(0, Math.min(100, share));
  const state = STATE_LABEL[agent.state] ? agent.state : 'idle';

  return '<div class="hud-row">'
    + '<div class="hud-row-top">'
    + '<span class="hud-dot" style="background:' + safeColor(agent.color) + '"></span>'
    + '<span class="hud-name">' + esc(agent.name) + '</span>'
    + '<span class="hud-state ' + STATE_CLASS[state] + '">' + STATE_LABEL[state] + '</span>'
    + '</div>'
    + '<div class="hud-row-mid">'
    + '<span class="hud-role">' + esc(agent.roleLabel || agent.role || '') + '</span>'
    + '<span class="hud-nums" title="Hôm nay / Tất cả"><b>' + formatTokens(usageTotal(today))
    + '</b><span class="hud-sep">/</span>' + formatTokens(total) + '</span>'
    + '</div>'
    + '<div class="hud-bar"><i style="width:' + share + '%"></i></div>'
    + '</div>';
}

function renderGroup(group, state, agents) {
  const totals = (state.totals && state.totals[group]) || {};
  const all = totals.all || EMPTY_USAGE;
  const today = totals.today || EMPTY_USAGE;
  const rows = agents.filter((a) => a && a.group === group);
  let groupTotal = 0;
  for (const agent of rows) groupTotal += usageTotal(agent.usage);

  const totalsEl = group === 'opencode' ? ui.opencodeTotals : ui.claudeTotals;
  const rowsEl = group === 'opencode' ? ui.opencodeRows : ui.claudeRows;
  if (totalsEl) totalsEl.innerHTML = totalsHtml(today, all);
  if (rowsEl) {
    rowsEl.innerHTML = rows.length
      ? rows.map((agent) => rowHtml(agent, groupTotal)).join('')
      : '<div class="hud-empty">Không có mô hình</div>';
  }
}

function renderEvents(state, byId) {
  if (!ui.events) return;
  const list = Array.isArray(state.events) ? state.events.slice(0, 8) : [];
  if (!list.length) {
    ui.events.innerHTML = '<li class="hud-empty">Chưa có sự kiện</li>';
    return;
  }
  ui.events.innerHTML = list.map((event) => {
    const agent = byId.get(event.agent);
    const name = agent && agent.name ? agent.name : String(event.agent || '').split('/').pop();
    return '<li class="hud-event">'
      + '<span class="hud-event-time">' + hhmmss(event.t) + '</span>'
      + '<span class="hud-event-body"><span class="hud-event-name">' + esc(name) + '</span> '
      + '<span class="hud-event-text">' + esc(event.text) + '</span></span>'
      + '</li>';
  }).join('');
}

function detailCells(usage, today) {
  return [
    ['Phiên', formatInt(usage.sessions)],
    ['Tin nhắn', formatInt(usage.messages)],
    ['Đầu vào', formatInt(usage.input)],
    ['Đầu ra', formatInt(usage.output)],
    ['Suy luận', formatInt(usage.reasoning)],
    ['Đọc cache', formatInt(usage.cacheRead)],
    ['Ghi cache', formatInt(usage.cacheWrite)],
    ['Tổng token', formatInt(usageTotal(usage))],
    ['Chi phí', formatCost(usage.cost)],
    ['Hôm nay', formatTokens(usageTotal(today)) + ' · ' + formatCost(today.cost)],
  ];
}

function renderDetail(agent) {
  if (!ui || !agent) return;
  detailId = agent.id || null;
  const usage = agent.usage || EMPTY_USAGE;
  const today = agent.usageToday || EMPTY_USAGE;
  const state = STATE_LABEL[agent.state] ? agent.state : 'idle';

  ui.detailPanel.hidden = false;
  ui.detail.innerHTML = '<div class="hud-detail-top">'
    + '<span class="hud-dot" style="background:' + safeColor(agent.color) + '"></span>'
    + '<span class="hud-detail-name">' + esc(agent.name) + '</span>'
    + '<span class="hud-state ' + STATE_CLASS[state] + '">' + STATE_LABEL[state] + '</span>'
    + '</div>'
    + '<div class="hud-detail-id">' + esc(agent.id) + '</div>'
    + '<div class="hud-kv"><span>Vai trò</span><b>' + esc(agent.roleLabel || agent.role || '') + '</b></div>'
    + '<div class="hud-kv"><span>Nhiệm vụ</span><b>' + esc(agent.task || '—') + '</b></div>'
    + '<div class="hud-kv"><span>Công cụ</span><b>' + esc(agent.tool || '—') + '</b></div>'
    + '<div class="hud-kv"><span>Phiên đang mở</span><b>' + formatInt(agent.activeSessions) + '</b></div>'
    + '<div class="hud-kv"><span>Hoạt động cuối</span><b>'
    + (Number(agent.lastActive) > 0 ? hhmmss(agent.lastActive) : '—') + '</b></div>'
    + '<div class="hud-kv-grid">'
    + detailCells(usage, today).map((cell) => '<div class="hud-cell"><span>' + cell[0]
      + '</span><b>' + cell[1] + '</b></div>').join('')
    + '</div>';
}

function closeDetail() {
  detailId = null;
  if (!ui) return;
  ui.detailPanel.hidden = true;
  if (ui.detail) ui.detail.innerHTML = '';
}

function applyCollapsed() {
  if (!ui) return;
  for (const name of Object.keys(ui.panels)) {
    const panel = ui.panels[name];
    if (!panel) continue;
    panel.classList.toggle('collapsed', !!collapsed[name]);
    const fold = panel.querySelector('.hud-fold');
    if (fold) fold.textContent = collapsed[name] ? '+' : '-';
  }
}

function onRootClick(event) {
  const target = event.target;
  const toggle = target && target.closest ? target.closest('[data-toggle]') : null;
  if (!toggle || !ui.root.contains(toggle)) return;
  const name = toggle.getAttribute('data-toggle');
  if (!(name in collapsed)) return;
  collapsed[name] = !collapsed[name];
  applyCollapsed();
}

export function initHud(root) {
  const target = root || (typeof document !== 'undefined' ? document.getElementById('hud') : null);
  if (!target) return;

  target.innerHTML = SHELL;
  ui = {
    root: target,
    clock: target.querySelector('[data-slot="clock"]'),
    counts: target.querySelector('[data-slot="counts"]'),
    opencodeTotals: target.querySelector('[data-slot="opencode-totals"]'),
    opencodeRows: target.querySelector('[data-slot="opencode-rows"]'),
    claudeTotals: target.querySelector('[data-slot="claude-totals"]'),
    claudeRows: target.querySelector('[data-slot="claude-rows"]'),
    events: target.querySelector('[data-slot="events"]'),
    detail: target.querySelector('[data-slot="detail"]'),
    detailPanel: target.querySelector('[data-panel="detail"]'),
    offline: target.querySelector('[data-slot="offline"]'),
    panels: {
      opencode: target.querySelector('[data-panel="opencode"]'),
      claude: target.querySelector('[data-panel="claude"]'),
      events: target.querySelector('[data-panel="events"]'),
      detail: target.querySelector('[data-panel="detail"]'),
    },
  };
  target.addEventListener('click', onRootClick);
  detailId = null;
  lastState = null;
  applyCollapsed();
}

export function update(state) {
  if (!ui || !state) return;
  lastState = state;
  const agents = Array.isArray(state.agents) ? state.agents : [];
  const byId = new Map();
  let working = 0;
  let waiting = 0;

  for (const agent of agents) {
    if (!agent || !agent.id) continue;
    byId.set(agent.id, agent);
    if (agent.state === 'working' || agent.state === 'reviewing') working += 1;
    else waiting += 1;
  }

  ui.clock.textContent = hhmmss(Number(state.now) || Date.now());
  ui.counts.textContent = 'Đang làm: ' + working + ' · Chờ: ' + waiting;
  renderGroup('opencode', state, agents);
  renderGroup('claude', state, agents);
  renderEvents(state, byId);

  if (detailId) {
    const agent = byId.get(detailId);
    if (agent) renderDetail(agent);
    else closeDetail();
  }
}

export function setOffline(isOffline) {
  if (!ui || !ui.offline) return;
  ui.offline.hidden = !isOffline;
}

export function showAgent(agentOrNull) {
  if (!ui) return;
  if (!agentOrNull) {
    closeDetail();
    return;
  }
  let agent = agentOrNull;
  if (lastState && Array.isArray(lastState.agents)) {
    const fresh = lastState.agents.find((a) => a && a.id === agentOrNull.id);
    if (fresh) agent = fresh;
  }
  renderDetail(agent);
}
