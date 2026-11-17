import * as THREE from '../vendor/three.module.js';
import {
  CHAR_W, CHAR_H, characterSheet, drawDesk, drawManagerDesk, drawBench,
  drawFloorTile, drawWallTile, drawPlant, drawWindow, drawRug, drawBubble, drawNameplate,
} from './sprites.js';
import {
  ROOM_W, ROOM_H, WALL_H, BENCH_W, BENCH_H,
  deskSlots, benchSeats, managerSpots, reviewSpot, pathBetween,
} from './layout.js';

const SPEED = 40;
const FRAME_FPS = 4;
const SLEEP_AFTER = 60;
const POSE_INDEX = { stand: 0, walk1: 1, walk2: 2, sit: 3, type1: 4, type2: 5, review1: 6, review2: 7, sleep: 8 };
const FACING_INDEX = { down: 0, up: 1, left: 2, right: 3 };
const HAIR = ['#3b2a1a', '#1a1a2e', '#5b3a1a', '#7a5a3a', '#d9d9d9'];
const SKIN = ['#f2c9a0', '#d4a574', '#e8b98a', '#f7d9b8'];
const BUBBLES = ['code', 'review', 'zzz', 'ok', 'alert'];

// Stable look per agent: same id always gets the same hair and skin.
function hashId(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeMesh(width, height, texture) {
  const material = new THREE.MeshBasicMaterial({
    map: texture, transparent: true, alphaTest: 0.5, depthTest: false, depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.userData.w = width;
  mesh.userData.h = height;
  return mesh;
}

// Art coordinates are top-left based; world y goes up, so flip y here.
function placeSprite(mesh, centerX, bottomY, layer) {
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

export class Office {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0b1220');
    this.camera = new THREE.OrthographicCamera(-240, 240, 135, -135, 0.1, 1000);
    this.camera.position.set(ROOM_W / 2, ROOM_H / 2, 100);
    this.camera.lookAt(ROOM_W / 2, ROOM_H / 2, 0);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.characters = new Map();
    this.slotList = [];
    this.seatList = [];
    this.deskMeshes = [];
    this.deskCapacity = 0;
    this.seatCapacity = 0;
    this.initialized = false;
    this.hovered = null;
    this.onHover = null;
    this.onSelect = null;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2(-10, -10);
    this.globalT = 0;

    this.textures = {
      deskOn: makeTexture(drawDesk({ screenOn: true })),
      deskOff: makeTexture(drawDesk({ screenOn: false })),
      mgrOn: makeTexture(drawManagerDesk({ screenOn: true })),
      mgrOff: makeTexture(drawManagerDesk({ screenOn: false })),
      bubbles: {},
    };
    for (const kind of BUBBLES) this.textures.bubbles[kind] = makeTexture(drawBubble(kind));

    this.manager = managerSpots();
    this.buildRoom();
    this.bindPointer();
    this.resize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight);
  }

  addStatic(canvas, width, height, centerX, bottomY, layer) {
    const mesh = makeMesh(width, height, makeTexture(canvas));
    placeSprite(mesh, centerX, bottomY, layer);
    this.scene.add(mesh);
    return mesh;
  }

  buildRoom() {
    const floor = this.addStatic(
      tileSheet(ROOM_W, ROOM_H - WALL_H, drawFloorTile(), 16, 16),
      ROOM_W, ROOM_H - WALL_H, ROOM_W / 2, ROOM_H, 0,
    );
    floor.renderOrder = -1000;
    this.addStatic(tileSheet(ROOM_W, WALL_H, drawWallTile(), 16, 24), ROOM_W, WALL_H, ROOM_W / 2, WALL_H, 0);
    for (const x of [80, 200, 320]) this.addStatic(drawWindow(), 24, 20, x, WALL_H + 4, 1);
    for (const x of [8, 346]) this.addStatic(drawPlant(), 12, 20, x, 64, 2);

    const rug = this.addStatic(drawRug(), 48, 32, this.manager.rug.x + 24, this.manager.rug.y + 32, 0);
    rug.renderOrder = -100;

    this.managerDeskMesh = makeMesh(48, 24, this.textures.mgrOff);
    this.managerDeskMesh.userData.screen = false;
    placeSprite(this.managerDeskMesh, this.manager.desk.x + 24, this.manager.desk.y + 24, 1);
    this.scene.add(this.managerDeskMesh);

    const sofa = this.addStatic(drawBench(), BENCH_W, BENCH_H, this.manager.sofa.x + BENCH_W / 2, this.manager.sofa.y + BENCH_H, -2);
    sofa.userData.kind = 'sofa';

    // Extra sofa rows (idle seats above the first row) need a bench under them.
    const sofaSeatY = this.manager.sofa.y + 12;
    for (const y of new Set(this.manager.idle.map((p) => p.y))) {
      if (y === sofaSeatY) continue;
      const xs = this.manager.idle.filter((p) => p.y === y).map((p) => p.x);
      this.addStatic(drawBench(), BENCH_W, BENCH_H, (Math.min(...xs) + Math.max(...xs)) / 2, y + 2, -2);
    }
  }

  ensureDesks(capacity) {
    if (capacity === this.deskCapacity) return;
    for (const desk of this.deskMeshes) {
      this.scene.remove(desk);
      desk.geometry.dispose();
      desk.material.dispose();
    }
    this.deskMeshes = [];
    this.deskCapacity = capacity;
    this.slotList = deskSlots(capacity);
    for (const slot of this.slotList) {
      const desk = makeMesh(32, 24, this.textures.deskOff);
      desk.userData.screen = false;
      placeSprite(desk, slot.desk.x + 16, slot.desk.y + 24, 2);
      this.scene.add(desk);
      this.deskMeshes.push(desk);
    }
  }

  ensureBenches(capacity) {
    if (capacity === this.seatCapacity) return;
    for (const bench of this.benchMeshes || []) {
      this.scene.remove(bench);
      bench.geometry.dispose();
      if (bench.material.map) bench.material.map.dispose();
      bench.material.dispose();
    }
    this.benchMeshes = [];
    this.seatCapacity = capacity;
    this.seatList = benchSeats(capacity);
    const seen = new Set();
    for (const seat of this.seatList) {
      const key = seat.benchX + ':' + seat.benchY;
      if (seen.has(key)) continue;
      seen.add(key);
      const mesh = this.addStatic(drawBench(), BENCH_W, BENCH_H, seat.benchX + BENCH_W / 2, seat.benchY + BENCH_H, -2);
      this.benchMeshes.push(mesh);
    }
  }

  createCharacter(agent) {
    const hash = hashId(agent.id);
    const sheet = characterSheet({ shirt: agent.color || '#9aa0a6', hair: HAIR[hash % HAIR.length], skin: SKIN[(hash >>> 3) % SKIN.length] });
    const texture = makeTexture(sheet);
    texture.repeat.set(1 / 9, 1 / 4);
    const mesh = makeMesh(CHAR_W, CHAR_H, texture);
    mesh.userData.agentId = agent.id;
    this.scene.add(mesh);
    const plate = this.makeNameplate(agent);
    this.scene.add(plate);
    const bubble = makeMesh(12, 12, this.textures.bubbles.code);
    bubble.visible = false;
    this.scene.add(bubble);
    return {
      id: agent.id, agent, mesh, texture, plate, bubble, bubbleKind: null,
      x: 240, y: 200, path: [], walking: false, restMode: 'stand', nextMode: 'stand',
      goal: { x: 240, y: 200 }, face: 'down', reviewFacing: 'down', alert: false, animT: 0, idleT: 0,
      plateRaise: 0,
    };
  }

  makeNameplate(agent) {
    // Guests carry raw model ids; keep plates short so neighbours stay readable.
    const label = String(agent.name || agent.id).replace(/-\d{6}$/, '');
    const canvas = drawNameplate(label.length > 12 ? label.slice(0, 11) + '.' : label, agent.color || '#ffffff');
    const plate = makeMesh(canvas.width, canvas.height, makeTexture(canvas));
    plate.userData.name = agent.name;
    plate.userData.color = agent.color;
    return plate;
  }

  removeCharacter(ch) {
    for (const mesh of [ch.mesh, ch.plate, ch.bubble]) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      if (mesh === ch.plate && mesh.material.map) mesh.material.map.dispose();
      mesh.material.dispose();
    }
    ch.texture.dispose();
    if (this.hovered && this.hovered.id === ch.id) {
      this.hovered = null;
      if (this.onHover) this.onHover(null);
    }
  }

  targetFor(agent, workerIndex, claudeIndex, review, targetIndex, n) {
    if (agent.group === 'claude') {
      const idx = claudeIndex.get(agent.id) || 0;
      if (agent.state === 'reviewing' && review && targetIndex !== undefined) {
        return { target: reviewSpot(targetIndex, n), restMode: 'review', facing: 'right' };
      }
      if (agent.state === 'working') {
        return { target: this.manager.work[Math.min(idx, this.manager.work.length - 1)], restMode: 'manager' };
      }
      return { target: this.manager.idle[Math.min(idx, this.manager.idle.length - 1)], restMode: 'sofa' };
    }
    const idx = workerIndex.get(agent.id) || 0;
    if (agent.state === 'working' || agent.state === 'reviewing') {
      return { target: this.slotList[Math.min(idx, this.slotList.length - 1)].seat, restMode: 'desk' };
    }
    return { target: this.seatList[Math.min(idx, this.seatList.length - 1)], restMode: 'bench' };
  }

  setState(state) {
    if (!state || !Array.isArray(state.agents)) return;
    this.state = state;
    const agents = state.agents.filter((a) => a && a.id);
    const claudes = agents.filter((a) => a.group === 'claude');
    const workers = agents.filter((a) => a.group !== 'claude');
    const n = workers.length;
    this.ensureDesks(Math.max(12, n));
    this.ensureBenches(Math.max(20, n));
    const workerIndex = new Map(workers.map((a, i) => [a.id, i]));
    const claudeIndex = new Map(claudes.map((a, i) => [a.id, i]));
    const review = state.review && typeof state.review === 'object' ? state.review : null;
    const targetIndex = review ? workerIndex.get(review.target) : undefined;
    const seen = new Set();

    for (const agent of agents) {
      seen.add(agent.id);
      let ch = this.characters.get(agent.id);
      if (!ch) {
        ch = this.createCharacter(agent);
        this.characters.set(agent.id, ch);
      }
      ch.agent = agent;
      ch.alert = !!(review && review.target === agent.id);
      const goal = this.targetFor(agent, workerIndex, claudeIndex, review, targetIndex, n);
      const target = goal.target;
      const restMode = goal.restMode;
      // Bench and sofa neighbours alternate nameplate height.
      ch.plateRaise = (restMode === 'bench' || restMode === 'sofa') ? (target.plateRaise || 0) : 0;

      if (!this.initialized) {
        ch.x = target.x;
        ch.y = target.y;
        ch.walking = false;
        ch.path.length = 0;
        ch.restMode = restMode;
        ch.nextMode = restMode;
        ch.idleT = 0;
        ch.face = this.restFacing(ch);
        ch.goal.x = target.x;
        ch.goal.y = target.y;
      } else {
        const same = Math.abs(target.x - ch.x) < 0.5 && Math.abs(target.y - ch.y) < 0.5;
        const sameGoal = ch.walking && Math.abs(target.x - ch.goal.x) < 0.5 && Math.abs(target.y - ch.goal.y) < 0.5;
        if (!same && !sameGoal) this.startWalk(ch, target, restMode);
        else {
          ch.restMode = restMode;
          ch.nextMode = restMode;
          ch.goal.x = target.x;
          ch.goal.y = target.y;
          if (restMode !== 'bench' && restMode !== 'sofa') ch.idleT = 0;
        }
      }
      if (restMode === 'review') ch.reviewFacing = goal.facing || 'right';
    }

    for (const [id, ch] of this.characters) {
      if (seen.has(id)) continue;
      this.removeCharacter(ch);
      this.characters.delete(id);
    }
    this.initialized = true;
    this.applyScreens(agents, workerIndex);
  }

  startWalk(ch, target, restMode) {
    const points = pathBetween({ x: ch.x, y: ch.y }, { x: target.x, y: target.y });
    ch.path = [];
    for (let i = 1; i < points.length; i++) ch.path.push({ x: points[i].x, y: points[i].y });
    ch.nextMode = restMode;
    ch.goal.x = target.x;
    ch.goal.y = target.y;
    ch.animT = 0;
    if (ch.path.length === 0) {
      ch.walking = false;
      ch.restMode = restMode;
      ch.x = target.x;
      ch.y = target.y;
    } else {
      ch.walking = true;
    }
  }

  applyScreens(agents, workerIndex) {
    const onDesks = new Set();
    let managerOn = false;
    for (const agent of agents) {
      const active = agent.state === 'working' || agent.state === 'reviewing';
      if (agent.group === 'claude') managerOn = managerOn || active;
      else if (active) onDesks.add(workerIndex.get(agent.id));
    }
    for (let i = 0; i < this.deskMeshes.length; i++) {
      const mesh = this.deskMeshes[i];
      const on = onDesks.has(i);
      if (mesh.userData.screen === on) continue;
      mesh.userData.screen = on;
      mesh.material.map = on ? this.textures.deskOn : this.textures.deskOff;
      mesh.material.needsUpdate = true;
    }
    if (this.managerDeskMesh && this.managerDeskMesh.userData.screen !== managerOn) {
      this.managerDeskMesh.userData.screen = managerOn;
      this.managerDeskMesh.material.map = managerOn ? this.textures.mgrOn : this.textures.mgrOff;
      this.managerDeskMesh.material.needsUpdate = true;
    }
  }

  restFacing(ch) {
    if (ch.restMode === 'desk' || ch.restMode === 'bench') return 'up';
    if (ch.restMode === 'review') return ch.reviewFacing;
    return 'down';
  }

  advance(ch, dt) {
    let remain = SPEED * dt;
    while (remain > 0.0001 && ch.path.length > 0) {
      const wp = ch.path[0];
      const dx = wp.x - ch.x;
      const dy = wp.y - ch.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= remain) {
        ch.x = wp.x;
        ch.y = wp.y;
        remain -= dist;
        ch.path.shift();
        if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) ch.face = this.dirFacing(dx, dy);
      } else {
        const k = remain / dist;
        ch.x += dx * k;
        ch.y += dy * k;
        ch.face = this.dirFacing(dx, dy);
        remain = 0;
      }
    }
    if (ch.path.length === 0) {
      ch.walking = false;
      ch.restMode = ch.nextMode;
      ch.idleT = 0;
      ch.face = this.restFacing(ch);
    }
  }

  dirFacing(dx, dy) {
    if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'right' : 'left';
    return dy > 0 ? 'down' : 'up';
  }

  setFrame(ch, pose, facing) {
    ch.texture.offset.set((POSE_INDEX[pose] || 0) / 9, 1 - ((FACING_INDEX[facing] || 0) + 1) / 4);
  }

  update(dt) {
    const d = Math.min(Math.max(Number(dt) || 0, 0), 0.1);
    if (d <= 0) return;
    const frame = Math.floor(this.globalT * FRAME_FPS) % 2 === 1;
    for (const ch of this.characters.values()) {
      ch.animT += d;
      if (ch.walking) this.advance(ch, d);
      if (!ch.walking && (ch.restMode === 'bench' || ch.restMode === 'sofa')) ch.idleT += d;

      let pose = 'stand';
      let facing = this.restFacing(ch);
      if (ch.walking) {
        pose = frame ? 'walk2' : 'walk1';
        facing = ch.face;
      } else if (ch.restMode === 'desk' || ch.restMode === 'manager') {
        pose = frame ? 'type2' : 'type1';
      } else if (ch.restMode === 'review') {
        pose = frame ? 'review2' : 'review1';
      } else if (ch.restMode === 'bench' || ch.restMode === 'sofa') {
        pose = ch.idleT > SLEEP_AFTER ? 'sleep' : 'sit';
      }

      let kind = null;
      if (ch.alert) kind = 'alert';
      else if (!ch.walking && ch.restMode === 'review') kind = 'review';
      else if (!ch.walking && ch.restMode === 'desk') kind = 'code';
      else if (ch.idleT > SLEEP_AFTER) kind = 'zzz';

      this.setFrame(ch, pose, facing);
      this.placeCharacter(ch, kind);
    }
    this.globalT += d;
  }

  placeCharacter(ch, kind) {
    const wx = Math.round(ch.x);
    const artY = Math.round(ch.y);
    const bottom = ROOM_H - artY;
    ch.mesh.position.set(wx, bottom + CHAR_H / 2, 0);
    ch.mesh.renderOrder = artY * 2 + 3;

    const plateH = ch.plate.userData.h;
    const raise = ch.plateRaise || 0;
    ch.plate.position.set(wx, bottom + CHAR_H + 2 + plateH / 2 + raise, 0);
    ch.plate.renderOrder = 10000 + artY;
    ch.bubble.position.set(wx, bottom + CHAR_H + 4 + plateH + 6 + raise, 0);
    ch.bubble.renderOrder = 11000 + artY;
    if (kind !== ch.bubbleKind) {
      ch.bubbleKind = kind;
      if (kind) ch.bubble.material.map = this.textures.bubbles[kind];
    }
    ch.bubble.visible = !!kind;
  }

  bindPointer() {
    this.canvas.addEventListener('pointermove', (event) => {
      const rect = this.canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      this.pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -(((event.clientY - rect.top) / rect.height) * 2 - 1),
      );
      this.hoverAtPointer();
    });
    this.canvas.addEventListener('pointerleave', () => {
      if (!this.hovered) return;
      this.hovered = null;
      if (this.onHover) this.onHover(null);
    });
    this.canvas.addEventListener('click', () => {
      const agent = this.agentAtPointer();
      if (agent && this.onSelect) this.onSelect(agent);
    });
  }

  agentAtPointer() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const meshes = [];
    for (const ch of this.characters.values()) meshes.push(ch.mesh);
    const hits = this.raycaster.intersectObjects(meshes, false);
    if (hits.length === 0) return null;
    const ch = this.characters.get(hits[0].object.userData.agentId);
    return ch ? ch.agent : null;
  }

  hoverAtPointer() {
    const agent = this.agentAtPointer();
    if (agent === this.hovered) return;
    this.hovered = agent;
    if (this.onHover) this.onHover(agent);
  }

  resize(width, height) {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    // Integer zoom keeps every art pixel square and crisp.
    const zoom = Math.max(1, Math.floor(Math.min(w / ROOM_W, h / ROOM_H)));
    this.camera.left = -w / (2 * zoom);
    this.camera.right = w / (2 * zoom);
    this.camera.top = h / (2 * zoom);
    this.camera.bottom = -h / (2 * zoom);
    this.camera.near = 0.1;
    this.camera.far = 1000;
    this.camera.position.set(ROOM_W / 2, ROOM_H / 2, 100);
    this.camera.lookAt(ROOM_W / 2, ROOM_H / 2, 0);
    this.camera.updateProjectionMatrix();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
