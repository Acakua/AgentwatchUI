# C4 — HUD: show quota limits and reset times

## Objective
The HUD shows, for each provider that hit a usage limit, when the limit lifts,
exactly as `docs/SPEC.md` section 9.4 describes, using the `quota` array and the
per-agent `blockedUntil` of section 9.1.

## Read first
- `AGENTS.md`
- `docs/SPEC.md` sections 2, 8, 9.1, 9.4
- `public/js/hud.js`, `public/css/style.css` (read the last block of the CSS: the
  HUD is a dock at the bottom of the window), `public/js/hud-fixture.js`

## Files you may change
- `public/js/hud.js`, `public/css/style.css`, `public/js/hud-fixture.js`
- `test/hud.test.js` (new)

## Constraints
- Keep every exported function of `hud.js` and its behaviour; `state.quota` and
  `agent.blockedUntil` may be missing (older backend): then nothing new is shown.
- Add and export two pure helpers and use them for rendering:
  `formatClock(ms)` → local `HH:MM`; `formatRemaining(ms)` → `2g 15p`, `15p`, `<1p`
  (g = giờ, p = phút; negative or zero → `0p`).
- Quota lines go inside the matching panel body, directly under the totals, one per
  entry of that group, class `hud-quota`, with `is-blocked` (amber `#f2b63d`) or
  `is-restored` (grey). Text exactly:
  `HẾT HẠN MỨC · <label> · hồi HH:MM (còn 2g 15p)` when blocked and `resetAt > 0`;
  `HẾT HẠN MỨC · <label> · chưa rõ giờ hồi` when blocked and `resetAt` is 0;
  `Đã hồi lúc HH:MM · <label>` when not blocked and `resetAt` is within the last 6 hours;
  otherwise the entry is not shown.
- Agent rows: when `agent.blockedUntil > state.now` and the agent is not `working` or
  `reviewing`, the state label reads `HẾT HẠN MỨC` with class `is-blocked`; the detail
  card gets a row `Hồi hạn mức: HH:MM (còn …)`.
- The remaining time must stay correct between polls: compute it from `state.now`
  plus the time elapsed since the state arrived (no extra timers needed beyond the
  existing 2 s update; recompute on each `update`).
- Escape `label` and `text` before they reach `innerHTML`. Pixel look as the rest
  (no rounded corners, no gradients).
- Add to the fixture: one blocked opencode provider (reset in 2 h 15 min), one
  restored Claude entry (reset 30 min ago), and `blockedUntil` on the matching agents.

## Done when
1. `node --test test/hud.test.js` passes: `formatRemaining` for 0, 59 999, 60 000,
   8 100 000 (→ `2g 15p`), negative; `formatClock` for a fixed local time; the module
   imports under Node without touching the DOM.
2. `node --check` passes for the three JS files; `npm test` still passes.
3. State plainly that you did not see it in a browser.

## Return
The report block from `AGENTS.md`.
