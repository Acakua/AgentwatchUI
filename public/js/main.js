import { Office } from './office.js';
import { initHud, update as updateHud, setOffline, showAgent } from './hud.js';
import { createDemoState } from './demo-state.js';

const canvas = document.getElementById('office');
initHud(document.getElementById('hud'));

const office = new Office(canvas);
office.onHover = showAgent;
office.onSelect = showAgent;

// The office takes the top of the window at an integer zoom; whatever height is
// left over becomes the HUD dock (CSS reads --dock).
const TOP_BAR = 28;
const MIN_DOCK = 150;
function fit() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const zoom = Math.max(1, Math.floor(Math.min(w / 480, (h - TOP_BAR - MIN_DOCK) / 270)));
  const dock = Math.max(MIN_DOCK, Math.min(h - TOP_BAR - zoom * 270, Math.floor(h * 0.45)));
  document.documentElement.style.setProperty('--dock', dock + 'px');
  office.resize(w, Math.max(1, h - TOP_BAR - dock));
}
window.addEventListener('resize', fit);
fit();

let lastTime = performance.now();
function frame(now) {
  const dt = (now - lastTime) / 1000;
  lastTime = now;
  office.update(dt);
  office.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

const params = new URLSearchParams(window.location.search);

if (params.get('demo') === '1') {
  const demo = createDemoState();
  const tick = () => {
    const state = demo.tick();
    setOffline(false);
    office.setState(state);
    updateHud(state);
  };
  tick();
  window.setInterval(tick, 500);
} else {
  let lastState = null;

  async function poll() {
    try {
      const res = await fetch('/api/state', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const state = await res.json();
      lastState = state;
      setOffline(false);
      office.setState(state);
      updateHud(state);
    } catch (err) {
      setOffline(true);
      if (lastState) updateHud(lastState);
    }
  }

  poll();
  window.setInterval(poll, 2000);
}
