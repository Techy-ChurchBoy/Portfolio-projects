import * as THREE from 'three';
import { buildAirport } from './airports/build.js';

// Deterministic random so the skyline is the same every load.
function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 1831565813) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function windowTexture(cols, rows, hue) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#0b1530';
  g.fillRect(0, 0, 128, 256);
  const r = rng(cols * 97 + rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = r() < 0.42;
      g.fillStyle = lit ? `hsl(${hue},90%,${62 + r() * 18}%)` : '#16244a';
      g.fillRect(6 + x * (116 / cols), 6 + y * (244 / rows), (116 / cols) * 0.6, (244 / rows) * 0.55);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function buildWorld(spec, aircraftModel) {
  const scene = new THREE.Group();
  const rand = rng(7);
  const { bounds } = spec;
  const inAirfield = (x, z) => x > bounds.minX && x < bounds.maxX && z > bounds.minZ && z < bounds.maxZ;

  // Ground.
  const ground = new THREE.Mesh(new THREE.CircleGeometry(4000, 64), new THREE.MeshStandardMaterial({ color: 0x111b33, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Distant city, kept clear of the airfield.
  const textures = [windowTexture(6, 14, 205), windowTexture(5, 22, 35), windowTexture(8, 10, 190)];
  const dummy = new THREE.Object3D();
  for (const tex of textures) {
    const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.9, roughness: 0.6, metalness: 0.3 });
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, 60);
    let n = 0;
    for (let i = 0; i < 60; i++) {
      const a = rand() * Math.PI * 2;
      const r = 520 + rand() * 1300;
      const w = 30 + rand() * 50;
      const h = 60 + rand() * 260 * (1 - r / 1800);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r - 200;
      const depthMul = 0.7 + rand() * 0.6;
      const rot = rand() * 0.2;
      if (inAirfield(x, z)) continue;
      dummy.position.set(x, h / 2, z);
      dummy.scale.set(w, h, w * depthMul);
      dummy.rotation.y = rot;
      dummy.updateMatrix();
      mesh.setMatrixAt(n++, dummy.matrix);
    }
    mesh.count = n;
    scene.add(mesh);
  }

  // Aircraft factory: the real model when it loaded, a simple airframe otherwise.
  function makePlane(scale = 1) {
    const holder = new THREE.Group();
    if (aircraftModel) {
      const model = aircraftModel.clone(true);
      // The GLB's nose points down -Z (nose gear at z≈-14); turn it so the nose is +Z,
      // the convention used for headings and lamps below.
      model.rotation.y = Math.PI;
      model.traverse((o) => {
        if (o.isMesh) o.frustumCulled = false;
      });
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const centre = box.getCenter(new THREE.Vector3());
      const k = (74 / Math.max(size.x, size.y, size.z)) * scale;
      model.scale.setScalar(k);
      model.position.sub(centre.multiplyScalar(k));
      model.position.y += (size.y * k) / 2;
      holder.add(model);
    } else {
      const mat = new THREE.MeshStandardMaterial({ color: 0xe9eef8, roughness: 0.45, metalness: 0.2 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 26, 14), mat);
      body.rotation.x = Math.PI / 2;
      body.position.y = 3;
      const wing = new THREE.Mesh(new THREE.BoxGeometry(28, 0.25, 5), mat);
      wing.position.set(0, 2.8, 1);
      holder.add(body, wing);
      holder.scale.setScalar(1.6 * scale);
    }
    return holder;
  }

  // Airport.
  const airport = buildAirport(spec, { makePlane, brand: 'skywalker' });
  scene.add(airport.group);

  // Orbiting aircraft with blinking nav lights, looping around the airfield.
  const cx = -260;
  const cz = -420;
  const curves = [
    { rx: 560, rz: 430, y: 118 },
    { rx: 720, rz: 560, y: 146 },
    { rx: 880, rz: 690, y: 174 },
  ].map(({ rx, rz, y }) => {
    const pts = [];
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      pts.push(new THREE.Vector3(cx + Math.cos(a) * rx, y + Math.sin(a * 2) * 6, cz + Math.sin(a) * rz));
    }
    return new THREE.CatmullRomCurve3(pts, true);
  });

  const blinkers = [];
  const flyers = [];
  const lamp = (color) => new THREE.Mesh(new THREE.SphereGeometry(aircraftModel ? 1.2 : 0.45, 8, 6), new THREE.MeshBasicMaterial({ color }));
  for (const [ci, dir, t0] of [[0, 1, 0], [0, -1, 0.5], [1, 1, 0.25], [1, -1, 0.75], [2, 1, 0.1], [2, -1, 0.6]]) {
    const holder = new THREE.Group();
    holder.add(makePlane(1));
    const lamps = aircraftModel
      ? [[34, 0, 0, 0xff3b3b], [-34, 0, 0, 0x3bff7a], [0, 6, -34, 0xffffff]]
      : [[14, 0, 1, 0xff3b3b], [-14, 0, 1, 0x3bff7a], [0, 1.8, -12, 0xffffff]];
    lamps.forEach(([x, y, z, color], i) => {
      const l = lamp(color);
      l.position.set(x, y, z);
      holder.add(l);
      blinkers.push({ mesh: l, phase: i * 1.3 });
    });
    scene.add(holder);
    flyers.push({ holder, curve: curves[ci], t: t0, speed: 0.012 + ci * 0.002, dir });
  }

  // Soft clouds.
  const cc = document.createElement('canvas');
  cc.width = cc.height = 128;
  const cg = cc.getContext('2d');
  for (let i = 0; i < 9; i++) {
    const x = 30 + rand() * 68;
    const y = 44 + rand() * 40;
    const r = 22 + rand() * 26;
    const grad = cg.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(200,220,255,.5)');
    grad.addColorStop(1, 'rgba(200,220,255,0)');
    cg.fillStyle = grad;
    cg.fillRect(0, 0, 128, 128);
  }
  const cloudTex = new THREE.CanvasTexture(cc);
  cloudTex.colorSpace = THREE.SRGBColorSpace;
  const clouds = [];
  for (let i = 0; i < 90; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.35 + rand() * 0.3, depthWrite: false, fog: true }));
    const size = 160 + rand() * 260;
    s.scale.set(size, size * 0.55, 1);
    s.position.set((rand() - 0.5) * 3000, 180 + rand() * 220, (rand() - 0.5) * 3000);
    scene.add(s);
    clouds.push(s);
  }

  function update(seconds) {
    for (const b of blinkers) b.mesh.visible = Math.sin(seconds * 3 + b.phase) > -0.2;
    for (const f of flyers) {
      f.t = (f.t + f.dir * f.speed * 0.016 + 1) % 1;
      const p = f.curve.getPointAt(f.t);
      const tan = f.curve.getTangentAt(f.t).multiplyScalar(f.dir);
      f.holder.position.copy(p);
      f.holder.rotation.set(0, Math.atan2(tan.x, tan.z), 0);
    }
    clouds.forEach((c, i) => {
      c.position.x += Math.sin(i) * 0.01;
    });
  }

  return { group: scene, update, hall: airport.hall, labels: airport.labels, gateBoards: airport.gateBoards };
}
