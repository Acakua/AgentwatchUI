'use strict';

const test = require('node:test');
const assert = require('node:assert');

let layoutPromise = null;
function layout() {
  if (!layoutPromise) layoutPromise = import('../public/js/layout.js');
  return layoutPromise;
}

function insideRoom(L, p) {
  return p.x >= 0 && p.x <= L.ROOM_W && p.y >= 0 && p.y <= L.ROOM_H;
}

function insideRect(rect, p) {
  return p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h;
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function key(p) {
  return Math.round(p.x * 100) + ':' + Math.round(p.y * 100);
}

const COUNTS = [1, 12, 16, 20, 28];

test('desk slots: count, bounds, manager corner, no overlap', async () => {
  const L = await layout();
  for (const n of COUNTS) {
    const slots = L.deskSlots(n);
    assert.strictEqual(slots.length, n, 'slot count for n=' + n);

    for (const slot of slots) {
      const d = slot.desk;
      assert.ok(d.x >= 0 && d.x + d.w <= L.ROOM_W, 'desk x inside room n=' + n);
      assert.ok(d.y >= L.WALL_H && d.y + d.h <= L.ROOM_H, 'desk y inside room n=' + n);
      assert.ok(!rectsOverlap(d, L.MANAGER_CORNER), 'desk outside manager corner n=' + n);
      for (const p of [slot.seat, slot.stand, slot.chair]) {
        assert.ok(insideRoom(L, p), 'slot point inside room n=' + n);
        assert.ok(!insideRect(L.MANAGER_CORNER, p), 'slot point outside manager corner n=' + n);
      }
    }

    const seenSeats = new Set();
    const seenStands = new Set();
    for (const slot of slots) {
      const seatKey = key(slot.seat);
      const standKey = key(slot.stand);
      assert.ok(!seenSeats.has(seatKey), 'seat distinct n=' + n);
      assert.ok(!seenStands.has(standKey), 'stand distinct n=' + n);
      seenSeats.add(seatKey);
      seenStands.add(standKey);
    }

    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        assert.ok(!rectsOverlap(slots[i].desk, slots[j].desk), 'desks do not overlap n=' + n + ' ' + i + '/' + j);
      }
    }
  }
});

test('worker desks for n=16 do not overlap the manager corner', async () => {
  const L = await layout();
  const corner = L.MANAGER_CORNER;
  assert.ok(corner.x + corner.w <= L.ROOM_W && corner.y + corner.h <= L.ROOM_H, 'corner inside room');
  for (const slot of L.deskSlots(16)) {
    assert.ok(!rectsOverlap(slot.desk, corner), 'worker desk outside corner');
    for (const p of [slot.seat, slot.stand, slot.chair]) {
      assert.ok(!insideRect(corner, p), 'worker point outside corner');
    }
  }
});

test('bench seats: distinct and inside room', async () => {
  const L = await layout();
  for (const n of [1, 8, 12, 20]) {
    const seats = L.benchSeats(n);
    assert.strictEqual(seats.length, n, 'bench seat count n=' + n);
    const seen = new Set();
    for (const seat of seats) {
      assert.ok(insideRoom(L, seat), 'bench seat inside room n=' + n);
      assert.ok(!insideRect(L.MANAGER_CORNER, seat), 'bench seat outside manager corner n=' + n);
      const k = key(seat);
      assert.ok(!seen.has(k), 'bench seat distinct n=' + n);
      seen.add(k);
      assert.ok(seat.benchX >= 0 && seat.benchX + L.BENCH_W <= L.ROOM_W, 'bench inside room n=' + n);
    }
  }
});

test('manager desks: inside the corner, no overlap, one per Claude agent', async () => {
  const L = await layout();
  for (const n of [1, 4, 6]) {
    const spots = L.managerSpots(n);
    assert.strictEqual(spots.desks.length, n, 'one desk per Claude agent n=' + n);
    assert.ok(spots.desks[0].desk.big === true, 'first desk is the big manager desk');
    for (let i = 1; i < spots.desks.length; i++) {
      assert.ok(spots.desks[i].desk.big === false, 'later desks are ordinary n=' + n);
      assert.strictEqual(spots.desks[i].desk.w, 32, 'ordinary desk width n=' + n);
      assert.strictEqual(spots.desks[i].desk.h, 24, 'ordinary desk height n=' + n);
    }
    for (const entry of spots.desks) {
      const d = entry.desk;
      if (entry.desk.big) {
        assert.strictEqual(d.w, 48, 'big desk width');
        assert.strictEqual(d.h, 24, 'big desk height');
      }
      assert.ok(insideRect(spots.corner, { x: d.x, y: d.y }), 'desk top-left in corner n=' + n);
      assert.ok(insideRect(spots.corner, { x: d.x + d.w, y: d.y + d.h }), 'desk bottom-right in corner n=' + n);
      assert.ok(insideRect(spots.corner, entry.seat), 'desk seat in corner n=' + n);
      assert.ok(insideRect(spots.corner, entry.review), 'desk review spot in corner n=' + n);
    }
    for (let i = 0; i < spots.desks.length; i++) {
      for (let j = i + 1; j < spots.desks.length; j++) {
        assert.ok(!rectsOverlap(spots.desks[i].desk, spots.desks[j].desk),
          'manager desks do not overlap n=' + n + ' ' + i + '/' + j);
      }
    }
  }
});

test('manager seat has the same offset as a worker seat', async () => {
  const L = await layout();
  const worker = L.deskSlots(1)[0];
  // Worker seat is desk-centred and sits SEAT_Y_INSET above the desk bottom.
  assert.strictEqual(worker.seat.x - worker.desk.x, worker.desk.w / 2, 'worker seat is desk-centred');
  assert.strictEqual(worker.desk.y + worker.desk.h - worker.seat.y, 8, 'worker seat inset from desk bottom');
  const spots = L.managerSpots(6);
  for (const entry of spots.desks) {
    assert.strictEqual(entry.seat.x - entry.desk.x, entry.desk.w / 2, 'manager seat is desk-centred');
    assert.strictEqual(entry.desk.y + entry.desk.h - entry.seat.y, 8, 'manager seat inset matches worker');
  }
});

test('lounge seats are at least 14 px apart', async () => {
  const L = await layout();
  for (const n of [1, 4, 6]) {
    const lounge = L.managerSpots(n).lounge;
    assert.ok(lounge.length >= 6, 'at least six lounge seats n=' + n);
    for (const seat of lounge) {
      assert.ok(insideRect(L.MANAGER_CORNER, seat), 'lounge seat inside corner n=' + n);
    }
    for (let i = 0; i < lounge.length; i++) {
      for (let j = i + 1; j < lounge.length; j++) {
        const dx = lounge[i].x - lounge[j].x;
        const dy = lounge[i].y - lounge[j].y;
        assert.ok(Math.sqrt(dx * dx + dy * dy) >= 14,
          'lounge seat distance n=' + n + ' ' + i + '/' + j);
      }
    }
  }
});

test('decor rectangles do not cover a desk, a seat or the corridor', async () => {
  const L = await layout();
  const desks = [];
  const seats = [];
  for (const n of [28]) {
    for (const slot of L.deskSlots(n)) {
      desks.push(slot.desk);
      seats.push(slot.seat, slot.stand);
    }
    for (const seat of L.benchSeats(n)) seats.push({ x: seat.x, y: seat.y });
  }
  const spots = L.managerSpots(6);
  for (const entry of spots.desks) {
    desks.push(entry.desk);
    seats.push(entry.seat, entry.review);
  }
  for (const seat of spots.lounge) seats.push({ x: seat.x, y: seat.y });

  for (const item of L.decor()) {
    const rect = { x: item.x, y: item.y, w: item.w, h: item.h };
    for (const desk of desks) {
      assert.ok(!rectsOverlap(rect, desk), 'decor ' + item.sprite + ' covers a desk');
    }
    // Sofas are the furniture the lounge seats rest on, not covers over them.
    if (item.sprite !== 'sofa') {
      for (const seat of seats) {
        assert.ok(!insideRect(rect, seat), 'decor ' + item.sprite + ' covers a seat');
      }
    }
    assert.ok(!(rect.y <= L.CORRIDOR_Y && rect.y + rect.h >= L.CORRIDOR_Y),
      'decor ' + item.sprite + ' covers the corridor');
  }
});

test('reviewSpot matches a desk stand position', async () => {
  const L = await layout();
  for (const n of COUNTS) {
    const slots = L.deskSlots(n);
    for (let i = 0; i < n; i++) {
      const spot = L.reviewSpot(i, n);
      const slot = slots[Math.min(i, slots.length - 1)];
      assert.deepStrictEqual({ x: spot.x, y: spot.y }, slot.stand);
    }
  }
});

test('pathBetween waypoints stay inside the room', async () => {
  const L = await layout();
  for (const n of COUNTS) {
    const slots = L.deskSlots(n);
    const bench = L.benchSeats(n);
    const spots = L.managerSpots(6);
    const points = [
      { x: 8, y: 8 },
      { x: L.ROOM_W - 8, y: L.ROOM_H - 8 },
      { x: 240, y: 135 },
      ...slots.map((s) => s.seat),
      ...slots.map((s) => s.stand),
      ...bench.map((s) => ({ x: s.x, y: s.y })),
      ...spots.desks.map((d) => d.seat),
      ...spots.lounge.map((s) => ({ x: s.x, y: s.y })),
    ];

    for (let i = 0; i < points.length; i++) {
      for (let j = 0; j < points.length; j++) {
        const path = L.pathBetween(points[i], points[j]);
        assert.ok(path.length >= 2, 'path has waypoints');
        for (const p of path) {
          assert.ok(insideRoom(L, p), 'path waypoint inside room n=' + n);
        }
      }
    }
  }
});

function benchRows(seats) {
  const rows = new Map();
  for (const seat of seats) {
    const row = rows.get(seat.y) || [];
    row.push(seat);
    rows.set(seat.y, row);
  }
  return [...rows.values()];
}

test('bench seats spread across the row with minimum spacing', async () => {
  const L = await layout();
  for (const n of [8, 15, 20, 28]) {
    const seats = L.benchSeats(n);
    assert.strictEqual(seats.length, n, 'bench seat count n=' + n);
    const rows = benchRows(seats);

    if (n <= 16) {
      assert.strictEqual(rows.length, 1, 'one bench row for n=' + n);
    } else {
      assert.ok(rows.length >= 2, 'a second bench row for n=' + n);
      const ys = [...new Set(seats.map((s) => s.y))].sort((a, b) => b - a);
      assert.strictEqual(ys[0] - ys[1], 16, 'second bench row is 16 px higher n=' + n);
    }

    const minGap = n <= 16 ? 26 : 22;
    for (const row of rows) {
      const xs = row.map((s) => s.x).sort((a, b) => a - b);
      for (let i = 1; i < xs.length; i++) {
        const gap = xs[i] - xs[i - 1];
        assert.ok(gap >= minGap, 'bench gap ' + gap + ' >= ' + minGap + ' n=' + n);
      }
    }
  }
});
