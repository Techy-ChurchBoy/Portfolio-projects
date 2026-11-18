import * as THREE from 'three';

// Waiting halls: the terminals other than the hero hall. Each is a glass shell with a doorway
// on its airside (west) wall, rows of benches and a short sign. waitingLayout is shared by the
// renderer here and the walk colliders and sit spots in src/walk.js, so what you see is what you touch.

import { ticketStatus } from '../ticket.js';

export const WAIT_DOOR = 6; // half width of the doorway, in world units

// A board on the north wall, facing the benches, showing the visitor's ticket and status.
export function makeGateBoard() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const g = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 30),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
  );

  function draw(t) {
    const st = ticketStatus(t);
    g.fillStyle = '#03091a';
    g.fillRect(0, 0, 1024, 512);
    g.fillStyle = '#ffb547';
    g.font = '700 40px Sora, sans-serif';
    g.fillText('YOUR FLIGHT', 40, 60);
    if (t) {
      g.fillStyle = '#eef3ff';
      g.font = '700 64px Sora, sans-serif';
      g.fillText(`${t.from}  →  ${t.to}`, 40, 170);
      g.fillStyle = '#7f93bd';
      g.font = '600 28px "JetBrains Mono", monospace';
      g.fillText(`GATE ${t.gate}     REF ${t.code}`, 40, 230);
    }
    g.fillStyle = st.tone;
    g.font = '700 56px Sora, sans-serif';
    g.fillText(st.text, 40, 340);
    g.fillStyle = '#a3b4d6';
    g.font = '600 28px "JetBrains Mono", monospace';
    g.fillText(st.sub, 40, 410);
    tex.needsUpdate = true;
  }
  return { mesh, draw };
}

// Benches in a 3 × 4 grid across the hall, centred on the terminal.
export function waitingLayout(t) {
  const benches = [];
  for (const fz of [-0.25, 0, 0.25]) {
    for (const fx of [-0.3, -0.1, 0.1, 0.3]) {
      benches.push({ x: t.x + fx * t.w, z: t.z + fz * t.d });
    }
  }
  return { benches };
}

// Local to the terminal's centre: the caller places the group at (t.x, 0, t.z).
export function buildWaitingHall(t) {
  const { w: W, d: D, h: H } = t;
  const g = new THREE.Group();

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(W, H, D)),
    new THREE.LineBasicMaterial({ color: t.color ?? 0xffb547, transparent: true, opacity: 0.85 }),
  );
  edges.position.y = H / 2;
  g.add(edges);

  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(W, H, D),
    new THREE.MeshStandardMaterial({
      color: 0x7fb0ff,
      transparent: true,
      opacity: 0.16,
      roughness: 0.05,
      metalness: 0.1,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  glass.position.y = H / 2;
  g.add(glass);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(W + 6, 3, D + 6),
    new THREE.MeshStandardMaterial({ color: 0x0d1830, roughness: 0.6, metalness: 0.4 }),
  );
  roof.position.y = H + 1.5;
  g.add(roof);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W, D),
    new THREE.MeshStandardMaterial({ color: 0x18233f, roughness: 0.5, metalness: 0.2 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.1;
  g.add(floor);

  // Door posts either side of the airside doorway.
  const postMat = new THREE.MeshStandardMaterial({ color: 0xffb547, emissive: 0x6a4312, emissiveIntensity: 0.8 });
  for (const sign of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(1.2, H * 0.6, 1.2), postMat);
    post.position.set(-W / 2, (H * 0.6) / 2, sign * (WAIT_DOOR + 1));
    g.add(post);
  }

  const gateBoard = makeGateBoard();
  gateBoard.mesh.position.set(0, 20, -D / 2 + 3);
  g.add(gateBoard.mesh);
  g.userData.gateBoard = gateBoard;

  // Benches: a seat and a backrest, long side along x.
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x2b3a5c, roughness: 0.6, metalness: 0.2 });
  for (const b of waitingLayout(t).benches) {
    const x = b.x - t.x;
    const z = b.z - t.z;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(12, 1.2, 3), benchMat);
    seat.position.set(x, 1, z);
    g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(12, 2.2, 0.6), benchMat);
    back.position.set(x, 2.3, z - 1.2);
    g.add(back);
  }
  return g;
}
