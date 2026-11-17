# B2 — Pixel art: procedural sprites

## Objective
`public/js/sprites.js` exports every function in `docs/SPEC.md` section 6 and the
art looks like a coherent, charming pixel-art office: readable little people,
desks with computers, a waiting bench, a manager's corner.

## Read first
- `AGENTS.md`
- `docs/SPEC.md` section 6 (the API you must implement) and section 7 (how the
  sprites will be used, so you know what each pose is for)
- `orchestra/render-sprites.js` (the preview tool; read its header comment)

## Files you may change
- `public/js/sprites.js` only.

## Constraints
- ES module. No imports. Create canvases with `document.createElement('canvas')`.
- Use **only** this 2D context API, because the preview tool implements nothing else:
  `fillStyle` (hex or `rgba()`), `fillRect`, `clearRect`, `drawImage(canvas, dx, dy)`,
  `getImageData`, `putImageData`. No paths, arcs, text, gradients, transforms,
  `save/restore`, `scale`. Mirror a sprite by copying pixels yourself.
- A good way to work: describe each sprite as rows of characters mapped to palette
  colours (a small string grid per pose) and blit pixel by pixel. Keep the palette
  small (about 24 colours) and export it as `PALETTE`.
- Exact sizes from the SPEC. Transparent background except floor and wall tiles.
- Characters: 16x24, big head (about 10 px tall), 1 px dark outline, 2 px eyes, visible
  hair colour, shirt in the given `shirt` colour with a darker shade you derive.
  The 4 facings must be clearly different (`up` shows the back of the head, no face).
  `walk1`/`walk2` move the legs; `type1`/`type2` move the arms; `sit` has bent legs;
  `sleep` has closed eyes and a tilted head; `review1`/`review2` hold a clipboard.
- The nameplate font: draw your own 3x5 pixel glyphs for A-Z, 0-9, space, `.`, `-`, `/`
  (uppercase the input). White text on a dark pill with a 1 px border in `color`.
- Deterministic: no `Math.random()` at call time (floor tile speckles may use a fixed
  seeded pattern).

## Done when
1. `node orchestra/render-sprites.js` prints `wrote ...` with **no** `SIZE MISMATCH`
   and no `RENDER FAILED` line.
2. **Look at the three PNG files it wrote** (`.orchestra/preview/chars.png`,
   `poses-down.png`, `props.png`) with your image-reading ability, and judge them
   honestly: Can you tell each pose apart? Does the face read as a face? Is the
   outline closed? Are the desk, monitor and bench recognisable? Fix what is wrong
   and render again. Do at least two look-and-fix rounds. In your report, describe
   what you saw in the final images in 5 to 8 lines. If you cannot view images, say
   so plainly under `RISKS` (do not pretend).

## Return
The report block from `AGENTS.md`.
