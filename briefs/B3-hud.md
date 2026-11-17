# B3 — HUD: page shell and usage panels

## Objective
`public/index.html`, `public/css/style.css` and `public/js/hud.js` provide the
overlay described in `docs/SPEC.md` section 8, driven only by the `/api/state`
object of section 2.

## Read first
- `AGENTS.md`
- `docs/SPEC.md` sections 2 and 8 (and section 7 only for how `main.js` calls you)
- `config/roster.json` for real names and roles

## Files you may change
- `public/index.html`, `public/css/style.css`, `public/js/hud.js`
- `public/hud-preview.html`, `public/js/hud-fixture.js` (a standalone preview page that
  imports `hud.js` and feeds it a hard-coded state covering: 2 working opencode agents,
  several idle, 1 guest, 1 Claude agent reviewing, 1 Claude idle, 10 events, large and
  zero usage numbers)

## Constraints
- ES modules, no libraries, no web fonts, no external URLs.
- `index.html` must contain `<canvas id="office"></canvas>`, `<div id="hud"></div>` and
  `<script type="module" src="js/main.js"></script>`. Do not write `main.js`,
  `office.js` or `sprites.js`; they belong to other workers.
- `update(state)` is called every 2 s: update the DOM in place or rebuild cheaply,
  without losing the collapsed state of panels or the open detail card, and without
  flicker. Escape all text taken from the state (`task`, `text`, names) before it
  reaches `innerHTML`.
- Pixel-art look: dark navy translucent panels, 2 px solid light border, hard
  corners, hard 2 px drop shadow, monospace uppercase headings, no blur, no rounded
  corners, no gradients. State colours: working = green, idle = grey, reviewing = amber.
- Layout must work from 1280x720 up to 2560x1440 and leave the centre of the screen
  free for the office. Side panels at most 300 px wide, scroll inside if long.
- Vietnamese labels. Number formats exactly as the SPEC says; write a small pure
  `formatTokens(n)` and export it.

## Done when
1. `node -e "import('./public/js/hud.js').then(m=>{for (const n of [0,999,1000,931000,1250000,12345678]) console.log(n, m.formatTokens(n))})"`
   prints `0`, `999`, `1K`, `931K`, `1.25M`, `12.3M` (the module must import under Node:
   no DOM access at import time).
2. `node --check public/js/hud.js` and `node --check public/js/hud-fixture.js` pass.
3. Read your `index.html` and `hud-preview.html` once more and confirm every id and
   import path they reference exists. State plainly that you did not see it in a
   browser (you cannot); the orchestrator will.

## Return
The report block from `AGENTS.md`.
