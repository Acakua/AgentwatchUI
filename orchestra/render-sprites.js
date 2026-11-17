#!/usr/bin/env node
// Renders public/js/sprites.js to PNG files WITHOUT a browser, so a worker model
// (or the orchestrator) can look at the pixel art it wrote.
//
//   node orchestra/render-sprites.js          -> .orchestra/preview/chars.png, props.png
//
// It uses a tiny fake canvas. Supported 2D context API (anything else throws):
//   fillStyle (#rgb, #rrggbb, #rrggbbaa, rgb(), rgba(), 'transparent')
//   fillRect, clearRect, drawImage(canvas, dx, dy), getImageData, putImageData
// sprites.js must create canvases through document.createElement('canvas').
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { pathToFileURL } = require('node:url');

function parseColor(s) {
  s = String(s).trim().toLowerCase();
  if (s === 'transparent') return [0, 0, 0, 0];
  let m = /^#([0-9a-f]{3,8})$/.exec(s);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) throw new Error('bad colour ' + s);
    return [0, 2, 4, 6].map((i) => (i < h.length ? parseInt(h.slice(i, i + 2), 16) : 255));
  }
  m = /^rgba?\(([^)]+)\)$/.exec(s);
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p.length > 3 ? Math.round(p[3] * 255) : 255];
  }
  throw new Error('fake canvas: unsupported colour "' + s + '" (use hex or rgba())');
}

class Ctx {
  constructor(canvas) { this.canvas = canvas; this.fillStyle = '#000000'; this.imageSmoothingEnabled = false; }
  _px(x, y, c) {
    const cv = this.canvas;
    if (x < 0 || y < 0 || x >= cv.width || y >= cv.height) return;
    const i = (y * cv.width + x) * 4, a = c[3] / 255, d = cv.data;
    if (a >= 1) { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; return; }
    if (a <= 0) return;
    const da = d[i + 3] / 255, oa = a + da * (1 - a);
    for (let k = 0; k < 3; k++) d[i + k] = Math.round((c[k] * a + d[i + k] * da * (1 - a)) / oa);
    d[i + 3] = Math.round(oa * 255);
  }
  fillRect(x, y, w, h) {
    const c = parseColor(this.fillStyle);
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this._px(i, j, c);
  }
  clearRect(x, y, w, h) {
    const cv = this.canvas;
    for (let j = Math.max(0, y); j < Math.min(cv.height, y + h); j++)
      for (let i = Math.max(0, x); i < Math.min(cv.width, x + w); i++) cv.data.fill(0, (j * cv.width + i) * 4, (j * cv.width + i) * 4 + 4);
  }
  drawImage(src, dx, dy, ...rest) {
    if (rest.length) throw new Error('fake canvas: only drawImage(canvas, dx, dy) is supported');
    for (let j = 0; j < src.height; j++) for (let i = 0; i < src.width; i++) {
      const k = (j * src.width + i) * 4;
      this._px(Math.round(dx) + i, Math.round(dy) + j, [src.data[k], src.data[k + 1], src.data[k + 2], src.data[k + 3]]);
    }
  }
  getImageData(x, y, w, h) {
    const out = new Uint8ClampedArray(w * h * 4), cv = this.canvas;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const sx = x + i, sy = y + j;
      if (sx < 0 || sy < 0 || sx >= cv.width || sy >= cv.height) continue;
      out.set(cv.data.subarray((sy * cv.width + sx) * 4, (sy * cv.width + sx) * 4 + 4), (j * w + i) * 4);
    }
    return { width: w, height: h, data: out };
  }
  putImageData(img, x, y) {
    const cv = this.canvas;
    for (let j = 0; j < img.height; j++) for (let i = 0; i < img.width; i++) {
      const dx = x + i, dy = y + j;
      if (dx < 0 || dy < 0 || dx >= cv.width || dy >= cv.height) continue;
      cv.data.set(img.data.subarray((j * img.width + i) * 4, (j * img.width + i) * 4 + 4), (dy * cv.width + dx) * 4);
    }
  }
}
const unsupported = new Proxy(Ctx.prototype, {
  get(t, k) {
    if (k in t || typeof k === 'symbol') return t[k];
    return () => { throw new Error('fake canvas: ctx.' + String(k) + '() is not supported; use fillRect/clearRect/drawImage/getImageData/putImageData'); };
  },
});
class Canvas {
  constructor() { this._w = 300; this._h = 150; this.data = new Uint8ClampedArray(300 * 150 * 4); }
  get width() { return this._w; } set width(v) { this._w = v | 0; this.data = new Uint8ClampedArray(this._w * this._h * 4); }
  get height() { return this._h; } set height(v) { this._h = v | 0; this.data = new Uint8ClampedArray(this._w * this._h * 4); }
  getContext(kind) { if (kind !== '2d') throw new Error('only 2d'); return this._ctx || (this._ctx = Object.setPrototypeOf(new Ctx(this), unsupported)); }
}
globalThis.document = { createElement(tag) { if (tag !== 'canvas') throw new Error('fake document: only canvas'); return new Canvas(); } };

function crc32(buf) {
  let c, crc = ~0;
  for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return ~crc >>> 0;
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// Lays sprites out on a checker-free flat background, scaled up with hard pixels.
function sheet(items, scale, bg, maxW) {
  const pad = 4; let x = pad, y = pad, rowH = 0, W = 0; const pos = [];
  for (const it of items) {
    if (x + it.width + pad > maxW && x > pad) { x = pad; y += rowH + pad; rowH = 0; }
    pos.push([x, y]); x += it.width + pad; rowH = Math.max(rowH, it.height); W = Math.max(W, x);
  }
  const H = y + rowH + pad, out = new Uint8ClampedArray(W * scale * H * scale * 4), b = parseColor(bg);
  for (let i = 0; i < out.length; i += 4) out.set(b, i);
  items.forEach((it, n) => {
    for (let j = 0; j < it.height; j++) for (let i = 0; i < it.width; i++) {
      const k = (j * it.width + i) * 4, a = it.data[k + 3] / 255; if (!a) continue;
      for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) {
        const o = (((pos[n][1] + j) * scale + sy) * W * scale + (pos[n][0] + i) * scale + sx) * 4;
        for (let c = 0; c < 3; c++) out[o + c] = Math.round(it.data[k + c] * a + out[o + c] * (1 - a));
      }
    }
  });
  return png(W * scale, H * scale, out);
}

(async () => {
  const root = path.resolve(__dirname, '..');
  const S = await import(pathToFileURL(path.join(root, 'public/js/sprites.js')).href);
  const outDir = path.join(root, '.orchestra/preview'); fs.mkdirSync(outDir, { recursive: true });
  const must = (c, name, w, h) => {
    if (!c || !c.data) throw new Error(name + ' did not return a canvas made with document.createElement("canvas")');
    if (w && (c.width !== w || c.height !== h)) console.log(`SIZE MISMATCH ${name}: got ${c.width}x${c.height}, spec says ${w}x${h}`);
    return c;
  };
  const looks = [
    { shirt: '#4fb3ff', hair: '#3b2a1a', skin: '#f2c9a0' },
    { shirt: '#e8833a', hair: '#d9d9d9', skin: '#c68e5f' },
    { shirt: '#7ac74f', hair: '#b5402a', skin: '#8d5a3a' },
  ];
  const chars = looks.map((l, i) => must(S.characterSheet(l), 'characterSheet#' + i, 16 * 9, 24 * 4));
  fs.writeFileSync(path.join(outDir, 'chars.png'), sheet(chars, 6, '#6b6f7a', 160));
  // One big single frame per pose for close inspection.
  const big = S.CHAR_POSES.map((pose) => must(S.drawCharacter({ pose, facing: 'down', ...looks[0] }), 'drawCharacter:' + pose, 16, 24));
  fs.writeFileSync(path.join(outDir, 'poses-down.png'), sheet(big, 12, '#6b6f7a', 400));
  const props = [
    must(S.drawDesk({ screenOn: false }), 'drawDesk off', 32, 24), must(S.drawDesk({ screenOn: true }), 'drawDesk on', 32, 24),
    must(S.drawManagerDesk({ screenOn: true }), 'drawManagerDesk', 48, 24), must(S.drawChair(), 'drawChair', 12, 14),
    must(S.drawBench(), 'drawBench', 64, 14), must(S.drawPlant(), 'drawPlant', 12, 20), must(S.drawWindow(), 'drawWindow', 24, 20),
    must(S.drawRug(), 'drawRug', 48, 32), must(S.drawFloorTile(), 'drawFloorTile', 16, 16), must(S.drawFloorTile(), 'drawFloorTile', 16, 16),
    must(S.drawWallTile(), 'drawWallTile', 16, 24), must(S.drawWallTile(), 'drawWallTile', 16, 24),
    ...['code', 'review', 'zzz', 'ok', 'alert', 'quota'].map((k) => must(S.drawBubble(k), 'drawBubble:' + k, 12, 12)),
    must(S.drawSofa(), 'drawSofa', 40, 18), must(S.drawBookshelf(), 'drawBookshelf', 24, 34),
    must(S.drawWaterCooler(), 'drawWaterCooler', 10, 24), must(S.drawWhiteboard(), 'drawWhiteboard', 44, 22),
    must(S.drawClock(), 'drawClock', 10, 10), must(S.drawDoor(), 'drawDoor', 20, 30),
    must(S.drawCoffeeTable(), 'drawCoffeeTable', 20, 12), must(S.drawPoster(), 'drawPoster', 14, 16),
    must(S.drawShadow(12), 'drawShadow', 12, 4),
    must(S.drawNameplate('GLM 5.2', '#4fb3ff'), 'drawNameplate'), must(S.drawNameplate('FABLE', '#e8833a'), 'drawNameplate'),
  ];
  fs.writeFileSync(path.join(outDir, 'props.png'), sheet(props, 8, '#6b6f7a', 150));
  // scene.png: a small mock-up room so props can be judged together, on the real floor.
  {
    const W = 240, H = 135, room = document.createElement('canvas'); room.width = W; room.height = H;
    const g = room.getContext('2d'), floor = S.drawFloorTile(), wall = S.drawWallTile();
    for (let y = 24; y < H; y += 16) for (let x = 0; x < W; x += 16) g.drawImage(floor, x, y);
    for (let x = 0; x < W; x += 16) g.drawImage(wall, x, 0);
    g.drawImage(S.drawWindow(), 20, 2); g.drawImage(S.drawWhiteboard(), 60, 1); g.drawImage(S.drawClock(), 112, 4);
    g.drawImage(S.drawPoster(), 130, 3); g.drawImage(S.drawDoor(), 214, -6 + 0); g.drawImage(S.drawBookshelf(), 186, 6);
    g.drawImage(S.drawPlant(), 4, 22); g.drawImage(S.drawWaterCooler(), 170, 18);
    const me = { shirt: '#4fb3ff', hair: '#3b2a1a', skin: '#f2c9a0' };
    g.drawImage(S.drawDesk({ screenOn: true }), 20, 44); g.drawImage(S.drawShadow(12), 30, 84);
    g.drawImage(S.drawCharacter({ pose: 'type1', facing: 'up', ...me }), 28, 62);
    g.drawImage(S.drawDesk({ screenOn: false }), 64, 44); g.drawImage(S.drawChair(), 74, 66);
    g.drawImage(S.drawRug(), 150, 60); g.drawImage(S.drawManagerDesk({ screenOn: true }), 150, 44);
    g.drawImage(S.drawSofa(), 154, 96); g.drawImage(S.drawCoffeeTable(), 200, 100);
    g.drawImage(S.drawBench(), 20, 112); g.drawImage(S.drawShadow(12), 30, 126);
    g.drawImage(S.drawCharacter({ pose: 'sit', facing: 'down', shirt: '#e8833a', hair: '#d9d9d9', skin: '#c68e5f' }), 28, 102);
    g.drawImage(S.drawBubble('quota'), 30, 90); g.drawImage(S.drawBubble('code'), 30, 50);
    g.drawImage(S.drawCharacter({ pose: 'review1', facing: 'left', shirt: '#d97757', hair: '#3b2a1a', skin: '#f2c9a0' }), 100, 52);
    fs.writeFileSync(path.join(outDir, 'scene.png'), sheet([room], 5, '#101522', 260));
  }
  console.log('wrote', ['chars.png', 'poses-down.png', 'props.png', 'scene.png'].map((f) => path.join('.orchestra/preview', f)).join(', '));
})().catch((e) => { console.error('RENDER FAILED:', e.message); process.exit(1); });
