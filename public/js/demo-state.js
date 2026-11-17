// Fake /api/state generator for ?demo=1. The SHAPE must match docs/SPEC.md
// section 2 exactly; only the ids/names come from a hard-coded roster copy
// (the server never exposes config/roster.json to the browser).

const ROSTER = {
  roles: {
    coder: 'Lập trình logic',
    builder: 'Lập trình tổng hợp',
    art: 'Đồ họa',
    ui: 'Giao diện',
    qa: 'Kiểm thử',
    chore: 'Việc vặt',
    reserve: 'Dự bị',
    manager: 'Trưởng phòng',
    deputy: 'Phó phòng',
    staff: 'Chuyên viên',
    guest: 'Khách',
  },
  agents: [
    { id: 'byteplus/deepseek-v4-pro-ga-260813', group: 'opencode', name: 'DeepSeek Pro', role: 'coder', color: '#4f8dff' },
    { id: 'byteplus/ark-code-latest', group: 'opencode', name: 'Ark Code', role: 'builder', color: '#35c2b0' },
    { id: 'byteplus/seed-2-0-code-preview-260328', group: 'opencode', name: 'Seed Code', role: 'art', color: '#e85d9a' },
    { id: 'byteplus/deepseek-v4-1-flash-261017', group: 'opencode', name: 'DeepSeek Flash', role: 'ui', color: '#9b6cff' },
    { id: 'byteplus/seed-2-0-pro-260328', group: 'opencode', name: 'Seed Pro', role: 'qa', color: '#f2b63d' },
    { id: 'byteplus/seed-2-0-lite-260428', group: 'opencode', name: 'Seed Lite', role: 'chore', color: '#8bc34a' },
    { id: 'opencode/big-pickle', group: 'opencode', name: 'Big Pickle', role: 'reserve', color: '#5fa55a' },
    { id: 'opencode/nemotron-3.5-super-vl-free', group: 'opencode', name: 'Nemotron VL', role: 'reserve', color: '#7fb800' },
    { id: 'claude-fable-5-2', group: 'claude', name: 'Fable', role: 'manager', color: '#d97757' },
    { id: 'claude-opus-5-5', group: 'claude', name: 'Opus', role: 'deputy', color: '#c15f3c' },
    { id: 'claude-sonnet-5-5', group: 'claude', name: 'Sonnet', role: 'staff', color: '#e0a070' },
    { id: 'claude-haiku-5-5', group: 'claude', name: 'Haiku', role: 'staff', color: '#f0c9a0' },
  ],
};

const TASKS = [
  'S2a creature spec',
  'Sắp xếp desk slots',
  'Vẽ sprite nhân vật',
  'Kiểm tra HUD',
  'Sửa lỗi walking',
  'Làm rõ /api/state',
  'Dọn event log',
];

const TOOLS = ['edit', 'bash', 'read', 'grep', 'write', 'glob'];

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

function cloneUsage(usage) {
  return {
    sessions: usage.sessions,
    messages: usage.messages,
    input: usage.input,
    output: usage.output,
    reasoning: usage.reasoning,
    cacheRead: usage.cacheRead,
    cacheWrite: usage.cacheWrite,
    total: usage.total,
    cost: usage.cost,
  };
}

function addUsage(target, input, output, cacheRead) {
  target.messages += 1;
  target.input += input;
  target.output += output;
  target.cacheRead += cacheRead;
  target.total += input + output + cacheRead;
}

function sumUsage(list) {
  const acc = zeroUsage();
  for (const u of list) {
    acc.sessions += u.sessions;
    acc.messages += u.messages;
    acc.input += u.input;
    acc.output += u.output;
    acc.reasoning += u.reasoning;
    acc.cacheRead += u.cacheRead;
    acc.cacheWrite += u.cacheWrite;
    acc.total += u.total;
    acc.cost += u.cost;
  }
  return acc;
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function chance(p) {
  return Math.random() < p;
}

export function createDemoState(startNow) {
  const now0 = Number(startNow) || Date.now();
  const runtime = ROSTER.agents.map((agent) => {
    const active = agent.group === 'opencode' ? Math.random() < 0.5 : Math.random() < 0.35;
    const all = zeroUsage();
    const today = zeroUsage();
    all.sessions = Math.floor(Math.random() * 4);
    today.sessions = Math.min(all.sessions, Math.floor(Math.random() * 3));
    for (let i = 0; i < 6; i++) {
      addUsage(all, 2000 + Math.floor(Math.random() * 3000), 40 + Math.floor(Math.random() * 120), 20000);
    }
    for (let i = 0; i < 3; i++) {
      addUsage(today, 1500 + Math.floor(Math.random() * 2500), 30 + Math.floor(Math.random() * 90), 15000);
    }
    return {
      agent,
      working: active,
      lastActive: now0 - Math.floor(Math.random() * 60000),
      idleSince: active ? 0 : now0 - Math.floor(Math.random() * 120000),
      task: active ? pick(TASKS) : '',
      tool: active ? pick(TOOLS) : '',
      all,
      today,
    };
  });

  let review = null;
  let lastReviewAt = now0 - 15000;
  let reviewUntil = 0;
  // BytePlus is quota-blocked for the first 40 s so the quota bubble and the
  // dimmed nameplate can be seen, then the limit clears.
  const quotaResetAt = now0 + 40000;
  const events = [];

  function opencodeRuntime() {
    return runtime.filter((r) => r.agent.group === 'opencode');
  }

  function pushEvent(now, id, text) {
    events.unshift({ t: now, agent: id, text });
    if (events.length > 30) events.length = 30;
  }

  function step(now) {
    if (review && now >= reviewUntil) {
      review = null;
      reviewUntil = 0;
    }

    if (!review && now - lastReviewAt >= 20000 && runtime.length > 0) {
      const workers = opencodeRuntime().filter((r) => r.agent.group === 'opencode');
      const claude = runtime.filter((r) => r.agent.group === 'claude');
      if (workers.length && claude.length) {
        const manager = claude[0];
        const target = pick(workers);
        target.working = true;
        target.idleSince = 0;
        target.lastActive = now;
        target.task = pick(TASKS);
        target.tool = 'read';
        review = {
          by: manager.agent.id,
          target: target.agent.id,
          note: 'demo',
          since: now,
        };
        reviewUntil = now + 8000;
        lastReviewAt = now;
        pushEvent(now, manager.agent.id, 'review ' + target.agent.name);
      }
    }

    for (const r of runtime) {
      if (r.agent.group === 'opencode') {
        if (r.working && chance(0.02)) {
          r.working = false;
          r.idleSince = now;
          r.task = '';
          r.tool = '';
          continue;
        }
        if (!r.working && chance(0.05)) {
          r.working = true;
          r.idleSince = 0;
          r.task = pick(TASKS);
          r.tool = pick(TOOLS);
          pushEvent(now, r.agent.id, r.tool + ' ' + r.task);
        }
      } else if (chance(0.02)) {
        r.working = !r.working;
        if (r.working) {
          r.idleSince = 0;
          r.task = pick(TASKS);
          r.tool = pick(TOOLS);
          pushEvent(now, r.agent.id, r.tool + ' ' + r.task);
        } else {
          r.idleSince = now;
          r.task = '';
          r.tool = '';
        }
      }

      if (review && review.target === r.agent.id) r.working = true;

      if (r.working) {
        r.lastActive = now;
        const input = 800 + Math.floor(Math.random() * 2500);
        const output = 30 + Math.floor(Math.random() * 140);
        const cacheRead = Math.floor(Math.random() * 16000);
        addUsage(r.all, input, output, cacheRead);
        addUsage(r.today, input, output, cacheRead);
      }
    }

    const quotaBlocked = now < quotaResetAt;
    const agents = runtime.map((r) => {
      const agent = r.agent;
      let state = r.working ? 'working' : 'idle';
      if (review && review.by === agent.id) state = 'reviewing';
      const byteplus = agent.group === 'opencode' && agent.id.indexOf('byteplus/') === 0;
      return {
        id: agent.id,
        group: agent.group,
        name: agent.name,
        role: agent.role,
        roleLabel: ROSTER.roles[agent.role] || '',
        color: agent.color,
        state,
        task: r.task,
        tool: r.tool,
        activeSessions: r.working ? 1 : 0,
        lastActive: r.lastActive,
        blockedUntil: byteplus && quotaBlocked ? quotaResetAt : 0,
        usage: cloneUsage(r.all),
        usageToday: cloneUsage(r.today),
      };
    });

    const opencode = runtime.filter((r) => r.agent.group === 'opencode');
    const claude = runtime.filter((r) => r.agent.group === 'claude');

    return {
      now,
      agents,
      quota: [{
        id: 'byteplus',
        group: 'opencode',
        label: 'BytePlus Coding Plan',
        hitAt: now0,
        resetAt: quotaResetAt,
        blocked: quotaBlocked,
        text: '5-hour usage quota',
      }],
      review: review ? { by: review.by, target: review.target, note: review.note, since: review.since } : null,
      totals: {
        opencode: {
          all: sumUsage(opencode.map((r) => r.all)),
          today: sumUsage(opencode.map((r) => r.today)),
        },
        claude: {
          all: sumUsage(claude.map((r) => r.all)),
          today: sumUsage(claude.map((r) => r.today)),
        },
      },
      events: events.slice(),
    };
  }

  return { tick: step };
}
