# B5 — Scene fixes after the first browser check

## Objective
The office scene already renders and animates. Fix the four problems the
orchestrator saw in the browser, without changing anything else.

## Read first
- `AGENTS.md`
- `docs/SPEC.md` section 7
- `public/js/layout.js`, `public/js/office.js`, `test/layout.test.js` (all exist and work)

## Files you may change
- `public/js/layout.js`, `public/js/office.js`, `test/layout.test.js`
- Nothing else. `main.js`, `sprites.js`, `hud.js`, CSS and HTML are being edited by
  someone else right now.

## Problems to fix
1. **Bench crowding.** All idle agents sit bunched at the left end of the bench row,
   so their nameplates overlap and cannot be read. `benchSeats(n)` must spread the
   seats over the whole bench row (all benches), left to right, with at least 26 art
   px between neighbouring seats when n <= 16; for larger n, use a second row of
   seats 16 px above the first rather than squeezing below 22 px.
2. **Nameplate overlap.** Neighbouring seated characters (bench and manager sofa)
   alternate their nameplate height: even seat index at the normal height, odd seat
   index 9 art px higher. Nameplates at desks stay as they are.
3. **Manager corner overlap.** Claude agents in the manager corner overlap each other
   and their nameplates collide ("OPUS" is drawn over "FABLE"). `managerSpots()` must
   return distinct spots at least 26 px apart: one seat behind the manager desk for
   the first working Claude agent, standing spots beside the desk for further working
   ones, and sofa seats for idle ones (at least 4 sofa seats, more rows if needed).
4. **Many agents.** The real data has 19 agents (15 opencode, 4 Claude) and may have
   more. Check `deskSlots(n)` and `benchSeats(n)` for n = 15, 20, 28: everything stays
   inside the 480x270 room and out of the manager corner.

## Constraints
- Keep every exported name and signature of `layout.js` and the `Office` class.
- Keep the rules in `briefs/B4-scene.md` (textures, whole-pixel positions, no teleporting).
- No new files except tests inside `test/layout.test.js`.

## Done when
1. `node --test test/layout.test.js` passes, with new tests for: minimum bench-seat
   spacing for n = 8, 15, 20, 28; manager spots pairwise at least 26 px apart for 6
   Claude agents; all coordinates inside the room.
2. `node --check public/js/office.js` and `node --check public/js/layout.js` pass.
3. State plainly that you did not see it in a browser.

## Return
The report block from `AGENTS.md`.
