import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import gsap from 'gsap';
import { LOS } from './airports/los.js';
import { buildWorld } from './world.js';
import { createWalker } from './walk.js';
import { loadTicket, saveTicket } from './ticket.js';
import { $ } from './ui.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smooth = (t) => t * t * (3 - 2 * t);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

async function loadAircraft() {
  const res = await fetch(`${import.meta.env.BASE_URL}assets/aircraft.glb`);
  if (!res.ok) throw new Error('aircraft ' + res.status);
  const buf = await res.arrayBuffer();
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await new Promise((ok, fail) => loader.parse(buf, '', ok, fail));
  return gltf.scene;
}

async function waitForFonts() {
  try {
    await Promise.race([
      Promise.all([document.fonts.load('700 120px Sora'), document.fonts.load('600 26px "JetBrains Mono"')]),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch {
    /* fall back to system fonts */
  }
}

export async function startScene() {
  let aircraft = null;
  try {
    aircraft = await loadAircraft();
  } catch (err) {
    console.warn('aircraft fallback', err);
  }
  await waitForFonts();

  const canvas = $('#stage');
  const coarse = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !coarse, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060c1d);
  scene.fog = new THREE.Fog(0x0a1430, 500, 2600);
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.5, 6000);

  scene.add(new THREE.HemisphereLight(0x8fb4ff, 0x0a0f1e, 1.1));
  const sun = new THREE.DirectionalLight(0xcfe0ff, 1.3);
  sun.position.set(-300, 500, 200);
  scene.add(sun);
  const warm = new THREE.PointLight(0xffb547, 6e4, 500, 2);
  warm.position.set(0, 60, 40);
  scene.add(warm);

  const world = buildWorld(LOS, aircraft);
  scene.add(world.group);
  const board = world.hall.board;
  board.draw(0);

  // Walk mode: a ground-level first-person camera on the apron.
  const hint = $('#hint');
  const hintText = hint.textContent;
  const walkBtn = $('#tWalk');
  // Page panels (booking, departures) open as windows over the walk when the visitor uses a desk or the board.
  const panels = { booking: $('#booking'), board: $('#board') };
  let openPanel = null;
  function showPanel(id) {
    if (!panels[id] || openPanel) return;
    openPanel = id;
    panels[id].classList.add('open');
    document.body.classList.add('panel-open');
    walk.pause(true);
    panels[id].querySelector('input, select, button')?.focus({ preventScroll: true });
  }
  function closePanel() {
    if (!openPanel) return;
    panels[openPanel].classList.remove('open');
    document.body.classList.remove('panel-open');
    openPanel = null;
    walk.pause(false);
  }
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closePanel));

  // Short messages over the walk (ticket, security and boarding feedback).
  const toastEl = $('#walkToast');
  let toastTimer = 0;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toastEl.hidden = true), 2800);
  }

  // The boarding pass card, shown once the visitor boards.
  const endEl = $('#boardingEnd');
  function showBoarding(t) {
    $('#passRoute').textContent = `${t.from}  →  ${t.to}`;
    $('#passMeta').textContent = [`Gate ${t.gate}`, t.cabin, t.pax, `Ref ${t.code}`].join(' · ');
    endEl.hidden = false;
    document.body.classList.add('card-open');
    walk.pause(true);
  }
  function closeBoarding() {
    if (endEl.hidden) return;
    endEl.hidden = true;
    document.body.classList.remove('card-open');
    walk.pause(false);
  }
  endEl.querySelector('[data-close-end]').addEventListener('click', closeBoarding);

  // Actions behind the security station and the boarding point at the parked plane.
  const game = {
    label(id) {
      const t = loadTicket();
      if (id === 'security') return t?.securityPassed ? 'Security cleared' : 'Security check';
      if (id === 'boarding') return t?.boarded ? 'Boarded' : 'Board flight';
      return null;
    },
    run(id) {
      const t = loadTicket();
      if (id === 'security') {
        if (!t) return toast('Buy a ticket at the desk first.');
        if (t.securityPassed) return toast('Security is cleared. Head out through the west doors to your gate.');
        t.securityPassed = true;
        saveTicket(t);
        return toast('Security cleared. Head out through the west doors to your gate.');
      }
      if (id === 'boarding') {
        if (!t) return toast('No ticket yet. Buy one at the desk.');
        if (!t.securityPassed) return toast('Clear security first.');
        if (t.boarded) return toast('You are already on board.');
        t.boarded = true;
        saveTicket(t);
        return showBoarding(t);
      }
    },
  };

  const walk = createWalker({
    canvas,
    spec: LOS,
    root: $('#walkUI'),
    prompt: $('#walkPrompt'),
    game,
    onOpen: showPanel,
    onExit: () => {
      if (openPanel) closePanel();
      else if (walk.seated) walk.stand();
      else setWalking(false);
    },
  });
  function setWalking(on) {
    if (on === walk.active) return;
    closePanel();
    closeBoarding();
    if (on) walk.enable();
    else walk.disable();
    document.body.classList.toggle('walking', on);
    walkBtn.setAttribute('aria-pressed', String(on));
    walkBtn.textContent = on ? 'Fly' : 'Walk';
    hint.textContent = on ? 'WASD to walk · Shift to run · E to use · Drag to look · Esc to exit' : hintText;
    hint.style.opacity = on ? 1 : scrollY > 80 ? 0 : 1;
  }
  walkBtn.addEventListener('click', () => setWalking(!walk.active));

  // Scroll choreography: each page section is a camera stop.
  const el = (id) => document.getElementById(id);
  const stops = () => {
    const vh = innerHeight;
    const s = LOS.shots;
    return [
      { y: 0, ...s.aerial },
      { y: el('booking').offsetTop - vh * 0.2, ...s.entrance },
      { y: el('board').offsetTop - vh * 0.3, ...s.inside },
      { y: el('board').offsetTop + el('board').offsetHeight * 0.35, ...s.board },
      { y: el('arrive').offsetTop - vh * 0.4, ...s.pull },
    ];
  };
  let path = stops();
  const scroll = { y: scrollY };
  const look = { yaw: 0, pitch: 0, tyaw: 0, tpitch: 0, drag: false, sx: 0, sy: 0, last: 0 };

  function sample(y) {
    if (y <= path[0].y) return path[0];
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i];
      const b = path[i + 1];
      if (y <= b.y) {
        const t = smooth(clamp((y - a.y) / Math.max(1, b.y - a.y), 0, 1));
        return {
          pos: a.pos.map((v, k) => v + (b.pos[k] - v) * t),
          tgt: a.tgt.map((v, k) => v + (b.tgt[k] - v) * t),
          fov: a.fov + (b.fov - a.fov) * t,
        };
      }
    }
    return path[path.length - 1];
  }

  addEventListener(
    'scroll',
    () => {
      gsap.to(scroll, { y: scrollY, duration: reduceMotion ? 0 : 0.9, ease: 'power2.out', overwrite: 'auto' });
    },
    { passive: true },
  );

  // Drag to look around.
  canvas.addEventListener('pointerdown', (e) => {
    if (walk.active) return;
    look.drag = true;
    look.sx = e.clientX;
    look.sy = e.clientY;
    look.last = performance.now();
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (walk.active || !look.drag) return;
    look.tyaw = clamp(look.tyaw - (e.clientX - look.sx) * 0.0042, -1.1, 1.1);
    look.tpitch = clamp(look.tpitch - (e.clientY - look.sy) * 0.003, -0.5, 0.5);
    look.sx = e.clientX;
    look.sy = e.clientY;
    look.last = performance.now();
  });
  canvas.addEventListener('pointerup', () => (look.drag = false));
  canvas.addEventListener('pointercancel', () => (look.drag = false));

  const resize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    path = stops();
  };
  let resizeTimer;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });

  const clock = new THREE.Clock();
  const pos = new THREE.Vector3();
  const tgt = new THREE.Vector3();
  let lastBoard = 0;

  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const secs = now / 1000;
    const dt = Math.min(0.05, clock.getDelta());
    world.update(secs);
    if (now - lastBoard > 160) {
      lastBoard = now;
      board.draw(now);
    }

    // Ease the look offset back to centre when idle.
    if (!look.drag && now - look.last > 2000) {
      look.tyaw *= 1 - Math.min(1, dt * 0.8);
      look.tpitch *= 1 - Math.min(1, dt * 0.8);
    }
    look.yaw += (look.tyaw - look.yaw) * Math.min(1, dt * 6);
    look.pitch += (look.tpitch - look.pitch) * Math.min(1, dt * 6);

    if (walk.active) {
      walk.update(dt, camera);
    } else {
      const shot = sample(scroll.y);
      const bob = reduceMotion ? 0 : Math.sin(secs * 0.4) * 0.25;
      pos.fromArray(shot.pos);
      tgt.fromArray(shot.tgt);
      const dir = tgt.clone().sub(pos);
      const dist = dir.length();
      dir.normalize();
      const yaw = Math.atan2(dir.x, dir.z) + look.yaw;
      const pitch = Math.asin(clamp(dir.y, -1, 1)) + look.pitch;
      const view = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
      camera.position.copy(pos);
      camera.position.y += bob;
      camera.lookAt(camera.position.clone().add(view.multiplyScalar(dist)));
      camera.fov = shot.fov;
      camera.updateProjectionMatrix();
    }
    // Hide the outside terminal labels while the camera is inside the hero hall.
    const hall = LOS.terminals.find((t) => t.hero);
    const inside =
      Math.abs(camera.position.x - hall.x) < hall.w / 2 &&
      Math.abs(camera.position.z - hall.z) < hall.d / 2 &&
      camera.position.y < hall.h;
    for (const label of world.labels) label.visible = !inside;
    renderer.render(scene, camera);
  });
  resize();

  return { renderer, scene, camera };
}
