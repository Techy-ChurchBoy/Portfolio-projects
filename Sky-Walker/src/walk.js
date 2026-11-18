// First-person walk mode: explore the apron and walk into the hero terminal at ground level.
// Keys: WASD or arrows to walk, Shift to run, E to interact, Esc to leave or close a panel.
// Mouse: drag to look. Touch: the on-screen pad walks, and dragging the view looks around.
// Collisions and interaction spots come from the airport spec (buildColliders) and INTERIOR below.

import { waitingLayout } from './airports/waiting.js';

const EYE = 0.9; // eye height in world units (1 unit = 2 m), about 1.8 m
const SEAT_EYE = 0.6; // seated eye height
const BODY = 1.2; // collision radius, about 2.4 m
const WALL = 1; // half thickness of hall walls
const DOOR = 6; // half width of each hall doorway (about 24 m across)
const SPEED = 12; // units per second, about 24 m/s
const SPRINT = 2;
const TURN = 2.4; // radians per second for Q and E
const STICK_RADIUS = 90; // pixels of drag that count as full speed
const FOV = 70;
const SCRIPT_SPEED = 5; // units per second along a scripted route

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
  KeyQ: 'turnL', KeyE: 'turnR',
};

const box = (minX, maxX, minZ, maxZ) => ({ minX, maxX, minZ, maxZ });
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const isTyping = (el) => !!el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName);

// Walls with a doorway in the west (airside) wall, and in the east (landside) wall unless east is false.
function addHallWalls(boxes, t, { east = true } = {}) {
  const x0 = t.x - t.w / 2;
  const x1 = t.x + t.w / 2;
  const z0 = t.z - t.d / 2;
  const z1 = t.z + t.d / 2;
  const cz = t.z;
  boxes.push(box(x0 - WALL, x0 + WALL, z0 - WALL, cz - DOOR));
  boxes.push(box(x0 - WALL, x0 + WALL, cz + DOOR, z1 + WALL));
  if (east) {
    boxes.push(box(x1 - WALL, x1 + WALL, z0 - WALL, cz - DOOR));
    boxes.push(box(x1 - WALL, x1 + WALL, cz + DOOR, z1 + WALL));
  } else {
    boxes.push(box(x1 - WALL, x1 + WALL, z0 - WALL, z1 + WALL));
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
      addHallWalls(boxes, t, { east: false });
      for (const b of waitingLayout(t).benches) boxes.push(box(b.x - 6, b.x + 6, b.z - 1.5, b.z + 1.5));
    }
  }
  const { x: tx, z: tz } = spec.tower;
  boxes.push(box(tx - 7, tx + 7, tz - 7, tz + 7));
  for (const [x, z, w, d] of spec.sheds) boxes.push(box(x - w / 2, x + w / 2, z - d / 2, z + d / 2));
  for (const [x, z] of spec.stands) boxes.push(box(x - 22, x + 22, z - 22, z + 22));
  return boxes;
}

// Things the visitor can use with E. "panel" opens a page panel; "sit" seats the visitor.
function buildInteractables(spec) {
  const d = INTERIOR.ticketDesk;
  const stand = spec.stands[0];
  const items = [
    { id: 'tickets', label: 'Buy tickets', kind: 'panel', panel: 'booking', box: d, range: 8 },
    { id: 'board', label: 'Check departures', kind: 'panel', panel: 'board', at: INTERIOR.board, range: 16 },
  ];
  for (const z of INTERIOR.benches) {
    items.push({ id: `bench${z}`, label: 'Sit down', kind: 'sit', at: { x: 59, z }, yaw: Math.PI / 2, range: 6 });
  }
  for (const t of spec.terminals.filter((x) => !x.hero)) {
    waitingLayout(t).benches.forEach((b, i) => {
      items.push({ id: `wait-${t.name}-${i}`, label: 'Sit down', kind: 'sit', at: { x: b.x, z: b.z }, yaw: Math.PI, range: 6 });
    });
  }
  items.push({ id: 'security', label: 'Security check', kind: 'action', at: { x: -102, z: 0 }, range: 7 });
  items.push({ id: 'boarding', label: 'Board flight', kind: 'action', at: { x: stand[0] + 30, z: stand[1] }, range: 9 });
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
// game (optional): { label(id), run(id) } for the security and boarding actions.
export function createWalker({ canvas, spec, root, prompt, onExit, onOpen, game }) {
  const colliders = buildColliders(spec);
  const interactables = buildInteractables(spec);
  const held = new Set(); // 'f' 'b' 'l' 'r' 'sprint', from keys or the pad
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const s = {
    active: false, paused: false, seated: false,
    x: 0, z: 0, y: 0, yaw: 0, pitch: 0, vx: 0, vz: 0, t: 0, drag: false, sx: 0, sy: 0,
  };
  // A scripted route (for example, up the boarding stairs) that ignores walls.
  let script = null; // { pts, i, u, done }

  // Moves along the scripted route; calls done() at the end.
  function stepScript(dt) {
    let left = SCRIPT_SPEED * dt;
    while (left > 0 && script.i < script.pts.length - 1) {
      const a = script.pts[script.i];
      const b = script.pts[script.i + 1];
      const seg = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) || 1e-6;
      const rem = seg - script.u;
      if (left >= rem) {
        left -= rem;
        script.i++;
        script.u = 0;
      } else {
        script.u += left;
        left = 0;
      }
    }
    const last = script.i >= script.pts.length - 1;
    const a = script.pts[Math.min(script.i, script.pts.length - 2)];
    const b = script.pts[Math.min(script.i + 1, script.pts.length - 1)];
    const seg = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) || 1e-6;
    const f = last ? 1 : script.u / seg;
    s.x = a.x + (b.x - a.x) * f;
    s.y = a.y + (b.y - a.y) * f;
    s.z = a.z + (b.z - a.z) * f;
    if (Math.hypot(b.x - a.x, b.z - a.z) > 0.01) s.yaw = Math.atan2(b.x - a.x, b.z - a.z);
    if (last) {
      const done = script.done;
      script = null;
      done?.();
    }
  }

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
    else if (item.kind === 'action') game?.run(item.id);
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
  // Drag to move (left button or touch): the drag's offset from where it began sets the direction and speed.
  // Right-button drag looks around, and Q and E turn.
  let stickOrigin = null;
  let stick = { f: 0, s: 0 }; // -1..1, forward and right
  canvas.addEventListener('contextmenu', (e) => {
    if (s.active) e.preventDefault();
  });
  canvas.addEventListener('pointerdown', (e) => {
    if (!s.active || s.paused) return;
    canvas.setPointerCapture(e.pointerId);
    if (e.button === 2) {
      s.drag = true;
      s.sx = e.clientX;
      s.sy = e.clientY;
      return;
    }
    stickOrigin = { x: e.clientX, y: e.clientY };
    stick = { f: 0, s: 0 };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!s.active || s.paused) return;
    if (s.drag) {
      s.yaw -= (e.clientX - s.sx) * 0.005;
      s.pitch = clamp(s.pitch - (e.clientY - s.sy) * 0.004, -1.2, 1.2);
      s.sx = e.clientX;
      s.sy = e.clientY;
    } else if (stickOrigin) {
      const dx = e.clientX - stickOrigin.x;
      const dy = e.clientY - stickOrigin.y;
      const r = Math.hypot(dx, dy) || 1;
      const k = Math.min(r, STICK_RADIUS) / (STICK_RADIUS * r);
      stick = { f: -dy * k, s: dx * k };
    }
  });
  const endDrag = () => {
    s.drag = false;
    stickOrigin = null;
    stick = { f: 0, s: 0 };
  };
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
      script = null;
      Object.assign(s, { active: true, seated: false, ...START, y: 0, vx: 0, vz: 0, pitch: 0, drag: false });
      held.clear();
      root.hidden = false;
    },
    disable() {
      script = null;
      Object.assign(s, { active: false, seated: false, drag: false });
      held.clear();
      root.hidden = true;
    },
    stand() {
      if (s.seated) stand();
    },
    // Walk a scripted route from where the visitor stands. Input is frozen until it ends.
    scripted(points, done) {
      script = { pts: [{ x: s.x, y: s.y, z: s.z }, ...points], i: 0, u: 0, done };
      Object.assign(s, { vx: 0, vz: 0, drag: false, paused: true });
      held.clear();
    },
    // Put the visitor at a spot on the ground (after a scripted route).
    place(x, z, yaw) {
      Object.assign(s, { x, z, y: 0, yaw, vx: 0, vz: 0, seated: false });
    },
    get scripting() {
      return !!script;
    },
    // While a page panel is open the walk is frozen and the keys are left to the panel.
    pause(on) {
      s.paused = on;
      held.clear();
      s.drag = false;
    },
    update(dt, camera) {
      if (script) stepScript(dt);
      const frozen = s.paused || s.seated || !!script;
      if (!frozen) s.yaw += ((held.has('turnL') ? 1 : 0) - (held.has('turnR') ? 1 : 0)) * TURN * dt;
      const keyF = (held.has('f') ? 1 : 0) - (held.has('b') ? 1 : 0);
      const keyS = (held.has('r') ? 1 : 0) - (held.has('l') ? 1 : 0);
      const fwd = frozen ? 0 : clamp(keyF + stick.f, -1, 1);
      const side = frozen ? 0 : clamp(keyS + stick.s, -1, 1);
      const len = Math.max(1, Math.hypot(fwd, side)); // partial drags stay partial
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
      // Seated time (waiting for the boarding call) is reported to the game.
      if (s.seated) game?.tick?.(dt);
      const moving = Math.min(1, Math.hypot(s.vx, s.vz) / SPEED);
      const base = (s.seated ? SEAT_EYE : EYE) + s.y;
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
        if (item) prompt.textContent = `E · ${(item.kind === 'action' && game?.label(item.id)) || item.label}`;
      }
    },
  };
}
