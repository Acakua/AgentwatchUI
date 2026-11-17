# C3 — Scene: Claude agents at their own computers, richer room

## Objective
In the office scene every Claude agent has its own desk and computer in the
manager corner and sits at it correctly while working. The room uses the new
decor sprites and shows quota-blocked agents. Contract: `docs/SPEC.md` sections
7 and 9.3.

## Read first
- `AGENTS.md`
- `docs/SPEC.md` sections 2, 7, 9.1 (only the two new fields), 9.2, 9.3
- `public/js/layout.js`, `public/js/office.js`, `public/js/demo-state.js`, `test/layout.test.js`
- `public/js/sprites.js`: only the list of exports and their sizes (the art is being
  redrawn by another worker right now; names and sizes will not change)

## Files you may change
- `public/js/layout.js`, `public/js/office.js`, `public/js/demo-state.js`, `test/layout.test.js`
- Nothing else. `sprites.js`, `main.js`, `hud.js`, CSS, `lib/` belong to others.

## The bug to fix first
A working Claude agent is placed at `{ x: deskX + 24, y: deskY + 10 }`, which draws it
half inside the manager desk, not seated at the computer, and any further working
Claude agent just stands beside the desk. Look at how an opencode worker is seated at
a worker desk (position relative to the desk, pose, facing, draw order, screen on)
and make Claude agents sit at their desks in **exactly the same way**.

## Required layout
- The manager corner stays top-right. Enlarge `MANAGER_CORNER` as needed (keep worker
  desks for at least 16 opencode agents outside it; adjust the worker grid if needed).
- `managerSpots(n)` takes the number of Claude agents and returns, for each index, a
  desk: index 0 → the big manager desk (48x24, `drawManagerDesk`); index 1.. → ordinary
  desks (32x24, `drawDesk`), arranged in rows inside the corner, at least 6 supported.
  Each entry: `{ desk: {x, y, w, h, big}, seat: {x, y}, review: {x, y} }`.
  Also `lounge`: sofa positions and seats for idle Claude agents (at least 6 seats).
- Each Claude desk has its own mesh and its own screen on/off state (on only while
  that agent is `working`).
- Claude agent `working` → sits at its own desk. `idle` → lounge sofa.
  `reviewing` → walks to the target worker's desk as today, then returns to wherever
  its state says.
- Decor from the round-2 sprites, placed in `layout.js` as data (`decor()` returning
  `[{ sprite: 'bookshelf', x, y }, ...]`): door and clock and whiteboard and poster on
  the wall, bookshelf and water cooler along the walls, sofa and coffee table in the
  lounge, plants. Nothing may cover a seat, a desk or a walking corridor.
- A `drawShadow` sprite under every character (follows it) and under desks.
- An agent with `blockedUntil > state.now`: while idle it shows the `quota` bubble
  instead of `zzz`, and its nameplate material has `opacity = 0.55`.
- `demo-state.js`: add `quota` (BytePlus blocked for the first 40 s of the demo, then
  cleared) and `blockedUntil` on agents so this can be seen with `?demo=1`.

## Constraints
- Keep the `Office` class API (`setState`, `update`, `render`, `resize`, `onHover`,
  `onSelect`) and every rule of `briefs/B4-scene.md` (textures, whole-pixel positions,
  no teleporting after the first state, dispose what you remove).
- Missing fields must not break the scene: `state.quota` or `blockedUntil` may be absent.
- `office.js` may be split: you may create `public/js/office-room.js` for the static
  room and decor if `office.js` would pass 500 lines (add it to your changed files).

## Done when
1. `node --test test/layout.test.js` passes, with new tests: for n = 1, 4, 6 Claude
   agents every desk is inside the manager corner, no two desks overlap, every seat is
   in the same position relative to its desk as a worker seat is to a worker desk,
   lounge seats are at least 14 px apart, no decor rectangle overlaps a desk or seat,
   worker desks for n = 16 do not overlap the corner.
2. `node --check` passes for every file you wrote; `npm test` still passes.
3. State plainly that you did not see it in a browser.

## Return
The report block from `AGENTS.md`, plus an ASCII sketch of the manager corner with coordinates.
