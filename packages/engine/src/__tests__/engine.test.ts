// Test 4: Engine module import chain + Game instantiation (headless)

import * as THREE from 'three';
import { World } from '../ecs/World';
import { Signature, getComponentId, registerComponent } from '../ecs/Component';
import {
  World as W,
  Signature as Sig,
  getComponentId,
  registerComponent,
  createTransform,
  createMeshRenderer,
  createRigidBody,
  createPlayer,
  SceneManager,
  PhysicsSystem,
  InputManager,
  createLuaAPI,
  Game,
  CameraFollowSystem,
  PlayerMovementSystem,
} from '../index';

let passed = 0, failed = 0;
const assert = (c: boolean, m: string) => { c ? (passed++, console.log('  ✓ ' + m)) : (failed++, console.error('  ✗ ' + m)); };

// Test all exports resolve
assert(typeof W === 'function', 'World class exports');
assert(typeof Sig === 'function', 'Signature class exports');
assert(typeof getComponentId === 'function', 'getComponentId exports');
assert(typeof registerComponent === 'function', 'registerComponent exports');
assert(typeof createTransform === 'function', 'createTransform exports');
assert(typeof createMeshRenderer === 'function', 'createMeshRenderer exports');
assert(typeof createRigidBody === 'function', 'createRigidBody exports');
assert(typeof createPlayer === 'function', 'createPlayer exports');
assert(typeof SceneManager === 'function', 'SceneManager exports');
assert(typeof PhysicsSystem === 'function', 'PhysicsSystem exports');
assert(typeof InputManager === 'function', 'InputManager exports');
assert(typeof createLuaAPI === 'function', 'createLuaAPI exports');
assert(typeof Game === 'function', 'Game exports');
assert(typeof CameraFollowSystem === 'function', 'CameraFollowSystem exports');
assert(typeof PlayerMovementSystem === 'function', 'PlayerMovementSystem exports');

// ECS logic
const world = new W();
const eid = world.createEntity('Test');
const e = world.getEntity(eid)!;
e.addComponent(createTransform([1, 2, 3]));
e.addComponent(createMeshRenderer('sphere', '#ff0000', [2, 2, 2]));
e.addComponent(createRigidBody('dynamic', 5, 'ball', [1, 1, 1]));
assert(e.hasComponent('Transform'), 'entity has Transform');
assert(e.hasComponent('MeshRenderer'), 'entity has MeshRenderer');
assert(e.hasComponent('RigidBody'), 'entity has RigidBody');

const rb = e.getComponent('RigidBody');
assert(rb?.mass === 5, 'RigidBody mass = 5');
assert(rb?.colliderShape === 'ball', 'RigidBody colliderShape = ball');

// SceneManager
const sm = new SceneManager(world);
assert(sm.scene instanceof THREE.Scene, 'SceneManager creates THREE.Scene');

// Lua API
const api = createLuaAPI(world);
const partId = api.createPart('LuaPart');
assert(partId > 0, 'LuaAPI.createPart returns entity ID');
const pos = api.getPosition(partId);
assert(pos?.[1] === 0, 'LuaAPI.getPosition default y=0');
api.setPosition(partId, 10, 20, 30);
const pos2 = api.getPosition(partId);
assert(pos2?.[0] === 10 && pos2?.[1] === 20 && pos2?.[2] === 30, 'LuaAPI.setPosition works');

console.log(`\n  Engine: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
