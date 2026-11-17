// Pure geometry for the office. Art coordinates: x right, y down, 480x270.
// No three.js and no DOM here so it can be unit tested under Node.

export const ROOM_W = 480;
export const ROOM_H = 270;
export const WALL_H = 24;

export const CHAR_W = 16;
export const CHAR_H = 24;

// Top-right corner reserved for the manager: desks may not enter this rect.
export const MANAGER_CORNER = { x: 356, y: WALL_H, w: ROOM_W - 356, h: 110 };

export const BENCH_Y = 244;
export const BENCH_W = 64;
export const BENCH_H = 14;
export const CORRIDOR_Y = 236;

const DESK_W = 32;
const DESK_H = 24;
const GRID_COLS = 6;
const GRID_START_X = 20;
const GRID_START_Y = 36;
const GRID_GAP_X = 56;
const GRID_GAP_Y = 44;
const DESK_BOTTOM_LIMIT = 232;

function clamp(value, lo, hi) {
  return Math.max(lo, Math.min(hi, value));
}

// One desk slot per opencode agent. Index i is the agent's order among the
// opencode agents in state.agents, so it is stable across polls.
export function deskSlots(count) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  const slots = [];
  if (n === 0) return slots;

  const rows = Math.ceil(n / GRID_COLS);
  let gapY = GRID_GAP_Y;
  if (rows > 1) {
    const room = DESK_BOTTOM_LIMIT - DESK_H - GRID_START_Y;
    gapY = Math.max(28, Math.min(GRID_GAP_Y, Math.floor(room / (rows - 1))));
  }

  for (let i = 0; i < n; i++) {
    const col = i % GRID_COLS;
    const row = Math.floor(i / GRID_COLS);
    const deskX = GRID_START_X + col * GRID_GAP_X;
    const deskY = GRID_START_Y + row * gapY;
    slots.push({
      index: i,
      col,
      row,
      desk: { x: deskX, y: deskY, w: DESK_W, h: DESK_H },
      chair: { x: deskX + 10, y: deskY + 12, w: 12, h: 14 },
      // Feet anchor for the seated character (behind the desk).
      seat: { x: deskX + DESK_W / 2, y: deskY + 16 },
      // Where a reviewing manager stands, in the gap left of the desk.
      stand: { x: deskX - 6, y: deskY + 30 },
    });
  }
  return slots;
}

// Seats on the waiting benches along the bottom. Seats are spread across the
// whole bench row, left to right. Small counts keep one row; larger counts use
// extra rows 16 px above so neighbours never sit closer than 22 px.
export function benchSeats(count) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (n === 0) return [];

  const WIDE_GAP = 26;
  const TIGHT_GAP = 22;
  const ROW_STEP = 16;
  const CENTER_MARGIN = 8;
  // Distance between the first and last seat centre, leaving the bench row
  // inside the room when it is drawn under the seats.
  const MAX_CENTER_SPAN = ROOM_W - 2 * CENTER_MARGIN - CHAR_W * 2;

  const rowsPerRoom = Math.floor(MAX_CENTER_SPAN / TIGHT_GAP) + 1;
  let rows = n <= 16 ? 1 : 2;
  while (Math.ceil(n / rows) > rowsPerRoom) rows++;

  const perRow = Math.ceil(n / rows);
  const minGap = n <= 16 ? WIDE_GAP : TIGHT_GAP;
  const seats = [];
  let index = 0;

  for (let r = 0; r < rows && index < n; r++) {
    const m = Math.min(perRow, n - index);
    const spread = m > 1 ? MAX_CENTER_SPAN / (m - 1) : 0;
    const gap = m > 1 ? Math.max(minGap, Math.min(40, spread)) : 0;
    const seatSpan = (m - 1) * gap + CHAR_W;
    // Epsilon guards the exact-fit case (448 / 64) against float rounding.
    const maxBenches = Math.floor(ROOM_W / BENCH_W);
    const benchCount = Math.max(1, Math.min(maxBenches, Math.ceil(seatSpan / BENCH_W - 1e-9)));
    const benchGap = benchCount > 1
      ? Math.max(0, Math.min(16, Math.floor((ROOM_W - benchCount * BENCH_W) / (benchCount - 1))))
      : 0;
    const totalBenchW = benchCount * BENCH_W + (benchCount - 1) * benchGap;
    const startX = clamp(
      Math.round((ROOM_W - totalBenchW) / 2),
      0,
      Math.max(0, ROOM_W - totalBenchW),
    );
    const step = m > 1 ? (totalBenchW - CHAR_W) / (m - 1) : 0;
    const baseY = BENCH_Y + 12 - r * ROW_STEP;

    for (let s = 0; s < m; s++) {
      const x = Math.round(startX + CHAR_W / 2 + s * step);
      const b = Math.min(benchCount - 1, Math.floor((x - startX) / (BENCH_W + benchGap)));
      seats.push({
        index,
        row: r,
        benchX: startX + b * (BENCH_W + benchGap),
        benchY: baseY - 12,
        x,
        y: baseY,
        // Neighbouring seated characters alternate nameplate height.
        plateRaise: index % 2 === 0 ? 0 : 9,
      });
      index++;
    }
  }
  return seats;
}

// Manager corner furniture and the fixed spots for Claude agents. Every spot
// is at least 26 px from the others so characters and nameplates do not collide.
export function managerSpots() {
  const deskX = ROOM_W - 48 - 16;
  const deskY = 40;
  const rugX = deskX;
  const rugY = 68;
  const sofaX = ROOM_W - BENCH_W - 16;
  const sofaY = 104;

  const work = [
    // Seat behind the manager desk for the first working Claude agent.
    { x: deskX + 24, y: deskY + 10 },
    // Standing spots beside the desk for further working ones.
    { x: deskX - 32, y: deskY - 2 },
    { x: deskX - 32, y: deskY + 28 },
    { x: deskX - 32, y: deskY + 60 },
    { x: deskX - 32, y: deskY + 88 },
    { x: ROOM_W - 14, y: deskY },
    { x: ROOM_W - 14, y: rugY },
    { x: ROOM_W - 14, y: rugY + 28 },
  ];

  const idle = [];
  const idleRows = [sofaY + 12, sofaY - 16];
  for (let r = 0; r < idleRows.length; r++) {
    for (let c = 0; c < 2; c++) {
      const i = r * 2 + c;
      idle.push({
        x: sofaX + 8 + c * 28,
        y: idleRows[r],
        index: i,
        plateRaise: i % 2 === 0 ? 0 : 9,
      });
    }
  }

  return {
    corner: MANAGER_CORNER,
    desk: { x: deskX, y: deskY, w: 48, h: 24 },
    rug: { x: rugX, y: rugY, w: 48, h: 32 },
    sofa: { x: sofaX, y: sofaY, w: BENCH_W, h: BENCH_H },
    work,
    idle,
  };
}

// Where a reviewing Claude agent stands next to the desk of an opencode agent.
export function reviewSpot(deskIndex, count) {
  const slots = deskSlots(count);
  if (slots.length === 0) return { x: 240, y: CORRIDOR_Y - 12 };
  const index = clamp(Math.floor(Number(deskIndex) || 0), 0, slots.length - 1);
  const slot = slots[index];
  return { x: slot.stand.x, y: slot.stand.y, deskIndex: slot.index };
}

// Waypoints from a to b: drop down to the corridor, cross it, then rise.
// The corridor sits just above the bench row and below every desk.
export function pathBetween(a, b) {
  if (!a || !b) return [];
  const ax = clamp(Number(a.x) || 0, 8, ROOM_W - 8);
  const ay = clamp(Number(a.y) || 0, 8, ROOM_H - 8);
  const bx = clamp(Number(b.x) || 0, 8, ROOM_W - 8);
  const by = clamp(Number(b.y) || 0, 8, ROOM_H - 8);
  const points = [{ x: ax, y: ay }];
  if (ay !== CORRIDOR_Y) points.push({ x: ax, y: CORRIDOR_Y });
  if (ax !== bx) points.push({ x: bx, y: CORRIDOR_Y });
  points.push({ x: bx, y: by });
  return dedupe(points);
}

function dedupe(points) {
  const out = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || Math.abs(last.x - p.x) > 0.01 || Math.abs(last.y - p.y) > 0.01) {
      out.push(p);
    }
  }
  return out;
}
