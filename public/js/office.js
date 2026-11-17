import * as THREE from '../vendor/three.module.js';
import {
  CHAR_W, CHAR_H, characterSheet, drawDesk, drawManagerDesk, drawBench,
  drawBubble, drawNameplate, drawShadow,
} from './sprites.js';
import {
  ROOM_W, ROOM_H, BENCH_W, BENCH_H, deskSlots, benchSeats, managerSpots, reviewSpot, pathBetween,
} from './layout.js';
import { makeTexture, makeMesh, placeSprite, buildStaticRoom, bindPointer, resizeCamera } from './office-room.js';

const SPEED = 40;
const FRAME_FPS = 4;
const SLEEP_AFTER = 60;
const POSE_INDEX = { stand: 0, walk1: 1, walk2: 2, sit: 3, type1: 4, type2: 5, review1: 6, review2: 7, sleep: 8 };
const FACING_INDEX = { down: 0, up: 1, left: 2, right: 3 };
const HAIR = ['#3b2a1a', '#1a1a2e', '#5b3a1a', '#7a5a3a', '#d9d9d9'];
const SKIN = ['#f2c9a0', '#d4a574', '#e8b98a', '#f7d9b8'];
const BUBBLES = ['code', 'review', 'zzz', 'ok', 'alert', 'quota'];

function hashId(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class Office {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0b1220');
    this.camera = new THREE.OrthographicCamera(-240, 240, 135, -135, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.characters = new Map();
    this.slotList = [];
    this.seatList = [];
    this.deskMeshes = [];
    this.deskShadows = [];
    this.deskCapacity = 0;
    this.seatCapacity = 0;
    this.initialized = false;
    this.hovered = null;
    this.onHover = null;
    this.onSelect = null;
    this.globalT = 0;

    this.textures = {
      deskOn: makeTexture(drawDesk({ screenOn: true })),
      deskOff: makeTexture(drawDesk({ screenOn: false })),
      mgrOn: makeTexture(drawManagerDesk({ screenOn: true })),
      mgrOff: makeTexture(drawManagerDesk({ screenOn: false })),
      shadowChar: makeTexture(drawShadow(12)),
      shadow32: makeTexture(drawShadow(32)),
      shadow48: makeTexture(drawShadow(48)),
      bubbles: {},
    };
    for (const kind of BUBBLES) this.textures.bubbles[kind] = makeTexture(drawBubble(kind));

    this.manager = managerSpots(6);
    this.buildRoom();
    bindPointer(this);
    this.resize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight);
  }

  addStatic(canvas, width, height, centerX, bottomY, layer) {
    const mesh = makeMesh(width, height, makeTexture(canvas));
    placeSprite(mesh, centerX, bottomY, layer);
    this.scene.add(mesh);
    return mesh;
  }

  buildRoom() {
    buildStaticRoom(this);
    this.claudeDesks = [];
    for (const spot of this.manager.desks) {
      const onTex = spot.desk.big ? this.textures.mgrOn : this.textures.deskOn;
      const offTex = spot.desk.big ? this.textures.mgrOff : this.textures.deskOff;
      const mesh = makeMesh(spot.desk.w, spot.desk.h, offTex);
      mesh.userData.screen = false;
      mesh.userData.onTex = onTex;
      mesh.userData.offTex = offTex;
      placeSprite(mesh, spot.desk.x + spot.desk.w / 2, spot.desk.y + spot.desk.h, 1);
      this.scene.add(mesh);
      this.addDeskShadow(spot.desk, mesh, spot.desk.big ? this.textures.shadow48 : this.textures.shadow32);
      this.claudeDesks.push(mesh);
    }
  }

  addDeskShadow(desk, mesh, texture) {
    const shadow = makeMesh(desk.w, 4, texture);
    placeSprite(shadow, desk.x + desk.w / 2, desk.y + desk.h + 2, 1);
    shadow.renderOrder = mesh.renderOrder - 1;
    this.scene.add(shadow);
    return shadow;
  }

  ensureDesks(capacity) {
    if (capacity === this.deskCapacity) return;
    for (const desk of this.deskMeshes.concat(this.deskShadows)) {
      this.scene.remove(desk);
      desk.geometry.dispose();
      desk.material.dispose();
    }
    this.deskMeshes = [];
    this.deskShadows = [];
    this.deskCapacity = capacity;
    this.slotList = deskSlots(capacity);
    for (const slot of this.slotList) {
      const desk = makeMesh(32, 24, this.textures.deskOff);
      desk.userData.screen = false;
      placeSprite(desk, slot.desk.x + 16, slot.desk.y + 24, 2);
      this.scene.add(desk);
      this.deskMeshes.push(desk);
      this.deskShadows.push(this.addDeskShadow(slot.desk, desk, this.textures.shadow32));
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
    const shadow = makeMesh(12, 4, this.textures.shadowChar);
    this.scene.add(shadow);
    return {
      id: agent.id, agent, mesh, texture, plate, bubble, shadow, bubbleKind: null,
      x: 240, y: 200, path: [], walking: false, restMode: 'stand', nextMode: 'stand',
      goal: { x: 240, y: 200 }, face: 'down', reviewFacing: 'down', alert: false, animT: 0, idleT: 0,
      plateRaise: 0, blocked: false,
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
    for (const mesh of [ch.mesh, ch.plate, ch.bubble, ch.shadow]) {
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
      const last = this.manager.desks.length - 1;
      if (agent.state === 'reviewing' && review) {
        const spot = targetIndex !== undefined
          ? reviewSpot(targetIndex, n)
          : this.manager.desks[Math.min(idx, last)].review;
        return { target: spot, restMode: 'review', facing: 'right' };
      }
      if (agent.state === 'working') {
        // Same seat geometry and typing pose as an opencode worker.
        return { target: this.manager.desks[Math.min(idx, last)].seat, restMode: 'desk' };
      }
      const seat = this.manager.lounge[Math.min(idx, this.manager.lounge.length - 1)];
      return { target: seat, restMode: 'sofa' };
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
    const now = Number(state.now) || 0;
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
      ch.blocked = now > 0 && Number(agent.blockedUntil) > now;
      ch.plate.material.opacity = ch.blocked ? 0.55 : 1;
      // Idle guests (models outside the roster) would bury the bench in labels.
      ch.plate.visible = !(agent.role === 'guest' && agent.state === 'idle');
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
    this.applyScreens(agents, workerIndex, claudeIndex);
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

  applyScreens(agents, workerIndex, claudeIndex) {
    const onDesks = new Set();
    const claudeOn = new Set();
    for (const agent of agents) {
      if (agent.group === 'claude') {
        if (agent.state === 'working') {
          const idx = claudeIndex.get(agent.id);
          if (idx !== undefined) claudeOn.add(Math.min(idx, this.claudeDesks.length - 1));
        }
      } else if (agent.state === 'working' || agent.state === 'reviewing') {
        onDesks.add(workerIndex.get(agent.id));
      }
    }
    for (let i = 0; i < this.deskMeshes.length; i++) {
      const mesh = this.deskMeshes[i];
      const on = onDesks.has(i);
      if (mesh.userData.screen === on) continue;
      mesh.userData.screen = on;
      mesh.material.map = on ? this.textures.deskOn : this.textures.deskOff;
      mesh.material.needsUpdate = true;
    }
    for (let i = 0; i < this.claudeDesks.length; i++) {
      const mesh = this.claudeDesks[i];
      const on = claudeOn.has(i);
      if (mesh.userData.screen === on) continue;
      mesh.userData.screen = on;
      mesh.material.map = on ? mesh.userData.onTex : mesh.userData.offTex;
      mesh.material.needsUpdate = true;
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
      } else if (ch.restMode === 'desk') {
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
      else if (!ch.walking && ch.blocked && (ch.restMode === 'bench' || ch.restMode === 'sofa')) kind = 'quota';
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
    ch.shadow.position.set(wx, bottom + 2, 0);
    ch.shadow.renderOrder = artY * 2 + 2;

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

  resize(width, height) {
    resizeCamera(this, width, height);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
