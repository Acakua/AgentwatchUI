export const CHAR_W = 16;
export const CHAR_H = 24;
export const CHAR_POSES = ['stand','walk1','walk2','sit','type1','type2','review1','review2','sleep'];

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
      const char = drawCharacter({
        pose: CHAR_POSES[p],
        shirt, hair, skin,
        facing: facings[f]
      });
      ctx.drawImage(char, p * CHAR_W, f * CHAR_H);
    }
  }
  
  return c;
}

export function drawDesk({ screenOn }) {
  const c = createCanvas(32, 24);
  const ctx = c.getContext('2d');
  
  ctx.fillStyle = PALETTE.wood;
  ctx.fillRect(0, 8, 32, 12);
  ctx.fillStyle = PALETTE.woodLight;
  ctx.fillRect(0, 8, 32, 2);
  ctx.fillStyle = PALETTE.woodDark;
  ctx.fillRect(0, 18, 32, 2);
  ctx.fillRect(2, 20, 4, 4);
  ctx.fillRect(26, 20, 4, 4);
  
  ctx.fillStyle = PALETTE.metalDark;
  ctx.fillRect(10, 2, 12, 6);
  if (screenOn) {
    ctx.fillStyle = PALETTE.screenGlow;
    ctx.fillRect(11, 3, 10, 4);
    ctx.fillStyle = '#1a202c';
    ctx.fillRect(12, 4, 2, 1);
    ctx.fillRect(15, 4, 3, 1);
    ctx.fillRect(12, 5, 4, 1);
  } else {
    ctx.fillStyle = PALETTE.screen;
    ctx.fillRect(11, 3, 10, 4);
  }
  
  ctx.fillStyle = PALETTE.metal;
  ctx.fillRect(14, 8, 4, 2);
  ctx.fillStyle = PALETTE.metalDark;
  ctx.fillRect(12, 10, 8, 2);
  
  return c;
}

export function drawManagerDesk({ screenOn }) {
  const c = createCanvas(48, 24);
  const ctx = c.getContext('2d');
  
  ctx.fillStyle = PALETTE.woodDark;
  ctx.fillRect(0, 6, 48, 14);
  ctx.fillStyle = PALETTE.wood;
  ctx.fillRect(0, 6, 48, 3);
  ctx.fillStyle = PALETTE.woodLight;
  ctx.fillRect(2, 7, 44, 1);
  ctx.fillStyle = '#5c4033';
  ctx.fillRect(0, 18, 48, 2);
  ctx.fillRect(4, 20, 6, 4);
  ctx.fillRect(38, 20, 6, 4);
  
  ctx.fillStyle = PALETTE.metalDark;
  ctx.fillRect(18, 0, 12, 6);
  if (screenOn) {
    ctx.fillStyle = '#63b3ed';
    ctx.fillRect(19, 1, 10, 4);
  } else {
    ctx.fillStyle = PALETTE.screen;
    ctx.fillRect(19, 1, 10, 4);
  }
  
  ctx.fillStyle = PALETTE.metal;
  ctx.fillRect(22, 6, 4, 2);
  ctx.fillStyle = PALETTE.metalDark;
  ctx.fillRect(20, 8, 8, 2);
  
  ctx.fillStyle = PALETTE.paper;
  ctx.fillRect(4, 9, 8, 6);
  ctx.fillStyle = PALETTE.outline;
  ctx.fillRect(5, 10, 6, 1);
  ctx.fillRect(5, 12, 4, 1);
  ctx.fillRect(5, 14, 5, 1);
  
  ctx.fillStyle = PALETTE.mug;
  ctx.fillRect(36, 12, 4, 4);
  ctx.fillStyle = '#8b4513';
  ctx.fillRect(37, 11, 2, 1);
  
  return c;
}

export function drawChair() {
  const c = createCanvas(12, 14);
  const ctx = c.getContext('2d');
  
  ctx.fillStyle = PALETTE.wood;
  ctx.fillRect(1, 0, 10, 4);
  ctx.fillStyle = PALETTE.woodDark;
  ctx.fillRect(1, 3, 10, 1);
  
  ctx.fillStyle = PALETTE.wood;
  ctx.fillRect(2, 4, 8, 4);
  ctx.fillStyle = PALETTE.woodDark;
  ctx.fillRect(2, 7, 8, 1);
  
  ctx.fillStyle = PALETTE.woodDark;
  ctx.fillRect(2, 8, 2, 6);
  ctx.fillRect(8, 8, 2, 6);
  
  ctx.fillStyle = '#4a3728';
  ctx.fillRect(1, 12, 4, 2);
  ctx.fillRect(7, 12, 4, 2);
  
  return c;
}

export function drawBench() {
  const c = createCanvas(64, 14);
  const ctx = c.getContext('2d');
  
  ctx.fillStyle = PALETTE.wood;
  ctx.fillRect(0, 0, 64, 4);
  ctx.fillStyle = PALETTE.woodLight;
  ctx.fillRect(0, 0, 64, 1);
  ctx.fillStyle = PALETTE.woodDark;
  ctx.fillRect(0, 3, 64, 1);
  
  ctx.fillStyle = PALETTE.wood;
  ctx.fillRect(0, 6, 64, 4);
  ctx.fillStyle = PALETTE.woodDark;
  ctx.fillRect(0, 9, 64, 1);
  
  ctx.fillStyle = PALETTE.woodDark;
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(i * 16 + 2, 10, 3, 4);
    ctx.fillRect(i * 16 + 11, 10, 3, 4);
  }
  
  return c;
}

const floorPattern = [
  '1111111111111111',
  '1211121112111211',
  '1111111111111111',
  '1112111111121111',
  '1111111111111111',
  '1211121112111211',
  '1111111111111111',
  '1112111111121111',
  '1111111111111111',
  '1211121112111211',
  '1111111111111111',
  '1112111111121111',
  '1111111111111111',
  '1211121112111211',
  '1111111111111111',
  '1111111111111111',
];

export function drawFloorTile() {
  const c = createCanvas(16, 16);
  const ctx = c.getContext('2d');
  
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (floorPattern[y][x] === '2') {
        ctx.fillStyle = PALETTE.floorDark;
      } else {
        ctx.fillStyle = PALETTE.floor;
      }
      ctx.fillRect(x, y, 1, 1);
    }
  }
  
  return c;
}

export function drawWallTile() {
  const c = createCanvas(16, 24);
  const ctx = c.getContext('2d');
  
  for (let y = 0; y < 24; y++) {
    for (let x = 0; x < 16; x++) {
      if ((x + y) % 2 === 0 && y % 4 === 0) {
        ctx.fillStyle = PALETTE.wallDark;
      } else {
        ctx.fillStyle = PALETTE.wall;
      }
      ctx.fillRect(x, y, 1, 1);
    }
  }
  
  ctx.fillStyle = PALETTE.wood;
  ctx.fillRect(0, 22, 16, 2);
  
  return c;
}

export function drawPlant() {
  const c = createCanvas(12, 20);
  const ctx = c.getContext('2d');
  
  ctx.fillStyle = '#8b4513';
  ctx.fillRect(3, 16, 6, 4);
  ctx.fillStyle = '#a0522d';
  ctx.fillRect(4, 16, 4, 1);
  ctx.fillStyle = '#654321';
  ctx.fillRect(5, 10, 2, 6);
  
  ctx.fillStyle = PALETTE.plant;
  ctx.fillRect(1, 8, 4, 3);
  ctx.fillRect(7, 8, 4, 3);
  ctx.fillRect(3, 4, 6, 5);
  ctx.fillRect(5, 2, 2, 3);
  
  ctx.fillStyle = PALETTE.plantDark;
  ctx.fillRect(2, 9, 2, 1);
  ctx.fillRect(8, 9, 2, 1);
  ctx.fillRect(4, 6, 3, 2);
  
  return c;
}

export function drawWindow() {
  const c = createCanvas(24, 20);
  const ctx = c.getContext('2d');
  
  ctx.fillStyle = PALETTE.wood;
  ctx.fillRect(0, 0, 24, 20);
  ctx.fillStyle = PALETTE.woodDark;
  ctx.fillRect(0, 0, 24, 2);
  ctx.fillRect(0, 18, 24, 2);
  ctx.fillRect(0, 0, 2, 20);
  ctx.fillRect(22, 0, 2, 20);
  
  ctx.fillStyle = PALETTE.glass;
  ctx.fillRect(2, 2, 9, 16);
  ctx.fillRect(13, 2, 9, 16);
  
  ctx.fillStyle = PALETTE.glassDark;
  ctx.fillRect(3, 3, 3, 3);
  ctx.fillRect(14, 3, 3, 3);
  ctx.fillRect(8, 12, 2, 4);
  ctx.fillRect(19, 12, 2, 4);
  
  ctx.fillStyle = PALETTE.woodDark;
  ctx.fillRect(11, 2, 2, 16);
  ctx.fillRect(2, 9, 20, 2);
  
  return c;
}

export function drawRug() {
  const c = createCanvas(48, 32);
  const ctx = c.getContext('2d');
  
  ctx.fillStyle = PALETTE.rug;
  ctx.fillRect(0, 0, 48, 32);
  ctx.fillStyle = PALETTE.rugPattern;
  ctx.fillRect(2, 2, 44, 28);
  ctx.fillStyle = PALETTE.rug;
  ctx.fillRect(4, 4, 40, 24);
  
  ctx.fillStyle = '#b8860b';
  for (let y = 6; y < 26; y += 4) {
    for (let x = 6; x < 42; x += 4) {
      if ((x + y) % 8 === 6) {
        ctx.fillRect(x, y, 2, 2);
      }
    }
  }
  
  ctx.fillStyle = '#654321';
  ctx.fillRect(0, 0, 48, 1);
  ctx.fillRect(0, 31, 48, 1);
  ctx.fillRect(0, 0, 1, 32);
  ctx.fillRect(47, 0, 1, 32);
  
  return c;
}

export function drawBubble(kind) {
  const c = createCanvas(12, 12);
  const ctx = c.getContext('2d');
  
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fillRect(1, 1, 10, 10);
  ctx.fillStyle = PALETTE.outline;
  ctx.fillRect(0, 0, 12, 1);
  ctx.fillRect(0, 11, 12, 1);
  ctx.fillRect(0, 0, 1, 12);
  ctx.fillRect(11, 0, 1, 12);
  ctx.fillRect(10, 10, 2, 2);
  
  if (kind === 'code') {
    ctx.fillStyle = PALETTE.shirtBlue;
    ctx.fillRect(3, 4, 2, 1);
    ctx.fillRect(3, 6, 2, 1);
    ctx.fillRect(4, 5, 4, 1);
    ctx.fillRect(7, 4, 2, 1);
    ctx.fillRect(7, 6, 2, 1);
  } else if (kind === 'review') {
    ctx.fillStyle = '#d69e2e';
    ctx.fillRect(3, 3, 6, 1);
    ctx.fillRect(3, 4, 6, 4);
    ctx.fillStyle = '#faf089';
    ctx.fillRect(4, 5, 4, 2);
    ctx.fillStyle = '#744210';
    ctx.fillRect(4, 5, 3, 1);
  } else if (kind === 'zzz') {
    ctx.fillStyle = '#805ad5';
    ctx.fillRect(3, 7, 1, 1);
    ctx.fillRect(4, 6, 1, 1);
    ctx.fillRect(5, 5, 1, 1);
    ctx.fillRect(6, 5, 1, 1);
    ctx.fillRect(7, 5, 1, 1);
    ctx.fillRect(6, 6, 1, 1);
    ctx.fillRect(7, 7, 1, 1);
    ctx.fillRect(8, 7, 1, 1);
  } else if (kind === 'ok') {
    ctx.fillStyle = PALETTE.green;
    ctx.fillRect(3, 5, 1, 3);
    ctx.fillRect(4, 7, 1, 1);
    ctx.fillRect(5, 6, 1, 1);
    ctx.fillRect(6, 5, 1, 1);
    ctx.fillRect(7, 4, 1, 1);
    ctx.fillRect(8, 3, 1, 1);
  } else if (kind === 'alert') {
    ctx.fillStyle = PALETTE.red;
    ctx.fillRect(5, 3, 2, 5);
    ctx.fillRect(5, 8, 2, 1);
  }
  
  return c;
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
  'M': ['1  1', '1111', '1111', '1  1', '1  1'],
  'N': ['1  1', '11 1', '11 1', '1 11', '1  1'],
  'O': [' 11 ', '1  1', '1  1', '1  1', ' 11 '],
  'P': ['111 ', '1  1', '111 ', '1   ', '1   '],
  'Q': [' 11 ', '1  1', '1 11', '1 1 ', ' 111'],
  'R': ['111 ', '1  1', '111 ', '1 1 ', '1  1'],
  'S': [' 111', '1   ', ' 11 ', '   1', '111 '],
  'T': ['11111', '  1  ', '  1  ', '  1  ', '  1  '],
  'U': ['1  1', '1  1', '1  1', '1  1', ' 11 '],
  'V': ['1  1', '1  1', '1  1', ' 11 ', '  1 '],
  'W': ['1  1', '1  1', '1111', '1111', '1  1'],
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
  
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#2d3748';
  ctx.fillRect(1, 1, w - 2, h - 2);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, 1);
  ctx.fillRect(0, h - 1, w, 1);
  ctx.fillRect(0, 0, 1, h);
  ctx.fillRect(w - 1, 0, 1, h);
  
  let x = 2;
  const y = 2;
  
  for (const ch of text) {
    const glyph = FONT[ch] || FONT[' '];
    for (let row = 0; row < glyph.length; row++) {
      for (let col = 0; col < glyph[row].length; col++) {
        if (glyph[row][col] === '1') {
          ctx.fillStyle = PALETTE.white;
          ctx.fillRect(x + col, y + row, 1, 1);
        }
      }
    }
    x += glyph[0].length + 1;
  }
  
  return c;
}
