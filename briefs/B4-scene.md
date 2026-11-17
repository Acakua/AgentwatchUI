# B4 — Scene: the three.js office

## Objective
`public/js/office.js` and `public/js/main.js` render the pixel-art office of
`docs/SPEC.md` section 7 with three.js and animate every agent according to
`/api/state`.

## Read first
- `AGENTS.md`
- `docs/SPEC.md` sections 2, 6, 7, 8
- `public/js/sprites.js` (finished; use its real exports and sizes)
- `public/js/hud.js` and `public/index.html` (finished; call the real functions)
- `config/roster.json`

## Files you may change
- `public/js/office.js`, `public/js/main.js`
- `public/js/demo-state.js` (the fake state generator for `?demo=1`)
- `public/js/layout.js` (pure functions: desk positions, bench seats, paths; no three.js import)
- `test/layout.test.js`

## Constraints
- `import * as THREE from '../vendor/three.module.js'` (r170). No other libraries.
- Room is 480x270 art pixels. Orthographic camera, y up; one art pixel = one world
  unit; integer zoom (`Math.max(1, Math.floor(Math.min(w/480, h/270)))`), room centred,
  dark background outside the room. `renderer.setPixelRatio(1)`; canvas CSS
  `image-rendering: pixelated`.
- Every texture: `THREE.CanvasTexture`, `magFilter = minFilter = THREE.NearestFilter`,
  `generateMipmaps = false`, `colorSpace = THREE.SRGBColorSpace`. Materials:
  `MeshBasicMaterial({ map, transparent: true, alphaTest: 0.5 })`. Sprites are planes
  sized exactly to their canvas and positioned on whole pixels (round positions) so
  nothing blurs. Use `renderOrder` or z from y for depth sorting.
- Character animation: build one `characterSheet` texture per agent and move
  `texture.offset/repeat` to pick the frame (do not create a texture per frame).
  Pose animation runs at 4 fps. Pick hair and skin deterministically from a hash of
  the agent id.
- `layout.js` owns all coordinates: `deskSlots(n)`, `benchSeats(n)`, `managerSpots()`,
  `reviewSpot(deskIndex, n)`, `pathBetween(a, b)` (list of waypoints via the corridor).
  Desks for at least 12 opencode agents without overlapping the manager corner; if the
  roster has more, add rows or shrink spacing. Desk assignment is stable: the agent's
  index among opencode agents in `state.agents` is its desk index.
- State changes drive a small state machine per character:
  bench seat → walking → desk seat, and back; `reviewing` for Claude agents as the SPEC
  says. A state that flips back while walking must redirect smoothly, never teleport.
  The first `setState` call places everyone instantly (no mass walk-in).
- Agents that disappear from the state are removed; new ones are added.
- `main.js` follows SPEC section 7 including `?demo=1`. In demo mode the fake state
  must have the exact `/api/state` shape and use the ids of `config/roster.json`
  (the server does not serve `config/`; hard-code a copy of the roster in `demo-state.js`).
- No allocations in `update` that grow without bound; dispose textures of removed agents.

## Done when
1. `node --test test/layout.test.js` passes: no two desk slots overlap; all slots
   inside the room and outside the manager corner; bench seats distinct; every
   `pathBetween` waypoint inside the room; works for n = 1, 12, 20.
2. `node --check` passes for each file you wrote.
3. `node -e "import('./public/js/layout.js').then(m=>console.log(Object.keys(m)))"` lists the functions above.
4. State plainly that you did not see it in a browser (you cannot); the orchestrator will.

## Return
The report block from `AGENTS.md`, plus a short ASCII sketch of the room layout with coordinates.
