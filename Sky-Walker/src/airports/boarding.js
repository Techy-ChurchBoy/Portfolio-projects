import * as THREE from 'three';

// Boarding stairs and a simple cabin for a parked aircraft. The aircraft's nose points east (+x, see build.js).
// Positions are estimated from the stand, not measured from the model, so the stairs may need nudging
// against the real aircraft door.

export const DECK_H = 4; // cabin floor height, world units
const FUSE_R = 3; // cabin radius
const CABIN_HALF = 20; // cabin half length, nose to tail
const DOOR_DX = 12; // door sits this far forward of the stand centre

// Where the walk goes from the boarding point to the seat at the back of the cabin.
export function boardingRoute(stand) {
  const [sx, sz] = stand;
  const dx = sx + DOOR_DX;
  return [
    { x: sx + 30, y: 0, z: sz + 14 }, // round the wing's edge, clear of the aircraft
    { x: dx, y: 0, z: sz + 14 },
    { x: dx, y: 0, z: sz + 11 }, // foot of the stairs
    { x: dx, y: DECK_H, z: sz + 4 }, // top of the stairs, at the door
    { x: dx, y: DECK_H, z: sz }, // inside the cabin
    { x: sx - 14, y: DECK_H, z: sz }, // along the aisle
  ];
}

export function buildBoarding(stand) {
  const [sx, sz] = stand;
  const dx = sx + DOOR_DX;
  const group = new THREE.Group();

  // Stairs: a ramp from the ground up to the door, then a small platform.
  const from = new THREE.Vector3(dx, 0, sz + 11);
  const to = new THREE.Vector3(dx, DECK_H, sz + 4);
  const len = from.distanceTo(to);
  const ramp = new THREE.Mesh(
    new THREE.BoxGeometry(3, 0.5, len),
    new THREE.MeshStandardMaterial({ color: 0x9fb8e8, roughness: 0.6, metalness: 0.3 }),
  );
  ramp.position.copy(from).add(to).multiplyScalar(0.5);
  ramp.lookAt(to);
  group.add(ramp);
  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(5, 0.5, 4),
    new THREE.MeshStandardMaterial({ color: 0x9fb8e8, roughness: 0.6, metalness: 0.3 }),
  );
  platform.position.set(dx, DECK_H - 0.25, sz + 5.5);
  group.add(platform);

  // Cabin, shown in place of the aircraft while the visitor boards.
  const cabin = new THREE.Group();
  cabin.visible = false;
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(FUSE_R, FUSE_R, CABIN_HALF * 2, 18, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xdfe7f5, roughness: 0.5, metalness: 0.2, side: THREE.DoubleSide }),
  );
  shell.rotation.z = Math.PI / 2;
  shell.position.set(sx, DECK_H + FUSE_R, sz);
  cabin.add(shell);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(CABIN_HALF * 2, FUSE_R * 2),
    new THREE.MeshStandardMaterial({ color: 0x27334f, roughness: 0.8 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(sx, DECK_H + 0.05, sz);
  cabin.add(floor);
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x3a4f7a, roughness: 0.7 });
  for (let x = sx - CABIN_HALF + 3; x < sx + CABIN_HALF - 2; x += 2.4) {
    for (const side of [-1, 1]) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, 1.4), seatMat);
      seat.position.set(x, DECK_H + 0.6, sz + side * 1.9);
      cabin.add(seat);
    }
  }
  group.add(cabin);

  return { group, cabin };
}
