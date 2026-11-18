// First-person walk mode: stroll the apron and around the terminals at ground level.
// Keys: WASD or arrows to walk, Shift to run, Esc to leave. Mouse: drag to look.
// Touch: the on-screen pad walks, and dragging the view looks around.
// Collisions use the same footprints the airport is built from (see buildColliders).

const EYE = 0.9; // eye height in world units (1 unit = 2 m), about 1.8 m
const BODY = 1.2; // collision radius, about 2.4 m
const SPEED = 6; // units per second, about 12 m/s
const SPRINT = 2;
const FOV = 70;

// The area a visitor can roam: the apron, the parallel taxiway and the runway edge.
export const WALK_BOUNDS = { minX: -560, maxX: 330, minZ: -950, maxZ: 520 };
// Start on the apron, facing the hero terminal (+x is east).
const START = { x: -160, z: -25, yaw: Math.PI / 2 };

const MOVE = {
  KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b',
  KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
};

const box = (minX, maxX, minZ, maxZ) => ({ minX, maxX, minZ, maxZ });
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Solid footprints from the airport spec: terminals, tower, cargo sheds and parked aircraft.
export function buildColliders(spec) {
  const boxes = spec.terminals.map((t) => box(t.x - t.w / 2, t.x + t.w / 2, t.z - t.d / 2, t.z + t.d / 2));
  const { x: tx, z: tz } = spec.tower;
  boxes.push(box(tx - 7, tx + 7, tz - 7, tz + 7));
  for (const [x, z, w, d] of spec.sheds) boxes.push(box(x - w / 2, x + w / 2, z - d / 2, z + d / 2));
  for (const [x, z] of spec.stands) boxes.push(box(x - 22, x + 22, z - 22, z + 22));
  return boxes;
}

// root: the walk overlay (holds [data-k] pad buttons and a [data-exit] button).
export function createWalker({ canvas, spec, root, onExit }) {
  const colliders = buildColliders(spec);
  const held = new Set(); // 'f' 'b' 'l' 'r' 'sprint', from keys or the pad
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const s = { active: false, x: 0, z: 0, yaw: 0, pitch: 0, vx: 0, vz: 0, t: 0, drag: false, sx: 0, sy: 0 };

  const blocked = (x, z) => {
    const b = WALK_BOUNDS;
    if (x < b.minX + BODY || x > b.maxX - BODY || z < b.minZ + BODY || z > b.maxZ - BODY) return true;
    return colliders.some((c) => x > c.minX - BODY && x < c.maxX + BODY && z > c.minZ - BODY && z < c.maxZ + BODY);
  };

  // Keyboard.
  addEventListener('keydown', (e) => {
    if (!s.active) return;
    if (e.code === 'Escape') {
      onExit?.();
      return;
    }
    const name = MOVE[e.code];
    if (!name) return;
    held.add(name);
    e.preventDefault();
  });
  addEventListener('keyup', (e) => {
    const name = MOVE[e.code];
    if (name) held.delete(name);
  });
  addEventListener('blur', () => held.clear());

  // On-screen pad for touch screens.
  root.querySelectorAll('[data-k]').forEach((btn) => {
    const name = btn.dataset.k;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      btn.setPointerCapture(e.pointerId);
      held.add(name);
    });
    const release = () => held.delete(name);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('lostpointercapture', release);
  });
  root.querySelector('[data-exit]')?.addEventListener('click', () => onExit?.());

  // Drag to look.
  canvas.addEventListener('pointerdown', (e) => {
    if (!s.active) return;
    s.drag = true;
    s.sx = e.clientX;
    s.sy = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!s.active || !s.drag) return;
    s.yaw -= (e.clientX - s.sx) * 0.005;
    s.pitch = clamp(s.pitch - (e.clientY - s.sy) * 0.004, -1.2, 1.2);
    s.sx = e.clientX;
    s.sy = e.clientY;
  });
  const endDrag = () => (s.drag = false);
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  return {
    get active() {
      return s.active;
    },
    enable() {
      Object.assign(s, { active: true, ...START, vx: 0, vz: 0, pitch: 0, drag: false });
      held.clear();
      root.hidden = false;
    },
    disable() {
      Object.assign(s, { active: false, drag: false });
      held.clear();
      root.hidden = true;
    },
    update(dt, camera) {
      const fwd = (held.has('f') ? 1 : 0) - (held.has('b') ? 1 : 0);
      const side = (held.has('r') ? 1 : 0) - (held.has('l') ? 1 : 0);
      const len = Math.hypot(fwd, side) || 1;
      const speed = SPEED * (held.has('sprint') ? SPRINT : 1);
      const sin = Math.sin(s.yaw);
      const cos = Math.cos(s.yaw);
      // On the ground, forward is (sin, cos) and right is (-cos, sin).
      const tx = ((sin * fwd - cos * side) / len) * speed;
      const tz = ((cos * fwd + sin * side) / len) * speed;

      // Ease into and out of motion, then move one axis at a time so walls slide.
      const k = Math.min(1, dt * 8);
      s.vx += (tx - s.vx) * k;
      s.vz += (tz - s.vz) * k;
      const nx = s.x + s.vx * dt;
      if (blocked(nx, s.z)) s.vx = 0;
      else s.x = nx;
      const nz = s.z + s.vz * dt;
      if (blocked(s.x, nz)) s.vz = 0;
      else s.z = nz;

      s.t += dt;
      const moving = Math.min(1, Math.hypot(s.vx, s.vz) / SPEED);
      const eye = EYE + (reduce ? 0 : Math.sin(s.t * 9) * 0.035 * moving);
      const cp = Math.cos(s.pitch);
      camera.position.set(s.x, eye, s.z);
      camera.lookAt(s.x + sin * cp * 10, eye + Math.sin(s.pitch) * 10, s.z + cos * cp * 10);
      camera.fov = FOV;
      camera.updateProjectionMatrix();
    },
  };
}
