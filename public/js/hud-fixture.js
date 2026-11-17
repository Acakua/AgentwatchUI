// Hard-coded /api/state sample for public/hud-preview.html.
// Covers large and zero usage, two working workers, a guest, a reviewing
// Claude agent, an idle Claude agent and ten events.

const DEEPSEEK_PRO = 'byteplus/deepseek-v4-pro-ga-260813';
const ARK_CODE = 'byteplus/ark-code-latest';
const SEED_CODE = 'byteplus/seed-2-0-code-preview-260328';
const DEEPSEEK_FLASH = 'byteplus/deepseek-v4-1-flash-261017';
const SEED_PRO = 'byteplus/seed-2-0-pro-260328';
const SEED_LITE = 'byteplus/seed-2-0-lite-260428';
const BIG_PICKLE = 'opencode/big-pickle';
const NEMOTRON = 'opencode/nemotron-3.5-super-vl-free';
const GUEST = 'byteplus/glm-5-2-260617';
const FABLE = 'claude-fable-5-2';
const OPUS = 'claude-opus-5-5';
const SONNET = 'claude-sonnet-5-5';
const HAIKU = 'claude-haiku-5-5';

function usage(sessions, messages, input, output, reasoning, cacheRead, cacheWrite, cost) {
  return {
    sessions,
    messages,
    input,
    output,
    reasoning,
    cacheRead,
    cacheWrite,
    total: input + output + reasoning + cacheRead + cacheWrite,
    cost: cost || 0,
  };
}

function zero() {
  return usage(0, 0, 0, 0, 0, 0, 0, 0);
}

function sumUsage(list) {
  const out = zero();
  for (const item of list) {
    if (!item) continue;
    out.sessions += Number(item.sessions) || 0;
    out.messages += Number(item.messages) || 0;
    out.input += Number(item.input) || 0;
    out.output += Number(item.output) || 0;
    out.reasoning += Number(item.reasoning) || 0;
    out.cacheRead += Number(item.cacheRead) || 0;
    out.cacheWrite += Number(item.cacheWrite) || 0;
    out.cost += Number(item.cost) || 0;
  }
  out.total = out.input + out.output + out.reasoning + out.cacheRead + out.cacheWrite;
  out.cost = Math.round(out.cost * 100) / 100;
  return out;
}

export function fixtureState(nowInput) {
  const now = Number(nowInput) || Date.now();

  const agents = [
    {
      id: DEEPSEEK_PRO,
      group: 'opencode',
      name: 'DeepSeek Pro',
      role: 'coder',
      roleLabel: 'Lập trình logic',
      color: '#4f8dff',
      state: 'working',
      task: 'S2a creature spec',
      tool: 'edit',
      activeSessions: 2,
      lastActive: now - 4000,
      usage: usage(41, 1284, 120000, 9000, 2000, 800000, 0, 0),
      usageToday: usage(3, 41, 12000, 900, 200, 21000, 0, 0),
    },
    {
      id: ARK_CODE,
      group: 'opencode',
      name: 'Ark Code',
      role: 'builder',
      roleLabel: 'Lập trình tổng hợp',
      color: '#35c2b0',
      state: 'working',
      task: 'S2b desk grid',
      tool: 'bash',
      activeSessions: 1,
      lastActive: now - 9000,
      usage: usage(12, 322, 40000, 10000, 0, 1200000, 0, 0),
      usageToday: usage(2, 14, 5000, 2000, 0, 5345, 0, 0),
    },
    {
      id: SEED_CODE,
      group: 'opencode',
      name: 'Seed Code',
      role: 'art',
      roleLabel: 'Đồ họa',
      color: '#e85d9a',
      state: 'idle',
      task: '',
      tool: '',
      activeSessions: 0,
      lastActive: now - 3600000,
      usage: usage(812, 14032, 345678, 123456, 10000, 11866544, 0, 1.23),
      usageToday: zero(),
    },
    {
      id: DEEPSEEK_FLASH,
      group: 'opencode',
      name: 'DeepSeek Flash',
      role: 'ui',
      roleLabel: 'Giao diện',
      color: '#9b6cff',
      state: 'idle',
      task: '',
      tool: '',
      activeSessions: 0,
      lastActive: now - 600000,
      usage: usage(6, 88, 4000, 700, 100, 2200, 300, 0.04),
      usageToday: zero(),
    },
    {
      id: SEED_PRO,
      group: 'opencode',
      name: 'Seed Pro',
      role: 'qa',
      roleLabel: 'Kiểm thử',
      color: '#f2b63d',
      state: 'idle',
      task: '',
      tool: '',
      activeSessions: 0,
      lastActive: now - 1800000,
      usage: usage(3, 21, 3000, 500, 50, 0, 0, 0),
      usageToday: zero(),
    },
    {
      id: SEED_LITE,
      group: 'opencode',
      name: 'Seed Lite',
      role: 'chore',
      roleLabel: 'Việc vặt',
      color: '#8bc34a',
      state: 'idle',
      task: '',
      tool: '',
      activeSessions: 0,
      lastActive: 0,
      usage: zero(),
      usageToday: zero(),
    },
    {
      id: BIG_PICKLE,
      group: 'opencode',
      name: 'Big Pickle',
      role: 'reserve',
      roleLabel: 'Dự bị',
      color: '#5fa55a',
      state: 'idle',
      task: '',
      tool: '',
      activeSessions: 0,
      lastActive: 0,
      usage: zero(),
      usageToday: zero(),
    },
    {
      id: NEMOTRON,
      group: 'opencode',
      name: 'Nemotron VL',
      role: 'reserve',
      roleLabel: 'Dự bị',
      color: '#7fb800',
      state: 'idle',
      task: '',
      tool: '',
      activeSessions: 0,
      lastActive: 0,
      usage: zero(),
      usageToday: zero(),
    },
    {
      id: GUEST,
      group: 'opencode',
      name: 'glm-5-2-260617',
      role: 'guest',
      roleLabel: 'Khách',
      color: '#9aa0a6',
      state: 'idle',
      task: '',
      tool: '',
      activeSessions: 0,
      lastActive: 0,
      usage: zero(),
      usageToday: zero(),
    },
    {
      id: FABLE,
      group: 'claude',
      name: 'Fable',
      role: 'manager',
      roleLabel: 'Trưởng phòng',
      color: '#d97757',
      state: 'reviewing',
      task: 'AgentwatchUI',
      tool: 'Read',
      activeSessions: 1,
      lastActive: now - 20000,
      usage: usage(9, 210, 15000, 6000, 0, 225000, 4000, 0),
      usageToday: usage(1, 12, 2000, 800, 0, 9000, 200, 0),
    },
    {
      id: OPUS,
      group: 'claude',
      name: 'Opus',
      role: 'deputy',
      roleLabel: 'Phó phòng',
      color: '#c15f3c',
      state: 'idle',
      task: '',
      tool: '',
      activeSessions: 0,
      lastActive: now - 7200000,
      usage: zero(),
      usageToday: zero(),
    },
    {
      id: SONNET,
      group: 'claude',
      name: 'Sonnet',
      role: 'staff',
      roleLabel: 'Chuyên viên',
      color: '#e0a070',
      state: 'idle',
      task: '',
      tool: '',
      activeSessions: 0,
      lastActive: now - 1200000,
      usage: usage(4, 60, 20000, 8000, 0, 20000, 2000, 0.12),
      usageToday: zero(),
    },
    {
      id: HAIKU,
      group: 'claude',
      name: 'Haiku',
      role: 'staff',
      roleLabel: 'Chuyên viên',
      color: '#f0c9a0',
      state: 'idle',
      task: '',
      tool: '',
      activeSessions: 0,
      lastActive: 0,
      usage: zero(),
      usageToday: zero(),
    },
  ];

  const opencodeAgents = agents.filter((agent) => agent.group === 'opencode');
  const claudeAgents = agents.filter((agent) => agent.group === 'claude');

  const events = [
    { t: now - 5000, agent: DEEPSEEK_PRO, text: 'edit public/js/office.js' },
    { t: now - 11000, agent: ARK_CODE, text: 'bash node --test test/layout.test.js' },
    { t: now - 18000, agent: FABLE, text: 'read public/js/hud.js' },
    { t: now - 25000, agent: DEEPSEEK_PRO, text: 'grep "<canvas" public/index.html' },
    { t: now - 31000, agent: GUEST, text: 'bash node bin/aw.js status' },
    { t: now - 38000, agent: SEED_CODE, text: 'edit public/js/sprites.js' },
    { t: now - 46000, agent: ARK_CODE, text: 'edit public/js/layout.js' },
    { t: now - 52000, agent: SONNET, text: 'read docs/SPEC.md' },
    { t: now - 61000, agent: SEED_PRO, text: 'bash node --test test/state.test.js' },
    { t: now - 74000, agent: DEEPSEEK_PRO, text: 'edit lib/state.js' },
  ];

  return {
    now,
    agents,
    review: { by: FABLE, target: DEEPSEEK_PRO, note: 'S2a', since: now - 45000 },
    totals: {
      opencode: {
        all: sumUsage(opencodeAgents.map((agent) => agent.usage)),
        today: sumUsage(opencodeAgents.map((agent) => agent.usageToday)),
      },
      claude: {
        all: sumUsage(claudeAgents.map((agent) => agent.usage)),
        today: sumUsage(claudeAgents.map((agent) => agent.usageToday)),
      },
    },
    events,
  };
}
