// First-person walk mode: explore the apron and walk into the hero terminal at ground level.
// Keys: WASD or arrows to walk, Shift to run, E to interact, Esc to leave or close a panel.
// Mouse: drag to look. Touch: the on-screen pad walks, and dragging the view looks around.
// Collisions and interaction spots come from the airport spec (buildColliders) and INTERIOR below.

const EYE = 0.9; // eye height in world units (1 unit = 2 m), about 1.8 m
const SEAT_EYE = 0.6; // seated eye height
const BODY = 1.2; // collision radius, about 2.4 m
const WALL = 1; // half thickness of hall walls
const DOOR = 6; // half width of each hall doorway (about 24 m across)
const SPEED = 6; // units per second, about 12 m/s
const SPRINT = 2;
const FOV = 70;

// The area a visitor can roam: the apron, the parallel taxiway and the runway edge.
export const WALK_BOUNDS = { minX: -560, maxX: 330, minZ: -950, maxZ: 520 };
// Start on the apron outside the airside doorway, facing the hall.
const START = { x: -160, z: -25, yaw: Math.PI / 2 };

// Hall fixtures in world units (the hall is centred on the origin, see los.js).
const INTERIOR = {
  ticketDesk: { minX: -70, maxX: -54, minZ: -50, maxZ: -20 },
  board: { x: 0, z: -80 },
  benches: [-40, 0, 40],
  columnsX: [-90, -50, -10, 30, 70],
  columnsZ: [-78, 78],
};

const MOVE = {
  KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b',
  KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
};

const box = (minX, maxX, minZ, maxZ) => ({ minX, maxX, minZ, maxZ });
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const isTyping = (el) => !!el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName);

// Hall walls with a doorway in the west (airside) and east (landside) walls.
function addHallWalls(boxes, t) {
  const x0 = t.x - t.w / 2;
  const x1 = t.x + t.w / 2;
  const z0 = t.z - t.d / 2;
  const z1 = t.z + t.d / 2;
  const cz = t.z;
  for (const x of [x0, x1]) {
    boxes.push(box(x - WALL, x + WALL, z0 - WALL, cz - DOOR));
    boxes.push(box(x - WALL, x + WALL, cz + DOOR, z1 + WALL));
  }
  boxes.push(box(x0 - WALL, x1 + WALL, z0 - WALL, z0 + WALL)); // north
  boxes.push(box(x0 - WALL, x1 + WALL, z1 - WALL, z1 + WALL)); // south
}

// Solid footprints from the airport spec: hall walls and fixtures, other terminals, tower, sheds, parked aircraft.
export function buildColliders(spec) {
  const boxes = [];
  for (const t of spec.terminals) {
    if (t.hero) {
      addHallWalls(boxes, t);
      boxes.push(INTERIOR.ticketDesk);
      for (const z of INTERIOR.benches) boxes.push(box(56, 62, z - 4, z + 4));
      for (const x of INTERIOR.columnsX) for (const z of INTERIOR.columnsZ) boxes.push(box(x - 2.2, x + 2.2, z - 2.2, z + 2.2));
    } else {
      boxes.push(box(t.x - t.w / 2, t.x + t.w / 2, t.z - t.d / 2, t.z + t.d / 2));
    }
  }
  const { x: tx, z: tz } = spec.tower;
  boxes.push(box(tx - 7, tx + 7, tz - 7, tz + 7));
  for (const [x, z, w, d] of spec.sheds) boxes.push(box(x - w / 2, x + w / 2, z - d / 2, z + d / 2));
  for (const [x, z] of spec.stands) boxes.push(box(x - 22, x + 22, z - 22, z + 22));
  return boxes;
}

// Things the visitor can use with E. "panel" opens a page panel; "sit" seats the visitor.
function buildInteractables() {
  const d = INTERIOR.ticketDesk;
  const items = [
    { id: 'tickets', label: 'Buy tickets', kind: 'panel', panel: 'booking', box: d, range: 8 },
    { id: 'board', label: 'Check departures', kind: 'panel', panel: 'board', at: INTERIOR.board, range: 16 },
  ];
  for (const z of INTERIOR.benches) {
    items.push({ id: `bench${z}`, label: 'Sit down', kind: 'sit', at: { x: 59, z }, yaw: Math.PI / 2, range: 6 });
  }
  return items;
}

const distTo = (item, x, z) => {
  if (item.box) {
    const b = item.box;
    return Math.hypot(x - clamp(x, b.minX, b.maxX), z - clamp(z, b.minZ, b.maxZ));
  }
  return Math.hypot(x - item.at.x, z - item.at.z);
};

// root: the walk overlay (holds [data-k] pad buttons, a [data-exit] button and the prompt).
// onOpen(panelId) is called when the visitor uses a panel item; onExit() when they press Esc.
export function createWalker({ canvas, spec, root, prompt, onExit, onOpen }) {
  const colliders = buildColliders(spec);
  const interactables = buildInteractables();
  const held = new Set(); // 'f' 'b' 'l' 'r' 'sprint', from keys or the pad
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const s = {
    active: false, paused: false, seated: false,
    x: 0, z: 0, yaw: 0, pitch: 0, vx: 0, vz: 0, t: 0, drag: false, sx: 0, sy: 0,
  };

  const blocked = (x, z) => {
    const b = WALK_BOUNDS;
    if (x < b.minX + BODY || x > b.maxX - BODY || z < b.minZ + BODY || z > b.maxZ - BODY) return true;
    return colliders.some((c) => x > c.minX - BODY && x < c.maxX + BODY && z > c.minZ - BODY && z < c.maxZ + BODY);
  };

  const nearest = () => {
    let best = null;
    let bestD = Infinity;
    for (const item of interactables) {
      const d = distTo(item, s.x, s.z);
      if (d <= item.range && d < bestD) {
        best = item;
        bestD = d;
      }
    }
    return best;
  };

  const sit = (item) => {
    Object.assign(s, { seated: true, x: item.at.x, z: item.at.z, yaw: item.yaw, pitch: 0, vx: 0, vz: 0 });
    held.clear();
  };
  const stand = () => {
    s.seated = false;
    s.x -= 6; // step off the bench to the west, clear of its footprint
    s.vx = 0;
    s.vz = 0;
  };

  function interact() {
    if (s.seated) return stand();
    const item = nearest();
    if (!item) return;
    if (item.kind === 'sit') sit(item);
    else onOpen?.(item.panel);
  }

  // Keyboard.
  addEventListener('keydown', (e) => {
    if (!s.active) return;
    if (e.code === 'Escape') {
      onExit?.();
      return;
    }
    if (s.paused || isTyping(e.target)) return;
    if (e.code === 'KeyE') {
      e.preventDefault();
      if (!e.repeat) interact();
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

  // On-screen pad for touch screens, plus the on-screen buttons.
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
  root.querySelector('[data-use]')?.addEventListener('click', () => interact());

  // Drag to look.
  canvas.addEventListener('pointerdown', (e) => {
    if (!s.active || s.paused) return;
    s.drag = true;
    s.sx = e.clientX;
    s.sy = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!s.active || !s.drag || s.paused) return;
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
    get seated() {
      return s.seated;
    },
    enable() {
      Object.assign(s, { active: true, seated: false, ...START, vx: 0, vz: 0, pitch: 0, drag: false });
      held.clear();
      root.hidden = false;
    },
    disable() {
      Object.assign(s, { active: false, seated: false, drag: false });
      held.clear();
      root.hidden = true;
    },
    stand() {
      if (s.seated) stand();
    },
    // While a page panel is open the walk is frozen and the keys are left to the panel.
    pause(on) {
      s.paused = on;
      held.clear();
      s.drag = false;
    },
    update(dt, camera) {
      const frozen = s.paused || s.seated;
      const fwd = frozen ? 0 : (held.has('f') ? 1 : 0) - (held.has('b') ? 1 : 0);
      const side = frozen ? 0 : (held.has('r') ? 1 : 0) - (held.has('l') ? 1 : 0);
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
      const base = s.seated ? SEAT_EYE : EYE;
      const eye = base + (reduce || s.seated ? 0 : Math.sin(s.t * 9) * 0.035 * moving);
      const cp = Math.cos(s.pitch);
      camera.position.set(s.x, eye, s.z);
      camera.lookAt(s.x + sin * cp * 10, eye + Math.sin(s.pitch) * 10, s.z + cos * cp * 10);
      camera.fov = FOV;
      camera.updateProjectionMatrix();

      // Prompt for the nearest thing in reach.
      if (prompt) {
        const item = s.paused ? null : s.seated ? { label: 'Stand up' } : nearest();
        prompt.hidden = !item;
        if (item) prompt.textContent = `E · ${item.label}`;
      }
    },
  };
}
