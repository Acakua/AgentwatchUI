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

const COUNTS = [1, 12, 20];

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

test('manager spots stay in the corner', async () => {
  const L = await layout();
  const spots = L.managerSpots();
  for (const rect of [spots.desk, spots.rug, spots.sofa]) {
    assert.ok(rect.x >= L.MANAGER_CORNER.x, 'manager furniture in corner x');
    assert.ok(rect.x + rect.w <= L.ROOM_W, 'manager furniture inside room x');
    assert.ok(rect.y >= L.MANAGER_CORNER.y, 'manager furniture in corner y');
    assert.ok(rect.y + rect.h <= L.ROOM_H, 'manager furniture inside room y');
  }
  assert.ok(spots.work.length >= 4);
  assert.ok(spots.idle.length >= 4);
  for (const p of spots.work.concat(spots.idle)) {
    assert.ok(insideRect(L.MANAGER_CORNER, p), 'manager spot inside corner');
    assert.ok(insideRoom(L, p), 'manager spot inside room');
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
    const spots = L.managerSpots();
    const points = [
      { x: 8, y: 8 },
      { x: L.ROOM_W - 8, y: L.ROOM_H - 8 },
      { x: 240, y: 135 },
      ...slots.map((s) => s.seat),
      ...slots.map((s) => s.stand),
      ...bench.map((s) => ({ x: s.x, y: s.y })),
      ...spots.work,
      ...spots.idle,
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

test('manager spots are at least 26 px apart for six Claude agents', async () => {
  const L = await layout();
  const spots = L.managerSpots();
  const all = spots.work.concat(spots.idle);
  assert.ok(all.length >= 6, 'enough manager spots');
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const dx = all[i].x - all[j].x;
      const dy = all[i].y - all[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      assert.ok(dist >= 26, 'manager spot distance ' + dist + ' for pair ' + i + '/' + j);
    }
  }
});

test('many agents stay inside the room and out of the manager corner', async () => {
  const L = await layout();
  for (const n of [15, 20, 28]) {
    for (const slot of L.deskSlots(n)) {
      assert.ok(!rectsOverlap(slot.desk, L.MANAGER_CORNER), 'desk outside manager corner n=' + n);
      const points = [
        { x: slot.desk.x, y: slot.desk.y },
        { x: slot.desk.x + slot.desk.w, y: slot.desk.y + slot.desk.h },
        slot.seat,
        slot.stand,
        slot.chair,
      ];
      for (const p of points) {
        assert.ok(insideRoom(L, p), 'desk point inside room n=' + n);
        assert.ok(!insideRect(L.MANAGER_CORNER, p), 'desk point outside manager corner n=' + n);
      }
    }

    for (const seat of L.benchSeats(n)) {
      assert.ok(insideRoom(L, seat), 'bench seat inside room n=' + n);
      assert.ok(!insideRect(L.MANAGER_CORNER, seat), 'bench seat outside manager corner n=' + n);
      assert.ok(seat.benchX >= 0 && seat.benchX + L.BENCH_W <= L.ROOM_W, 'bench inside room n=' + n);
    }
  }
});
