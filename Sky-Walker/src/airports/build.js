import * as THREE from 'three';
import { UNIT_M } from './los.js';
import { buildHall } from './hall.js';

// Turns an airport spec (see los.js) into a Three.js group.
// To add another airport, write a new spec and pass it here.

const asphalt = new THREE.MeshStandardMaterial({ color: 0x2d3858, roughness: 0.85 });
const apronMat = new THREE.MeshStandardMaterial({ color: 0x233153, roughness: 0.55, metalness: 0.1 });
const paint = new THREE.MeshBasicMaterial({ color: 0xfff3d1 });

function labelTexture(lines, { w = 1024, h = 256 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#eef3ff';
  g.font = '700 84px Sora, sans-serif';
  g.fillText(lines[0], w / 2, h * 0.38);
  if (lines[1]) {
    g.fillStyle = '#ffb547';
    g.font = '600 52px "JetBrains Mono", monospace';
    g.fillText(lines[1], w / 2, h * 0.76);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function labelSprite(lines, scale = 120) {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: labelTexture(lines), transparent: true, fog: false, depthWrite: false }),
  );
  sprite.renderOrder = 10;
  sprite.userData.isLabel = true;
  sprite.scale.set(scale, scale / 4, 1);
  return sprite;
}

function runwayNumber(text, color = '#eef3ff') {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = color;
  g.font = '700 150px Sora, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 132);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false }),
  );
}

function buildRunway(rw) {
  const g = new THREE.Group();
  const len = rw.lengthM / UNIT_M;
  const width = 38;

  const strip = new THREE.Mesh(new THREE.PlaneGeometry(width, len), asphalt);
  strip.rotation.x = -Math.PI / 2;
  strip.position.y = 0.05;
  g.add(strip);

  // Centreline dashes.
  const dashLen = 14;
  const dashCount = Math.floor(len / 30);
  const dashes = new THREE.InstancedMesh(new THREE.BoxGeometry(1.8, 0.1, dashLen), paint, dashCount);
  const m = new THREE.Object3D();
  for (let i = 0; i < dashCount; i++) {
    m.position.set(0, 0.12, -len / 2 + 15 + i * 30);
    m.updateMatrix();
    dashes.setMatrixAt(i, m.matrix);
  }
  g.add(dashes);

  // Edge lights, both sides.
  const lightCount = Math.floor(len / 24) * 2;
  const lights = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 0.6, 2.4), paint, lightCount);
  let k = 0;
  for (const side of [-1, 1]) {
    for (let i = 0; i < lightCount / 2; i++) {
      m.position.set(side * (width / 2 + 1), 0.3, -len / 2 + i * 24);
      m.updateMatrix();
      lights.setMatrixAt(k++, m.matrix);
    }
  }
  g.add(lights);

  // Threshold bars and designators at each end. North end is -z.
  const [northId, southId] = rw.id;
  for (const [end, id] of [[-1, northId], [1, southId]]) {
    const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(2, 0.1, 12), paint, 8);
    for (let i = 0; i < 8; i++) {
      m.position.set(-width / 2 + 5 + i * ((width - 10) / 7), 0.12, end * (len / 2 - 10));
      m.updateMatrix();
      bars.setMatrixAt(i, m.matrix);
    }
    g.add(bars);

    const num = runwayNumber(id);
    // Text top points along the direction of travel after touchdown.
    num.rotation.set(-Math.PI / 2, 0, end === -1 ? Math.PI : 0);
    num.position.set(0, 0.14, end * (len / 2 - 44));
    g.add(num);
  }

  g.position.set(rw.x, 0, rw.z);
  return g;
}

function ribbon(points, width) {
  const g = new THREE.Group();
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, z1] = points[i];
    const [x2, z2] = points[i + 1];
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    const seg = new THREE.Mesh(new THREE.BoxGeometry(width, 0.1, len + width * 0.4), asphalt);
    seg.position.set((x1 + x2) / 2, 0.06, (z1 + z2) / 2);
    seg.rotation.y = Math.atan2(dx, dz);
    g.add(seg);
  }
  return g;
}

function buildTower(t) {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(3.6, 5.4, t.height, 14),
    new THREE.MeshStandardMaterial({ color: 0xc7d2e6, roughness: 0.6 }),
  );
  shaft.position.y = t.height / 2;
  g.add(shaft);
  const cab = new THREE.Mesh(
    new THREE.CylinderGeometry(9, 6.5, 10, 14),
    new THREE.MeshStandardMaterial({ color: 0x7fb0ff, emissive: 0xffb547, emissiveIntensity: 0.55, roughness: 0.2 }),
  );
  cab.position.y = t.height + 5;
  g.add(cab);
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(10, 10, 1.6, 14),
    new THREE.MeshStandardMaterial({ color: 0x0d1830 }),
  );
  cap.position.y = t.height + 10.8;
  g.add(cap);
  g.position.set(t.x, 0, t.z);
  return g;
}

function buildBlockTerminal(t) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(t.w, t.h, t.d),
    new THREE.MeshStandardMaterial({ color: t.color ?? 0xb7c3dc, roughness: 0.55, metalness: 0.25 }),
  );
  body.position.y = t.h / 2;
  g.add(body);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(t.w + 6, 3, t.d + 6),
    new THREE.MeshStandardMaterial({ color: 0x0d1830, roughness: 0.6, metalness: 0.4 }),
  );
  roof.position.y = t.h + 1.5;
  g.add(roof);

  // Glazing band so the block reads as a terminal, not a warehouse.
  const band = new THREE.Mesh(
    new THREE.BoxGeometry(t.w + 0.4, t.h * 0.4, t.d + 0.4),
    new THREE.MeshStandardMaterial({ color: 0x7fb0ff, emissive: 0x2a4a8a, emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.4 }),
  );
  band.position.y = t.h * 0.42;
  g.add(band);

  const label = labelSprite([t.name.toUpperCase(), t.note], 150);
  label.position.set(0, t.h + 40, 0);
  g.add(label);

  g.position.set(t.x, 0, t.z);
  return g;
}

export function buildAirport(spec, { makePlane, brand } = {}) {
  const group = new THREE.Group();

  for (const rw of spec.runways) group.add(buildRunway(rw));
  for (const tw of spec.taxiways) group.add(ribbon(tw.points, tw.width));

  let hall = null;
  for (const t of spec.terminals) {
    // Apron slab on the airside (west) face of each terminal, out to the parallel taxiway.
    const west = t.x - t.w / 2;
    const apronW = west - -300;
    const slab = new THREE.Mesh(new THREE.PlaneGeometry(Math.abs(apronW) + 10, t.d + 50), apronMat);
    slab.rotation.x = -Math.PI / 2;
    slab.position.set((west + -300) / 2, 0.07, t.z);
    group.add(slab);

    if (t.hero) {
      hall = buildHall(t, { brand, departures: spec.departures });
      hall.group.position.set(t.x, 0, t.z);
      group.add(hall.group);
    } else {
      group.add(buildBlockTerminal(t));
    }
  }

  group.add(buildTower(spec.tower));

  // Cargo sheds beyond the north terminals.
  const shedMat = new THREE.MeshStandardMaterial({ color: 0x2b3a5c, roughness: 0.7, metalness: 0.3 });
  for (const [x, z, w, d] of [[260, -520, 120, 60], [260, -610, 120, 60], [270, -720, 130, 70]]) {
    const shed = new THREE.Mesh(new THREE.BoxGeometry(w, 20, d), shedMat);
    shed.position.set(x, 10, z);
    group.add(shed);
  }

  // Parked aircraft on the hero apron, nose toward the terminal.
  const parked = [];
  if (makePlane) {
    for (const [x, z] of spec.stands) {
      const plane = makePlane(0.55);
      plane.position.set(x, 0, z);
      plane.rotation.y = Math.PI / 2;
      group.add(plane);
      parked.push(plane);
    }
  }

  const labels = [];
  group.traverse((o) => {
    if (o.userData.isLabel) labels.push(o);
  });

  return { group, hall, parked, labels };
}
