export const CHAR_W = 16;
export const CHAR_H = 24;
export const CHAR_POSES = ['stand','walk1','walk2','sit','type1','type2','review1','review2','sleep'];

export const OUTLINE_COLOR = '#1a1a2e';
export const PAPER_WHITE = '#f4f1e8';

export const PALETTE = {
  outline: '#1a1a2e',
  skin: '#f2c9a0',
  skinShadow: '#d4a574',
  hairBrown: '#3b2a1a',
  hairBlonde: '#d9d9d9',
  hairRed: '#b5402a',
  shirtBlue: '#4fb3ff',
  shirtOrange: '#e8833a',
  shirtGreen: '#7ac74f',
  pantsDark: '#2d3748',
  shoes: '#1a1a2e',
  floor: '#8b7355',
  floorDark: '#7a6248',
  wall: '#c9b896',
  wallDark: '#b8a785',
  wood: '#8b5a2b',
  woodLight: '#a0522d',
  woodDark: '#654321',
  metal: '#708090',
  metalDark: '#4a5568',
  screen: '#1a202c',
  screenGlow: '#4fd1c5',
  glass: '#87ceeb',
  glassDark: '#5dade2',
  plant: '#228b22',
  plantDark: '#196619',
  rug: '#8b4513',
  rugPattern: '#cd853f',
  white: '#ffffff',
  black: '#000000',
  red: '#e53e3e',
  yellow: '#ecc94b',
  green: '#38a169',
  paper: '#f5f0e6',
  mug: '#e2e8f0',
  ivory: PAPER_WHITE,
  woodHi: '#c98a4b',
  metalHi: '#a9b8c6',
  skyHi: '#bfdff0',
  cloud: '#eef3f7',
  cushion: '#3f7d8c',
  cushionHi: '#59a1b0',
  cushionSh: '#2b5a66',
  plantHi: '#3cb43c',
  rugFringe: '#e3cda6',
  ink: '#2b3a4a',
  purple: '#805ad5',
};

function createCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16)
  };
}

function darkerShade(hex, amount = 0.6) {
  const c = hexToRgb(hex);
  const r = Math.floor(c.r * amount);
  const g = Math.floor(c.g * amount);
  const b = Math.floor(c.b * amount);
  return `rgba(${r},${g},${b},1)`;
}

// Characters are drawn from rectangles, then outlined automatically. Rewritten by
// the orchestrator after two art rounds: the string-grid version had weak bodies.
const C_OUT = '#1a1a2e', C_PANTS = '#34405a', C_SHOE = '#15151f', C_PAPER = '#f4f1e8', C_INK = '#8a8f9c';

function outlineAndMirror(c, mirror) {
  const ctx = c.getContext('2d');
  const w = c.width, h = c.height;
  const src = ctx.getImageData(0, 0, w, h);
  const out = ctx.getImageData(0, 0, w, h);
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src.data[(y * w + x) * 4 + 3] > 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (solid(x, y)) continue;
    if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
      const i = (y * w + x) * 4;
      out.data[i] = 0x1a; out.data[i + 1] = 0x1a; out.data[i + 2] = 0x2e; out.data[i + 3] = 255;
    }
  }
  if (mirror) {
    const m = ctx.getImageData(0, 0, w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const a = (y * w + x) * 4, b = (y * w + (w - 1 - x)) * 4;
      for (let k = 0; k < 4; k++) m.data[a + k] = out.data[b + k];
    }
    ctx.putImageData(m, 0, 0);
  } else ctx.putImageData(out, 0, 0);
  return c;
}

export function drawCharacter({ pose = 'stand', shirt = '#4fb3ff', hair = '#3b2a1a', skin = '#f2c9a0', facing = 'down' } = {}) {
  const c = createCanvas(CHAR_W, CHAR_H);
  const ctx = c.getContext('2d');
  const px = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  const shade = darkerShade(shirt, 0.72), hairD = darkerShade(hair, 0.72), skinD = darkerShade(skin, 0.8);
  const seated = pose === 'sit' || pose === 'type1' || pose === 'type2' || pose === 'sleep';
  const typing = pose === 'type1' || pose === 'type2';
  const review = pose === 'review1' || pose === 'review2';
  const alt = pose === 'walk2' || pose === 'type2' || pose === 'review2';
  const walking = pose === 'walk1' || pose === 'walk2';
  const by = seated ? 2 : 0;                    // seated figures are lower
  const hy = by + (pose === 'sleep' ? 1 : 0);   // sleeping head droops
  const hx = pose === 'sleep' ? 1 : 0;
  const side = facing === 'left' || facing === 'right';

  if (!side) {
    // legs
    if (seated) {
      px(4, 18 + by, 8, 1, C_PANTS);
      px(4, 19 + by, 3, 1, C_PANTS); px(9, 19 + by, 3, 1, C_PANTS);
      px(4, 20 + by, 3, 1, C_SHOE); px(9, 20 + by, 3, 1, C_SHOE);
    } else {
      const l = walking && alt ? 1 : 0, r = walking && !alt ? 1 : 0;   // lifted leg is shorter
      px(5, 18, 3, 4 - l, C_PANTS); px(8, 18, 3, 4 - r, C_PANTS);
      px(4, 22 - l, 4, 1, C_SHOE); px(8, 22 - r, 4, 1, C_SHOE);
    }
    // torso
    px(4, 12 + by, 8, 6, shirt);
    px(10, 12 + by, 2, 6, shade); px(4, 17 + by, 8, 1, shade);
    px(6, 11 + by, 4, 1, facing === 'up' ? hairD : skinD);            // neck
    // arms
    const swingL = walking ? (alt ? 1 : -1) : 0;
    if (typing && facing === 'down') {
      px(3, 12 + by, 1, 3, shirt); px(12, 12 + by, 1, 3, shade);
      px(5, 15 + by - (alt ? 0 : 1), 2, 1, skin); px(9, 15 + by - (alt ? 1 : 0), 2, 1, skin);
    } else if (typing) {
      // from behind: elbows out, hands reach forward to the keyboard
      px(3, 12 + by, 1, 2, shirt); px(12, 12 + by, 1, 2, shade);
      px(2, 11 + by - (alt ? 0 : 1), 2, 1, skin); px(12, 11 + by - (alt ? 1 : 0), 2, 1, skin);
    } else if (review && facing === 'down') {
      px(3, 12, 1, alt ? 2 : 4, shirt); px(3, alt ? 11 : 16, 1, 1, skin);  // free hand, raised on review2
      px(12, 12, 1, 3, shade);
      const cy = alt ? 12 : 13;
      px(8, cy, 5, 6, C_PAPER); px(9, cy + 1, 3, 1, C_INK); px(9, cy + 3, 3, 1, C_INK); px(10, cy - 1, 1, 1, C_INK);
    } else if (review) {
      px(3, 12, 1, 4, shirt); px(3, 16, 1, 1, skin);
      px(12, 12, 1, 3, shade); px(12, alt ? 12 : 13, 2, 4, C_PAPER);
    } else {
      px(3, 12 + by, 1, 4 + (seated ? 0 : swingL), shirt); px(3, 16 + by + (seated ? 0 : swingL), 1, 1, skin);
      px(12, 12 + by, 1, 4 - (seated ? 0 : swingL), shade); px(12, 16 + by - (seated ? 0 : swingL), 1, 1, skin);
    }
    // head: 10 wide, 10 tall
    const X = 3 + hx, Y = 1 + hy;
    if (facing === 'up') {
      px(X + 1, Y, 8, 1, hair); px(X, Y + 1, 10, 8, hair); px(X + 1, Y + 9, 8, 1, hairD);
      px(X + 7, Y + 2, 2, 6, hairD);
    } else {
      px(X, Y + 2, 10, 7, skin); px(X + 1, Y + 9, 8, 1, skin);
      px(X + 1, Y, 8, 1, hair); px(X, Y + 1, 10, 2, hair);
      px(X, Y + 3, 1, 3, hair); px(X + 9, Y + 3, 1, 3, hair);         // sideburns
      px(X + 1, Y + 3, 3, 1, hair); px(X + 7, Y + 1, 2, 1, hairD);    // fringe, shine
      if (pose === 'sleep') { px(X + 2, Y + 6, 2, 1, C_OUT); px(X + 6, Y + 6, 2, 1, C_OUT); }
      else { px(X + 3, Y + 5, 1, 2, C_OUT); px(X + 6, Y + 5, 1, 2, C_OUT); px(X + 4, Y + 8, 2, 1, skinD); }
      px(X + 1, Y + 7, 1, 1, skinD); px(X + 8, Y + 7, 1, 1, skinD);   // cheeks
    }
  } else {
    // drawn facing right, mirrored for left
    if (seated) {
      px(5, 18 + by, 7, 2, C_PANTS); px(10, 20 + by, 2, 1, C_PANTS); px(10, 20 + by, 3, 1, C_SHOE);
    } else if (walking) {
      const a = alt ? 1 : 0;
      px(5 + a, 18, 2, 4 - (a ? 0 : 1), C_PANTS); px(4 + a * 2, 22 - (a ? 0 : 1), 3, 1, C_SHOE);
      px(9 - a, 18, 2, 4 - a, C_PANTS); px(9 - a, 22 - a, 3, 1, C_SHOE);
    } else {
      px(6, 18, 4, 4, C_PANTS); px(6, 22, 5, 1, C_SHOE);
    }
    px(5, 12 + by, 6, 6, shirt); px(5, 12 + by, 2, 6, shade); px(5, 17 + by, 6, 1, shade);
    px(7, 11 + by, 3, 1, skinD);
    if (typing) { px(8, 14 + by, 4, 1, shade); px(12, 14 + by - (alt ? 1 : 0), 2, 1, skin); }
    else if (review) { px(8, 14, 3, 1, shade); px(11, alt ? 12 : 13, 3, 5, C_PAPER); px(12, (alt ? 12 : 13) + 1, 1, 1, C_INK); px(12, (alt ? 12 : 13) + 3, 1, 1, C_INK); }
    else { const s = walking ? (alt ? 1 : -1) : 0; px(7 + s, 13 + by, 2, 4, shade); px(7 + s, 17 + by, 2, 1, skin); }
    const X = 3 + hx, Y = 1 + hy;
    px(X, Y + 2, 10, 7, skin); px(X + 1, Y + 9, 8, 1, skin);
    px(X + 1, Y, 8, 1, hair); px(X, Y + 1, 10, 2, hair);
    px(X, Y + 3, 4, 5, hair); px(X + 4, Y + 3, 2, 1, hair); px(X + 1, Y + 8, 2, 1, hairD);
    if (pose === 'sleep') px(X + 6, Y + 6, 2, 1, C_OUT);
    else { px(X + 7, Y + 5, 1, 2, C_OUT); px(X + 8, Y + 8, 1, 1, skinD); }
  }
  return outlineAndMirror(c, facing === 'left');
}

export function characterSheet({ shirt, hair, skin }) {
  const w = CHAR_W * CHAR_POSES.length;
  const h = CHAR_H * 4;
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  const facings = ['down', 'up', 'left', 'right'];
  for (let f = 0; f < facings.length; f++) {
    for (let p = 0; p < CHAR_POSES.length; p++) {
      const char = drawCharacter({ pose: CHAR_POSES[p], shirt, hair, skin, facing: facings[f] });
      ctx.drawImage(char, p * CHAR_W, f * CHAR_H);
    }
  }
  return c;
}

// --- shared prop helpers ---------------------------------------------------
function r(ctx, x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); }

// Sticker outline: darkens transparent pixels that touch the silhouette.
function outlineProp(c) {
  const ctx = c.getContext('2d');
  const w = c.width, h = c.height;
  const src = ctx.getImageData(0, 0, w, h), out = ctx.getImageData(0, 0, w, h);
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src.data[(y * w + x) * 4 + 3] > 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (solid(x, y)) continue;
    if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
      const i = (y * w + x) * 4;
      out.data[i] = 0x1a; out.data[i + 1] = 0x1a; out.data[i + 2] = 0x2e; out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return c;
}

function screenContents(ctx, x, y, screenOn) {
  r(ctx, x, y, 12, 5, PALETTE.ink);
  r(ctx, x, y, 12, 1, PALETTE.metalDark);
  if (screenOn) {
    r(ctx, x + 1, y + 2, 3, 1, PALETTE.screenGlow);
    r(ctx, x + 5, y + 2, 2, 1, PALETTE.green);
    r(ctx, x + 1, y + 4, 4, 1, PALETTE.yellow);
    r(ctx, x + 6, y + 4, 4, 1, PALETTE.shirtBlue);
  } else {
    r(ctx, x + 1, y + 3, 4, 1, PALETTE.metalDark);
  }
}

export function drawDesk({ screenOn } = {}) {
  const c = createCanvas(32, 24), ctx = c.getContext('2d');
  r(ctx, 1, 9, 30, 4, PALETTE.wood);
  r(ctx, 1, 9, 30, 1, PALETTE.woodHi);
  r(ctx, 1, 12, 30, 1, PALETTE.woodDark);
  r(ctx, 2, 13, 28, 3, PALETTE.wood);
  r(ctx, 12, 14, 8, 2, PALETTE.woodDark);
  r(ctx, 15, 14, 2, 1, PALETTE.metalHi);
  r(ctx, 3, 13, 3, 9, PALETTE.woodDark); r(ctx, 3, 13, 1, 9, PALETTE.wood);
  r(ctx, 26, 13, 3, 9, PALETTE.woodDark); r(ctx, 26, 13, 1, 9, PALETTE.wood);
  r(ctx, 2, 21, 5, 1, PALETTE.woodDark); r(ctx, 25, 21, 5, 1, PALETTE.woodDark);
  r(ctx, 12, 10, 8, 1, PALETTE.metalDark);
  r(ctx, 15, 7, 2, 3, PALETTE.metal);
  r(ctx, 9, 1, 14, 7, PALETTE.metalDark);
  r(ctx, 9, 1, 14, 1, PALETTE.metalHi);
  screenContents(ctx, 10, 2, screenOn);
  r(ctx, 8, 11, 12, 2, PALETTE.mug);
  r(ctx, 8, 11, 12, 1, PALETTE.metalHi);
  for (let i = 0; i < 5; i++) r(ctx, 9 + i * 2, 12, 1, 1, PALETTE.metalDark);
  r(ctx, 21, 11, 3, 2, PALETTE.mug); r(ctx, 21, 11, 1, 1, PALETTE.metalHi);
  r(ctx, 25, 8, 4, 4, PALETTE.mug); r(ctx, 25, 8, 4, 1, PALETTE.ivory);
  r(ctx, 29, 9, 1, 2, PALETTE.mug); r(ctx, 26, 9, 2, 1, PALETTE.woodDark);
  return outlineProp(c);
}

export function drawManagerDesk({ screenOn } = {}) {
  const c = createCanvas(48, 24), ctx = c.getContext('2d');
  r(ctx, 1, 9, 46, 4, PALETTE.wood);
  r(ctx, 1, 9, 46, 1, PALETTE.woodHi);
  r(ctx, 1, 12, 46, 1, PALETTE.woodDark);
  r(ctx, 2, 13, 44, 4, PALETTE.wood);
  r(ctx, 4, 14, 11, 2, PALETTE.woodDark); r(ctx, 8, 14, 3, 1, PALETTE.metalHi);
  r(ctx, 33, 14, 11, 2, PALETTE.woodDark); r(ctx, 37, 14, 3, 1, PALETTE.metalHi);
  r(ctx, 16, 14, 16, 3, PALETTE.woodDark);
  r(ctx, 3, 13, 4, 9, PALETTE.woodDark); r(ctx, 3, 13, 1, 9, PALETTE.wood);
  r(ctx, 41, 13, 4, 9, PALETTE.woodDark); r(ctx, 41, 13, 1, 9, PALETTE.wood);
  r(ctx, 2, 21, 6, 1, PALETTE.woodDark); r(ctx, 40, 21, 6, 1, PALETTE.woodDark);
  r(ctx, 20, 10, 10, 1, PALETTE.metalDark);
  r(ctx, 24, 7, 2, 3, PALETTE.metal);
  r(ctx, 17, 1, 16, 7, PALETTE.metalDark);
  r(ctx, 17, 1, 16, 1, PALETTE.metalHi);
  r(ctx, 18, 2, 14, 5, PALETTE.ink);
  r(ctx, 18, 2, 14, 1, PALETTE.metalDark);
  if (screenOn) {
    r(ctx, 19, 4, 4, 1, PALETTE.screenGlow); r(ctx, 24, 4, 3, 1, PALETTE.green);
    r(ctx, 19, 5, 6, 1, PALETTE.yellow); r(ctx, 26, 5, 4, 1, PALETTE.shirtBlue);
  } else r(ctx, 19, 4, 5, 1, PALETTE.metalDark);
  r(ctx, 16, 11, 14, 2, PALETTE.mug); r(ctx, 16, 11, 14, 1, PALETTE.metalHi);
  for (let i = 0; i < 6; i++) r(ctx, 17 + i * 2, 12, 1, 1, PALETTE.metalDark);
  r(ctx, 31, 11, 3, 2, PALETTE.mug); r(ctx, 31, 11, 1, 1, PALETTE.metalHi);
  r(ctx, 3, 6, 11, 4, PALETTE.metalDark);
  r(ctx, 4, 7, 9, 2, PALETTE.ivory);
  r(ctx, 5, 7, 5, 1, PALETTE.outline); r(ctx, 5, 8, 6, 1, PALETTE.outline);
  r(ctx, 38, 8, 4, 4, PALETTE.mug); r(ctx, 38, 8, 4, 1, PALETTE.ivory);
  r(ctx, 42, 9, 1, 2, PALETTE.mug); r(ctx, 39, 9, 2, 1, PALETTE.woodDark);
  r(ctx, 44, 7, 3, 5, PALETTE.metal); r(ctx, 44, 7, 1, 5, PALETTE.metalHi);
  r(ctx, 44, 5, 1, 2, PALETTE.red); r(ctx, 46, 5, 1, 2, PALETTE.shirtBlue);
  return outlineProp(c);
}

export function drawChair() {
  const c = createCanvas(12, 14), ctx = c.getContext('2d');
  r(ctx, 3, 0, 6, 1, PALETTE.outline);
  r(ctx, 2, 1, 8, 1, PALETTE.outline);
  r(ctx, 1, 2, 10, 6, PALETTE.outline);
  r(ctx, 3, 1, 6, 1, PALETTE.cushion);
  r(ctx, 2, 2, 8, 4, PALETTE.cushion);
  r(ctx, 2, 2, 8, 1, PALETTE.cushionHi);
  r(ctx, 2, 2, 1, 4, PALETTE.cushionHi);
  r(ctx, 2, 6, 8, 1, PALETTE.cushionSh);
  r(ctx, 3, 7, 6, 1, PALETTE.woodDark);
  r(ctx, 1, 8, 10, 3, PALETTE.outline);
  r(ctx, 2, 8, 8, 2, PALETTE.cushion);
  r(ctx, 2, 8, 8, 1, PALETTE.cushionHi);
  r(ctx, 2, 10, 8, 1, PALETTE.cushionSh);
  r(ctx, 5, 11, 2, 2, PALETTE.metalDark);
  r(ctx, 3, 12, 6, 1, PALETTE.metalDark);
  r(ctx, 2, 13, 2, 1, PALETTE.outline); r(ctx, 5, 13, 2, 1, PALETTE.outline); r(ctx, 8, 13, 2, 1, PALETTE.outline);
  return outlineProp(c);
}

export function drawBench() {
  const c = createCanvas(64, 14), ctx = c.getContext('2d');
  r(ctx, 1, 1, 62, 2, PALETTE.wood); r(ctx, 1, 1, 62, 1, PALETTE.woodHi);
  const seats = [2, 17, 32, 47];
  for (const x of seats) {
    r(ctx, x, 3, 14, 4, PALETTE.cushion);
    r(ctx, x, 3, 14, 1, PALETTE.cushionHi);
    r(ctx, x, 6, 14, 1, PALETTE.cushionSh);
  }
  r(ctx, 1, 7, 62, 1, PALETTE.woodDark);
  r(ctx, 1, 9, 62, 2, PALETTE.wood); r(ctx, 1, 9, 62, 1, PALETTE.woodHi);
  for (const x of seats) { r(ctx, x, 8, 14, 2, PALETTE.cushion); r(ctx, x, 8, 14, 1, PALETTE.cushionHi); }
  for (const x of [4, 31, 58]) r(ctx, x, 11, 3, 3, PALETTE.woodDark);
  return outlineProp(c);
}

export function drawFloorTile() {
  const c = createCanvas(16, 16), ctx = c.getContext('2d');
  const joints = [6, 14, 2, 10];
  for (let row = 0; row < 4; row++) {
    const y = row * 4, j = joints[row];
    r(ctx, 0, y, 16, 4, PALETTE.floor);
    r(ctx, j + 1, y, 15 - j, 4, PALETTE.floorDark);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, y + 3, 16, 1);
    ctx.fillRect(j, y, 1, 2);
  }
  r(ctx, 9, 5, 2, 1, PALETTE.woodDark);
  return c;
}

export function drawWallTile() {
  const c = createCanvas(16, 24), ctx = c.getContext('2d');
  r(ctx, 0, 0, 16, 24, PALETTE.wall);
  r(ctx, 0, 2, 16, 7, PALETTE.rugFringe);
  r(ctx, 15, 0, 1, 20, PALETTE.wallDark);
  r(ctx, 0, 0, 16, 1, PALETTE.wallDark);
  r(ctx, 0, 20, 16, 4, PALETTE.wood);
  r(ctx, 0, 20, 16, 1, PALETTE.woodHi);
  r(ctx, 0, 23, 16, 1, PALETTE.woodDark);
  return c;
}

export function drawPlant() {
  const c = createCanvas(12, 20), ctx = c.getContext('2d');
  r(ctx, 3, 17, 6, 3, PALETTE.wood);
  r(ctx, 3, 19, 6, 1, PALETTE.woodDark);
  r(ctx, 3, 17, 1, 3, PALETTE.woodHi);
  r(ctx, 2, 15, 8, 2, PALETTE.rugPattern);
  r(ctx, 2, 15, 8, 1, PALETTE.woodHi);
  r(ctx, 5, 10, 2, 5, PALETTE.plantDark);
  r(ctx, 1, 10, 4, 2, PALETTE.plant); r(ctx, 1, 10, 2, 1, PALETTE.plantHi); r(ctx, 1, 11, 4, 1, PALETTE.plantDark);
  r(ctx, 7, 9, 4, 2, PALETTE.plant); r(ctx, 9, 9, 2, 1, PALETTE.plantHi); r(ctx, 7, 10, 4, 1, PALETTE.plantDark);
  r(ctx, 1, 7, 4, 3, PALETTE.plant); r(ctx, 1, 7, 2, 1, PALETTE.plantHi); r(ctx, 1, 9, 4, 1, PALETTE.plantDark);
  r(ctx, 7, 6, 4, 3, PALETTE.plant); r(ctx, 9, 6, 2, 1, PALETTE.plantHi); r(ctx, 7, 8, 4, 1, PALETTE.plantDark);
  r(ctx, 3, 4, 6, 5, PALETTE.plant); r(ctx, 3, 4, 2, 2, PALETTE.plantHi); r(ctx, 7, 8, 2, 1, PALETTE.plantDark);
  r(ctx, 4, 1, 4, 4, PALETTE.plantHi); r(ctx, 3, 2, 2, 2, PALETTE.plant);
  return outlineProp(c);
}

export function drawWindow() {
  const c = createCanvas(24, 20), ctx = c.getContext('2d');
  r(ctx, 0, 0, 24, 20, PALETTE.woodDark);
  r(ctx, 1, 1, 22, 17, PALETTE.glass);
  r(ctx, 2, 2, 20, 5, PALETTE.skyHi);
  r(ctx, 2, 7, 20, 5, PALETTE.glass);
  r(ctx, 2, 12, 20, 5, PALETTE.glassDark);
  r(ctx, 4, 4, 5, 2, PALETTE.cloud); r(ctx, 5, 3, 3, 1, PALETTE.cloud);
  r(ctx, 15, 5, 4, 2, PALETTE.cloud); r(ctx, 16, 4, 2, 1, PALETTE.cloud);
  r(ctx, 4, 12, 1, 3, PALETTE.cloud); r(ctx, 17, 5, 1, 3, PALETTE.cloud);
  r(ctx, 11, 2, 2, 15, PALETTE.wood); r(ctx, 11, 2, 1, 15, PALETTE.woodHi);
  r(ctx, 2, 9, 20, 2, PALETTE.wood); r(ctx, 2, 9, 20, 1, PALETTE.woodHi);
  r(ctx, 0, 0, 24, 1, PALETTE.woodHi); r(ctx, 0, 0, 1, 20, PALETTE.woodHi);
  r(ctx, 0, 17, 24, 2, PALETTE.woodLight); r(ctx, 0, 19, 24, 1, PALETTE.woodDark);
  return outlineProp(c);
}

export function drawRug() {
  const c = createCanvas(48, 32), ctx = c.getContext('2d');
  for (let y = 1; y < 32; y += 2) { r(ctx, 0, y, 2, 1, PALETTE.rugFringe); r(ctx, 46, y, 2, 1, PALETTE.rugFringe); }
  r(ctx, 2, 0, 44, 32, PALETTE.rug);
  r(ctx, 3, 1, 42, 30, PALETTE.rugPattern);
  r(ctx, 5, 3, 38, 26, PALETTE.rug);
  for (let y = 6, row = 0; y < 28; y += 4, row++) {
    for (let x = 8 + (row % 2) * 2; x < 44; x += 4) {
      r(ctx, x, y, 1, 1, PALETTE.rugFringe);
      r(ctx, x - 1, y + 1, 3, 1, PALETTE.rugPattern);
      r(ctx, x, y + 2, 1, 1, PALETTE.rugFringe);
    }
  }
  return c;
}

export function drawBubble(kind) {
  const c = createCanvas(12, 12), ctx = c.getContext('2d');
  r(ctx, 2, 0, 8, 1, PALETTE.ivory);
  r(ctx, 1, 1, 10, 6, PALETTE.ivory);
  r(ctx, 2, 7, 8, 1, PALETTE.ivory);
  r(ctx, 4, 7, 3, 1, PALETTE.ivory);
  r(ctx, 4, 8, 2, 1, PALETTE.ivory);
  r(ctx, 4, 9, 1, 1, PALETTE.ivory);
  if (kind === 'code') {
    r(ctx, 3, 2, 6, 1, PALETTE.shirtBlue);
    r(ctx, 3, 4, 4, 1, PALETTE.shirtOrange);
    r(ctx, 3, 6, 5, 1, PALETTE.green);
  } else if (kind === 'review') {
    r(ctx, 4, 1, 3, 1, PALETTE.outline);
    r(ctx, 3, 2, 5, 1, PALETTE.outline);
    r(ctx, 3, 3, 1, 2, PALETTE.outline); r(ctx, 7, 3, 1, 2, PALETTE.outline);
    r(ctx, 4, 5, 3, 1, PALETTE.outline);
    r(ctx, 4, 2, 3, 3, PALETTE.glass);
    r(ctx, 4, 2, 1, 1, PALETTE.ivory);
    r(ctx, 7, 5, 2, 1, PALETTE.outline); r(ctx, 8, 6, 1, 1, PALETTE.outline);
  } else if (kind === 'zzz') {
    r(ctx, 3, 2, 5, 1, PALETTE.purple); r(ctx, 6, 3, 1, 1, PALETTE.purple);
    r(ctx, 5, 4, 1, 1, PALETTE.purple); r(ctx, 4, 5, 1, 1, PALETTE.purple);
    r(ctx, 3, 6, 5, 1, PALETTE.purple);
  } else if (kind === 'ok') {
    r(ctx, 3, 4, 1, 2, PALETTE.green); r(ctx, 4, 5, 1, 1, PALETTE.green);
    r(ctx, 5, 4, 1, 1, PALETTE.green); r(ctx, 6, 3, 1, 1, PALETTE.green);
    r(ctx, 7, 2, 2, 1, PALETTE.green);
  } else if (kind === 'alert') {
    r(ctx, 5, 2, 2, 4, PALETTE.red); r(ctx, 5, 6, 2, 1, PALETTE.red);
  } else if (kind === 'quota') {
    r(ctx, 3, 1, 6, 1, PALETTE.outline); r(ctx, 3, 6, 6, 1, PALETTE.outline);
    r(ctx, 3, 2, 1, 1, PALETTE.outline); r(ctx, 4, 3, 1, 2, PALETTE.outline); r(ctx, 3, 5, 1, 1, PALETTE.outline);
    r(ctx, 8, 2, 1, 1, PALETTE.outline); r(ctx, 7, 3, 1, 2, PALETTE.outline); r(ctx, 8, 5, 1, 1, PALETTE.outline);
    r(ctx, 4, 2, 4, 1, PALETTE.yellow); r(ctx, 5, 3, 2, 1, PALETTE.yellow);
    r(ctx, 6, 4, 1, 1, PALETTE.yellow);
    r(ctx, 4, 5, 4, 1, PALETTE.yellow); r(ctx, 5, 5, 2, 1, PALETTE.shirtOrange);
  }
  return outlineProp(c);
}

const FONT = {
  'A': [' 11 ', '1  1', '1111', '1  1', '1  1'],
  'B': ['111 ', '1  1', '111 ', '1  1', '111 '],
  'C': [' 111', '1   ', '1   ', '1   ', ' 111'],
  'D': ['111 ', '1  1', '1  1', '1  1', '111 '],
  'E': ['1111', '1   ', '111 ', '1   ', '1111'],
  'F': ['1111', '1   ', '111 ', '1   ', '1   '],
  'G': [' 111', '1   ', '1 11', '1  1', ' 111'],
  'H': ['1  1', '1  1', '1111', '1  1', '1  1'],
  'I': [' 111', '  1 ', '  1 ', '  1 ', ' 111'],
  'J': ['  11', '   1', '   1', '1  1', ' 11 '],
  'K': ['1  1', '1 1 ', '11  ', '1 1 ', '1  1'],
  'L': ['1   ', '1   ', '1   ', '1   ', '1111'],
  'M': ['1   1', '11 11', '1 1 1', '1   1', '1   1'],
  'N': ['1   1', '11  1', '1 1 1', '1  11', '1   1'],
  'O': [' 11 ', '1  1', '1  1', '1  1', ' 11 '],
  'P': ['111 ', '1  1', '111 ', '1   ', '1   '],
  'Q': [' 11 ', '1  1', '1 11', '1 1 ', ' 111'],
  'R': ['111 ', '1  1', '111 ', '1 1 ', '1  1'],
  'S': [' 111', '1   ', ' 11 ', '   1', '111 '],
  'T': ['11111', '  1  ', '  1  ', '  1  ', '  1  '],
  'U': ['1  1', '1  1', '1  1', '1  1', ' 11 '],
  'V': ['1  1', '1  1', '1  1', ' 11 ', '  1 '],
  'W': ['1   1', '1   1', '1 1 1', '11 11', '1   1'],
  'X': ['1  1', ' 11 ', '  1 ', ' 11 ', '1  1'],
  'Y': ['1  1', '1  1', ' 11 ', '  1 ', '  1 '],
  'Z': ['1111', '   1', '  1 ', ' 1  ', '1111'],
  '0': [' 11 ', '1  1', '1  1', '1  1', ' 11 '],
  '1': ['  1 ', ' 11 ', '  1 ', '  1 ', ' 111'],
  '2': [' 11 ', '1  1', '   1', '  1 ', '1111'],
  '3': [' 11 ', '1  1', '  11', '1  1', ' 11 '],
  '4': ['  11', ' 1 1', '1111', '   1', '   1'],
  '5': ['1111', '1   ', '111 ', '   1', '111 '],
  '6': ['  11', ' 1  ', '111 ', '1  1', ' 11 '],
  '7': ['1111', '   1', '  1 ', ' 1  ', ' 1  '],
  '8': [' 11 ', '1  1', ' 11 ', '1  1', ' 11 '],
  '9': [' 11 ', '1  1', ' 111', '   1', ' 11 '],
  ' ': ['    ', '    ', '    ', '    ', '    '],
  '.': ['    ', '    ', '    ', '    ', ' 1  '],
  '-': ['    ', '    ', '111 ', '    ', '    '],
  '/': ['   1', '  1 ', ' 1  ', '1   ', '    '],
};

function measureText(text) {
  let w = 0;
  for (const ch of text) {
    const glyph = FONT[ch] || FONT[' '];
    w += glyph[0].length + 1;
  }
  return Math.max(1, w - 1);
}

export function drawNameplate(text, color) {
  text = text.toUpperCase();
  const textW = measureText(text);
  const w = textW + 4;
  const h = 9;
  const c = createCanvas(w, h), ctx = c.getContext('2d');
  r(ctx, 0, 0, w, h, PALETTE.outline);
  r(ctx, 1, 1, w - 2, h - 2, PALETTE.pantsDark);
  r(ctx, 0, 0, w, 1, color); r(ctx, 0, h - 1, w, 1, color);
  r(ctx, 0, 0, 1, h, color); r(ctx, w - 1, 0, 1, h, color);
  let x = 2;
  for (const ch of text) {
    const glyph = FONT[ch] || FONT[' '];
    for (let row = 0; row < glyph.length; row++) for (let col = 0; col < glyph[row].length; col++) {
      if (glyph[row][col] === '1') r(ctx, x + col, 2 + row, 1, 1, PALETTE.ivory);
    }
    x += glyph[0].length + 1;
  }
  return c;
}

// --- round 2 decor ---------------------------------------------------------
export function drawSofa() {
  const c = createCanvas(40, 18), ctx = c.getContext('2d');
  r(ctx, 1, 1, 38, 7, PALETTE.woodDark);
  for (const x of [3, 15, 27]) {
    r(ctx, x, 2, 10, 5, PALETTE.cushion);
    r(ctx, x, 2, 10, 1, PALETTE.cushionHi);
    r(ctx, x, 6, 10, 1, PALETTE.cushionSh);
  }
  r(ctx, 0, 6, 3, 8, PALETTE.wood);
  r(ctx, 0, 6, 1, 8, PALETTE.woodHi);
  r(ctx, 37, 6, 3, 8, PALETTE.wood);
  r(ctx, 39, 6, 1, 8, PALETTE.woodDark);
  r(ctx, 1, 9, 38, 5, PALETTE.woodDark);
  for (const x of [3, 15, 27]) {
    r(ctx, x, 9, 10, 4, PALETTE.cushion);
    r(ctx, x, 9, 10, 1, PALETTE.cushionHi);
    r(ctx, x, 12, 10, 1, PALETTE.cushionSh);
  }
  r(ctx, 2, 14, 36, 2, PALETTE.wood);
  r(ctx, 3, 16, 3, 2, PALETTE.woodDark); r(ctx, 34, 16, 3, 2, PALETTE.woodDark);
  return outlineProp(c);
}

export function drawBookshelf() {
  const c = createCanvas(24, 34), ctx = c.getContext('2d');
  r(ctx, 0, 0, 24, 34, PALETTE.wood);
  r(ctx, 1, 1, 22, 32, PALETTE.outline);
  for (const sy of [10, 19, 28]) r(ctx, 1, sy, 22, 2, PALETTE.wood);
  const cols = [PALETTE.red, PALETTE.yellow, PALETTE.green, PALETTE.shirtBlue, PALETTE.shirtOrange, PALETTE.rugPattern];
  const rows = [[2, 10], [12, 19], [21, 28], [30, 33]];
  for (let ri = 0; ri < rows.length; ri++) {
    const [top, bottom] = rows[ri];
    let x = 2, k = ri * 3;
    while (x < 22) {
      const bw = 2 + (k % 2), bh = (bottom - top) - (k % 3);
      r(ctx, x, bottom - bh, bw, bh, cols[k % cols.length]);
      r(ctx, x, bottom - bh, 1, bh, PALETTE.metalHi);
      x += bw + 1; k++;
    }
  }
  r(ctx, 0, 0, 1, 34, PALETTE.woodHi);
  r(ctx, 23, 0, 1, 34, PALETTE.woodDark);
  return outlineProp(c);
}

export function drawWaterCooler() {
  const c = createCanvas(10, 24), ctx = c.getContext('2d');
  r(ctx, 1, 8, 8, 14, PALETTE.mug);
  r(ctx, 1, 8, 1, 14, PALETTE.ivory);
  r(ctx, 8, 8, 1, 14, PALETTE.metal);
  r(ctx, 2, 1, 6, 7, PALETTE.glass);
  r(ctx, 2, 1, 2, 7, PALETTE.skyHi);
  r(ctx, 2, 6, 6, 2, PALETTE.glassDark);
  r(ctx, 4, 10, 2, 2, PALETTE.metalDark);
  r(ctx, 4, 13, 1, 2, PALETTE.glass);
  r(ctx, 2, 18, 6, 2, PALETTE.metal);
  r(ctx, 1, 21, 8, 2, PALETTE.metalDark);
  return outlineProp(c);
}

export function drawWhiteboard() {
  const c = createCanvas(44, 22), ctx = c.getContext('2d');
  r(ctx, 0, 0, 44, 22, PALETTE.metal);
  r(ctx, 1, 1, 42, 18, PALETTE.ivory);
  r(ctx, 0, 0, 44, 1, PALETTE.metalHi);
  r(ctx, 4, 4, 13, 1, PALETTE.shirtBlue);
  r(ctx, 4, 7, 9, 1, PALETTE.red);
  r(ctx, 4, 11, 3, 5, PALETTE.green);
  r(ctx, 9, 9, 3, 7, PALETTE.shirtOrange);
  r(ctx, 14, 12, 3, 4, PALETTE.yellow);
  r(ctx, 26, 4, 1, 12, PALETTE.metalDark);
  r(ctx, 26, 15, 12, 1, PALETTE.metalDark);
  r(ctx, 4, 16, 13, 1, PALETTE.ink);
  r(ctx, 0, 19, 44, 3, PALETTE.metalDark);
  r(ctx, 6, 20, 7, 1, PALETTE.red);
  r(ctx, 16, 20, 5, 1, PALETTE.shirtBlue);
  return outlineProp(c);
}

export function drawClock() {
  const c = createCanvas(10, 10), ctx = c.getContext('2d');
  r(ctx, 2, 0, 6, 10, PALETTE.woodDark);
  r(ctx, 0, 2, 10, 6, PALETTE.woodDark);
  r(ctx, 2, 1, 6, 8, PALETTE.wood);
  r(ctx, 1, 2, 8, 6, PALETTE.wood);
  r(ctx, 2, 2, 6, 6, PALETTE.ivory);
  r(ctx, 2, 2, 1, 1, PALETTE.woodHi);
  r(ctx, 5, 3, 1, 3, PALETTE.ink);
  r(ctx, 5, 5, 2, 1, PALETTE.ink);
  r(ctx, 5, 2, 1, 1, PALETTE.ink); r(ctx, 7, 5, 1, 1, PALETTE.ink);
  return outlineProp(c);
}

export function drawDoor() {
  const c = createCanvas(20, 30), ctx = c.getContext('2d');
  r(ctx, 0, 0, 20, 30, PALETTE.woodDark);
  r(ctx, 1, 1, 18, 28, PALETTE.wood);
  r(ctx, 1, 1, 1, 28, PALETTE.woodHi);
  r(ctx, 4, 3, 12, 10, PALETTE.woodDark);
  r(ctx, 5, 4, 10, 8, PALETTE.wood);
  r(ctx, 6, 5, 8, 5, PALETTE.glass);
  r(ctx, 6, 5, 8, 2, PALETTE.skyHi);
  r(ctx, 9, 5, 1, 5, PALETTE.wood);
  r(ctx, 4, 15, 12, 12, PALETTE.woodDark);
  r(ctx, 5, 16, 10, 10, PALETTE.wood);
  r(ctx, 5, 16, 10, 1, PALETTE.woodHi);
  r(ctx, 6, 18, 8, 6, PALETTE.woodDark);
  r(ctx, 7, 19, 6, 4, PALETTE.wood);
  r(ctx, 14, 20, 2, 2, PALETTE.yellow);
  r(ctx, 0, 28, 20, 2, PALETTE.woodDark);
  return outlineProp(c);
}

export function drawCoffeeTable() {
  const c = createCanvas(20, 12), ctx = c.getContext('2d');
  r(ctx, 0, 3, 20, 4, PALETTE.wood);
  r(ctx, 0, 3, 20, 1, PALETTE.woodHi);
  r(ctx, 0, 6, 20, 1, PALETTE.woodDark);
  r(ctx, 4, 1, 3, 2, PALETTE.mug); r(ctx, 4, 1, 3, 1, PALETTE.ivory);
  r(ctx, 7, 2, 1, 1, PALETTE.mug);
  r(ctx, 10, 2, 7, 2, PALETTE.ivory); r(ctx, 11, 2, 4, 1, PALETTE.ink);
  r(ctx, 2, 7, 3, 5, PALETTE.woodDark); r(ctx, 15, 7, 3, 5, PALETTE.woodDark);
  r(ctx, 5, 9, 10, 2, PALETTE.wood);
  return outlineProp(c);
}

export function drawPoster() {
  const c = createCanvas(14, 16), ctx = c.getContext('2d');
  r(ctx, 0, 0, 14, 16, PALETTE.wood);
  r(ctx, 1, 1, 12, 14, PALETTE.woodDark);
  r(ctx, 2, 2, 10, 12, PALETTE.skyHi);
  r(ctx, 8, 3, 3, 3, PALETTE.yellow);
  r(ctx, 2, 9, 10, 2, PALETTE.cloud);
  r(ctx, 2, 10, 10, 4, PALETTE.plant);
  r(ctx, 5, 6, 2, 5, PALETTE.plantDark);
  r(ctx, 4, 6, 3, 2, PALETTE.plantHi);
  r(ctx, 3, 10, 4, 1, PALETTE.plantHi);
  r(ctx, 0, 0, 14, 1, PALETTE.woodHi);
  r(ctx, 0, 15, 14, 1, PALETTE.woodDark);
  return outlineProp(c);
}

export function drawShadow(w = 12) {
  const c = createCanvas(w, 4), ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(1, 0, w - 2, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(0, 1, w, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(1, 3, w - 2, 1);
  return c;
}
