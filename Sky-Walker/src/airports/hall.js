import * as THREE from 'three';

// The hero terminal: a glass hall with columns, a rooftop sign and a live departures board.

function canvasTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSign(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 160;
  const g = canvas.getContext('2d');
  g.fillStyle = '#04091a';
  g.fillRect(0, 0, 1024, 160);
  g.font = '700 120px Sora, sans-serif';
  g.textBaseline = 'middle';
  const wordW = g.measureText(text).width;
  const dotW = g.measureText('.').width;
  const x0 = (1024 - wordW - dotW) / 2;
  g.textAlign = 'left';
  g.fillStyle = '#eef3ff';
  g.fillText(text, x0, 84);
  g.fillStyle = '#ffb547';
  g.fillText('.', x0 + wordW, 84);
  return canvasTexture(canvas);
}

function makeBoard(rows) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const g = canvas.getContext('2d');
  const tex = canvasTexture(canvas);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 35),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
  );

  function draw(ms) {
    g.fillStyle = '#03091a';
    g.fillRect(0, 0, 1024, 512);
    g.fillStyle = '#ffb547';
    g.font = '700 40px Sora, sans-serif';
    g.fillText('DEPARTURES', 40, 60);
    g.font = '600 26px "JetBrains Mono", monospace';
    g.fillStyle = '#7f93bd';
    g.fillText('TIME     FLIGHT   TO                STATUS', 40, 120);
    rows.forEach(([time, from, to, city, status], i) => {
      const y = 170 + i * 62;
      g.globalAlpha = 1;
      g.fillStyle = '#eef3ff';
      g.fillText(`${time}    ${from}-${to}   ${city.padEnd(16, ' ')}`, 40, y);
      g.fillStyle = status === 'DELAYED' ? '#ff7a7a' : '#6fe3a5';
      g.globalAlpha = Math.sin(ms / 400 + i) > 0 ? 1 : 0.6;
      g.fillText(status, 780, y);
      g.globalAlpha = 1;
    });
    tex.needsUpdate = true;
  }
  return { mesh, draw };
}

export function buildHall(spec, { brand = 'skywalker', departures = [] } = {}) {
  const { w: W, d: D, h: H } = spec;
  const group = new THREE.Group();

  // Wire outline plus a faint glass skin.
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(W, H, D)),
    new THREE.LineBasicMaterial({ color: 0xffb547, transparent: true, opacity: 0.9 }),
  );
  edges.position.set(0, H / 2, 0);
  group.add(edges);

  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(W, H, D),
    new THREE.MeshStandardMaterial({
      color: 0x7fb0ff,
      transparent: true,
      opacity: 0.14,
      roughness: 0.05,
      metalness: 0.1,
      side: THREE.DoubleSide,
      depthWrite: false,
      envMapIntensity: 1.2,
    }),
  );
  glass.position.set(0, H / 2, 0);
  group.add(glass);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(W + 6, 4, D + 6),
    new THREE.MeshStandardMaterial({ color: 0x0d1830, roughness: 0.6, metalness: 0.4 }),
  );
  roof.position.set(0, H + 2, 0);
  group.add(roof);

  // Rooftop sign on the landside facade.
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 18),
    new THREE.MeshBasicMaterial({ map: makeSign(brand), toneMapped: false, transparent: true }),
  );
  sign.position.set(0, H + 10, D / 2 + 1.5);
  group.add(sign);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W, D),
    new THREE.MeshStandardMaterial({ color: 0x18233f, roughness: 0.5, metalness: 0.2 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.1;
  group.add(floor);

  // Column grid along both long walls.
  const colMat = new THREE.MeshStandardMaterial({ color: 0x2b3a5c, roughness: 0.4, metalness: 0.6 });
  for (let x = -W / 2 + 20; x < W / 2; x += 40) {
    for (const z of [-D / 2 + 12, D / 2 - 12]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, H, 10), colMat);
      col.position.set(x, H / 2, z);
      group.add(col);
    }
  }

  // Warm light strip under the roof.
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(W - 20, 1.4), new THREE.MeshBasicMaterial({ color: 0xfff1d6 }));
  strip.rotation.x = Math.PI / 2;
  strip.position.y = H - 4;
  group.add(strip);

  const board = makeBoard(departures);
  board.mesh.position.set(0, 24, -D / 2 + 3);
  group.add(board.mesh);

  return { group, board, W, D, H };
}
