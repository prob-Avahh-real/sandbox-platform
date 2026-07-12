// Test 5: Three.js scene creation + ECS sync (headless)

import * as THREE from 'three';
import { World } from '../ecs/World';
import { Signature, getComponentId, registerComponent } from '../ecs/Component';
import { SceneManager } from '../scene/SceneManager';
import {
  createTransform,
  createMeshRenderer,
  createCamera,
  createLight,
} from '../components';

let passed = 0, failed = 0;
const assert = (c: boolean, m: string) => { c ? (passed++, console.log('  ✓ ' + m)) : (failed++, console.error('  ✗ ' + m)); };

// Register components
registerComponent('Transform');
registerComponent('MeshRenderer');
registerComponent('Camera');
registerComponent('Light');

const world = new World();
const sm = new SceneManager(world);

assert(sm.scene instanceof THREE.Scene, 'Scene created');
assert(sm.scene.background instanceof THREE.Color, 'Scene has background color');

// Create mesh entity
const eid = world.createEntity('Box');
const e = world.getEntity(eid)!;
e.addComponent(createTransform([0, 2, 0]));
e.addComponent(createMeshRenderer('box', '#e74c3c', [2, 1, 3]));

// Sync — should create Three.js mesh
sm.syncEntities();
const obj = sm.getObject3D(eid);
assert(obj instanceof THREE.Mesh, 'ECS entity → THREE.Mesh');
assert(obj!.position.x === 0 && obj!.position.y === 2 && obj!.position.z === 0, 'Transform synced');

const mat = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial;
assert(mat.color.getHexString() === 'e74c3c', 'Color synced');

// Create camera entity
const cid = world.createEntity('Cam');
const ce = world.getEntity(cid)!;
ce.addComponent(createTransform([0, 5, -10]));
ce.addComponent(createCamera(60, true));

sm.syncEntities();
const cam = sm.getMainCamera();
assert(cam instanceof THREE.PerspectiveCamera, 'Camera entity → THREE.PerspectiveCamera');
assert(cam!.fov === 60, 'Camera FOV synced');
assert(cam!.position.z === -10, 'Camera position synced');

// Create light entity
const lid = world.createEntity('Sun');
const le = world.getEntity(lid)!;
le.addComponent(createTransform([10, 20, 0]));
le.addComponent(createLight('directional', '#ffffff', 1.5));

sm.syncEntities();
const lightObj = sm.getObject3D(lid);
assert(lightObj instanceof THREE.DirectionalLight, 'Light entity → THREE.DirectionalLight');
assert((lightObj as THREE.DirectionalLight).intensity === 1.5, 'Light intensity synced');

// Destroy entity
world.destroyEntity(eid);
world.update(0.016);
sm.syncEntities();
assert(sm.getObject3D(eid) === undefined, 'Destroyed entity removed from scene');

console.log(`\n  Three.js: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
