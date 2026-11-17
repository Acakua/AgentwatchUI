# C2 — Pixel art: redraw every prop, add the new ones

## Objective
Every prop in `public/js/sprites.js` looks like finished, charming pixel art in
one consistent style, and the round-2 props of `docs/SPEC.md` section 9.2 exist.
Attached to this message are the current renders: `props.png` (each prop alone,
8x) and `scene.png` (a mock-up room, 5x). Study them before you start.

## Read first
- `AGENTS.md`
- `docs/SPEC.md` sections 6 and 9.2
- `public/js/sprites.js` (the whole file)

## Files you may change
- `public/js/sprites.js` only. **Do not change** `drawCharacter`, `outlineAndMirror`,
  `characterSheet`, `CHAR_*`, or any export name or sprite size.

## What is wrong now (from the orchestrator, who can see the renders)
1. The props are flat: one fill colour and one darker band. No light source, no
   highlights, no outline, so they look like blocks next to the outlined characters.
2. Desk: the monitor floats, there is no keyboard, mouse or mug; the "screen on" state
   is a cyan rectangle with a dark squiggle.
3. Manager desk: reads as a brown box; paper and mug are blobs.
4. Bench: two planks and eight sticks. It should read as a waiting-room bench with a
   backrest and seat cushions.
5. Chair: a brown stool shape; make it an office chair (seat, back, one stem, wheels).
6. Floor: speckled brown noise. Make warm wooden planks (horizontal boards with
   staggered joints, 2 tones, subtle) that tile seamlessly in a 16x16 tile.
7. Wall: beige dots. Make a calm painted wall with a darker skirting board at the
   bottom and a faint shadow line under the ceiling; must tile horizontally.
8. Plant: a green cross on a stick. Make a leafy potted plant with 3 greens.
9. Window: four blue panes. Add a frame with a sill, sky gradient done with 2-3 flat
   bands, a cloud, a glint.
10. Rug: three nested rectangles. Add a woven pattern and fringe at the short ends.
11. Bubbles: the icons are unreadable at 12x12. Redraw each as a white rounded bubble
    with a 1 px dark outline and a tail at the bottom, with a clear icon: `code` = `</>`
    or three coloured lines, `review` = magnifying glass, `zzz` = Z, `ok` = green tick,
    `alert` = red `!`, `quota` = hourglass (new).
12. Nameplate: fine, but the M glyph reads as H ("GLM" looks like "GLH"). Fix M, W, N.
13. The round-2 props are grey placeholders (function `stub`): draw them properly and
    delete `stub`. Keep `drawShadow` semi-transparent.

## Style rules
- Light comes from the top-left. Each surface gets a base, a highlight on top/left
  edges, a shadow on bottom/right edges.
- 1 px outline in `#1a1a2e` around every prop except floor tile, wall tile, rug and shadow.
- Use the existing `PALETTE`; you may add up to 12 colours to it. No pure black, no
  pure white (`#f4f1e8` is the paper white).
- Front-facing 3/4 view like classic 16-bit office or RPG interiors: you see the front
  face of furniture and a thin slice of its top.
- Same canvas API limits as before: `fillStyle`, `fillRect`, `clearRect`,
  `drawImage(canvas, dx, dy)`, `getImageData`, `putImageData`. No paths or text.
- Deterministic. Exact sizes from the SPEC.

## Done when
1. `node orchestra/render-sprites.js` prints `wrote ...` with no `SIZE MISMATCH` and no
   `RENDER FAILED`.
2. `node -e "import('./public/js/sprites.js').then(m=>console.log(Object.keys(m).length, typeof m.stub))"`
   prints a count of at least 28 and `undefined`.
3. You cannot open the new PNGs yourself. Say so. The orchestrator will render them,
   look, and come back to you with the images attached.

## Return
The report block from `AGENTS.md`, plus one line per prop saying what you changed.
