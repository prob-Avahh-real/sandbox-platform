// Test 2: Rapier WASM physics init + rigid body creation

import RAPIER from '@dimforge/rapier3d-compat';

let passed = 0, failed = 0;
const assert = (c: boolean, m: string) => { c ? (passed++, console.log('  ✓ ' + m)) : (failed++, console.error('  ✗ ' + m)); };

async function test() {
  await RAPIER.init();
  assert(true, 'RAPIER.init() completes');

  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  assert(!!world, 'RAPIER.World created');

  // Create ground (static cuboid)
  const groundBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const groundCollider = world.createCollider(
    RAPIER.ColliderDesc.cuboid(10, 0.1, 10),
    groundBody
  );
  assert(groundBody.isFixed(), 'ground is static');

  // Create dynamic sphere
  const sphereDesc = RAPIER.RigidBodyDesc.dynamic();
  sphereDesc.setTranslation(0, 5, 0);
  const sphereBody = world.createRigidBody(sphereDesc);
  const sphereCollider = world.createCollider(
    RAPIER.ColliderDesc.ball(0.5).setFriction(0.5).setRestitution(0.3),
    sphereBody
  );
  assert(!sphereBody.isFixed(), 'sphere is dynamic');

  // Step simulation
  world.step();
  assert(true, 'world.step() runs');

  // Ball should fall
  const pos = sphereBody.translation();
  assert(pos.y < 5, `ball fell (y=${pos.y.toFixed(2)})`);

  // Step many times - ball should reach ground
  for (let i = 0; i < 100; i++) world.step();
  const pos2 = sphereBody.translation();
  assert(pos2.y < 1.0, `ball near ground (y=${pos2.y.toFixed(2)})`);

  // Raycast
  const ray = new RAPIER.Ray({ x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 });
  const hit = world.castRay(ray, 10, true);
  assert(hit !== null, 'raycast hits ground');

  world.free();
  console.log(`\n  Rapier: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

test().catch(e => { console.error('RAPIER FAIL:', e.message); process.exit(1); });
