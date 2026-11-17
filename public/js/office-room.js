import * as THREE from '../vendor/three.module.js';
import {
  drawFloorTile, drawWallTile, drawWindow, drawRug,
  drawSofa, drawBookshelf, drawWaterCooler, drawWhiteboard, drawClock,
  drawDoor, drawCoffeeTable, drawPoster, drawPlant,
} from './sprites.js';
import { ROOM_W, ROOM_H, WALL_H, decor } from './layout.js';

export function makeTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeMesh(width, height, texture) {
  const material = new THREE.MeshBasicMaterial({
    map: texture, transparent: true, alphaTest: 0.5, depthTest: false, depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.userData.w = width;
  mesh.userData.h = height;
  return mesh;
}

// Art coordinates are top-left based; world y goes up, so flip y here.
export function placeSprite(mesh, centerX, bottomY, layer) {
  const x = Math.round(centerX);
  const by = Math.round(bottomY);
  mesh.position.set(x, ROOM_H - by + mesh.userData.h / 2, 0);
  mesh.renderOrder = by * 2 + (layer || 0);
}

function tileSheet(width, height, tile, tileW, tileH) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  for (let y = 0; y < height; y += tileH) {
    for (let x = 0; x < width; x += tileW) ctx.drawImage(tile, x, y);
  }
  return canvas;
}

const DECOR_DRAW = {
  door: drawDoor,
  whiteboard: drawWhiteboard,
  clock: drawClock,
  poster: drawPoster,
  bookshelf: drawBookshelf,
  waterCooler: drawWaterCooler,
  plant: drawPlant,
  sofa: drawSofa,
  coffeeTable: drawCoffeeTable,
};

// Static room shell and all round-2 decor, driven by layout.js data.
export function buildStaticRoom(office) {
  const floor = office.addStatic(
    tileSheet(ROOM_W, ROOM_H - WALL_H, drawFloorTile(), 16, 16),
    ROOM_W, ROOM_H - WALL_H, ROOM_W / 2, ROOM_H, 0,
  );
  floor.renderOrder = -1000;
  office.addStatic(tileSheet(ROOM_W, WALL_H, drawWallTile(), 16, 24), ROOM_W, WALL_H, ROOM_W / 2, WALL_H, 0);
  for (const x of [80, 200, 320]) office.addStatic(drawWindow(), 24, 20, x, WALL_H + 4, 1);

  office.addStatic(drawRug(), office.manager.rug.w, office.manager.rug.h,
    office.manager.rug.x + office.manager.rug.w / 2,
    office.manager.rug.y + office.manager.rug.h, 0).renderOrder = -100;

  for (const item of decor()) {
    const draw = DECOR_DRAW[item.sprite];
    if (!draw) continue;
    // Sofas must sit behind the characters that sit on them.
    const layer = item.sprite === 'sofa' ? -20 : 1;
    office.addStatic(draw(), item.w, item.h, item.x + item.w / 2, item.y + item.h, layer);
  }
}

function agentAtPointer(office) {
  office.scene.updateMatrixWorld(true);
  const meshes = [];
  for (const ch of office.characters.values()) meshes.push(ch.mesh);
  const hits = office.raycaster.intersectObjects(meshes, false);
  if (hits.length === 0) return null;
  const ch = office.characters.get(hits[0].object.userData.agentId);
  return ch ? ch.agent : null;
}

function hoverAtPointer(office) {
  const agent = agentAtPointer(office);
  if (agent === office.hovered) return;
  office.hovered = agent;
  if (office.onHover) office.onHover(agent);
}

export function bindPointer(office) {
  office.raycaster = new THREE.Raycaster();
  office.pointer = new THREE.Vector2(-10, -10);
  office.canvas.addEventListener('pointermove', (event) => {
    const rect = office.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    office.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -(((event.clientY - rect.top) / rect.height) * 2 - 1),
    );
    hoverAtPointer(office);
  });
  office.canvas.addEventListener('pointerleave', () => {
    if (!office.hovered) return;
    office.hovered = null;
    if (office.onHover) office.onHover(null);
  });
  office.canvas.addEventListener('click', () => {
    const agent = agentAtPointer(office);
    if (agent && office.onSelect) office.onSelect(agent);
  });
}

export function resizeCamera(office, width, height) {
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  office.renderer.setSize(w, h, false);
  office.canvas.style.width = '100%';
  office.canvas.style.height = '100%';
  // Integer zoom keeps every art pixel square and crisp.
  const zoom = Math.max(1, Math.floor(Math.min(w / ROOM_W, h / ROOM_H)));
  office.camera.left = -w / (2 * zoom);
  office.camera.right = w / (2 * zoom);
  office.camera.top = h / (2 * zoom);
  office.camera.bottom = -h / (2 * zoom);
  office.camera.near = 0.1;
  office.camera.far = 1000;
  office.camera.position.set(ROOM_W / 2, ROOM_H / 2, 100);
  office.camera.lookAt(ROOM_W / 2, ROOM_H / 2, 0);
  office.camera.updateProjectionMatrix();
}
