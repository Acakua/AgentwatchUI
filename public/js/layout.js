// Pure geometry for the office. Art coordinates: x right, y down, 480x270.
// No three.js and no DOM here so it can be unit tested under Node.

export const ROOM_W = 480;
export const ROOM_H = 270;
export const WALL_H = 24;

export const CHAR_W = 16;
export const CHAR_H = 24;

// Top-right corner reserved for the manager: desks may not enter this rect.
// Enlarged to hold one desk per Claude agent plus a lounge.
export const MANAGER_CORNER = { x: 336, y: WALL_H, w: ROOM_W - 336, h: 172 };

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

// Seated feet sit this far above the desk bottom, matching drawDesk's front
// edge; the desk is drawn over the lower half of the character.
const SEAT_Y_INSET = 8;

// Fixed Claude desks inside the manager corner: the first is the big manager
// desk, the rest are ordinary desks in two rows. Positions do not depend on n.
const MANAGER_DESKS = [
  { x: 340, y: 36, w: 48, h: 24, big: true },
  { x: 392, y: 36, w: 32, h: 24, big: false },
  { x: 428, y: 36, w: 32, h: 24, big: false },
  { x: 340, y: 84, w: 32, h: 24, big: false },
  { x: 376, y: 84, w: 32, h: 24, big: false },
  { x: 412, y: 84, w: 32, h: 24, big: false },
];

// Lounge sofas (drawSofa is 40x18) and the seats in front of each one.
const SOFAS = [
  { x: 338, y: 140, w: 40, h: 18 },
  { x: 380, y: 140, w: 40, h: 18 },
  { x: 422, y: 140, w: 40, h: 18 },
];

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
      seat: { x: deskX + DESK_W / 2, y: deskY + DESK_H - SEAT_Y_INSET },
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

// A desk and seat for every Claude agent. Index 0 is the big manager desk,
// 1.. are ordinary desks. The seat has the same offset from its desk as an
// opencode worker seat has from a worker desk, so the sit pose is identical.
export function managerSpots(n) {
  const count = clamp(Math.floor(Number(n) || MANAGER_DESKS.length), 1, MANAGER_DESKS.length);
  const desks = MANAGER_DESKS.slice(0, count).map((d, index) => ({
    index,
    desk: { x: d.x, y: d.y, w: d.w, h: d.h, big: d.big },
    seat: { x: d.x + d.w / 2, y: d.y + d.h - SEAT_Y_INSET },
    // Fallback standing spot beside the desk when no worker target exists.
    review: { x: d.x + d.w / 2, y: d.y + 30 },
  }));

  const lounge = [];
  let index = 0;
  for (let s = 0; s < SOFAS.length; s++) {
    for (let c = 0; c < 2; c++) {
      lounge.push({
        index,
        sofaIndex: s,
        x: SOFAS[s].x + 8 + c * 24,
        y: SOFAS[s].y + 12,
        plateRaise: index % 2 === 0 ? 0 : 9,
      });
      index++;
    }
  }

  return {
    corner: MANAGER_CORNER,
    desks,
    sofas: SOFAS.map((s) => ({ ...s })),
    lounge,
    rug: { x: 340, y: 36, w: 48, h: 32 },
  };
}

// Round-2 decor as data. x/y are the top-left of the sprite, w/h its size.
// Kept clear of every desk, seat and the walking corridor at CORRIDOR_Y.
export function decor() {
  return [
    { sprite: 'door', x: 12, y: 0, w: 20, h: 30 },
    { sprite: 'whiteboard', x: 372, y: 1, w: 44, h: 22 },
    { sprite: 'clock', x: 424, y: 4, w: 10, h: 10 },
    { sprite: 'poster', x: 444, y: 3, w: 14, h: 16 },
    { sprite: 'bookshelf', x: 456, y: 104, w: 24, h: 34 },
    { sprite: 'waterCooler', x: 468, y: 60, w: 10, h: 24 },
    { sprite: 'plant', x: 448, y: 64, w: 12, h: 20 },
    { sprite: 'plant', x: 344, y: 116, w: 12, h: 20 },
    { sprite: 'sofa', x: 338, y: 140, w: 40, h: 18 },
    { sprite: 'sofa', x: 380, y: 140, w: 40, h: 18 },
    { sprite: 'sofa', x: 422, y: 140, w: 40, h: 18 },
    { sprite: 'coffeeTable', x: 372, y: 170, w: 20, h: 12 },
  ];
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
