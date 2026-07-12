// Lua scripting bridge - API exposed to Lua scripts

import { World } from '../ecs/World';
import { Entity } from '../ecs/Entity';
import { EntityId } from '../ecs/Component';
import { PhysicsSystem, RaycastHit } from '../physics/PhysicsSystem';
import {
  createTransform,
  createMeshRenderer,
  createRigidBody,
  createPlayer,
  createLight,
  createCamera,
  TransformComponent,
  MeshRendererComponent,
  RigidBodyComponent,
  MeshType,
  RigidBodyType,
} from '../components';

// The API object exposed to Lua as global 'sandbox'
export interface LuaAPI {
  world: World;

  // Entity operations
  createPart(name: string): EntityId;
  createPlayer(userId: string, username: string): EntityId;
  createLight(color: string, intensity: number): EntityId;
  destroyEntity(id: EntityId): void;

  // Transform
  setPosition(id: EntityId, x: number, y: number, z: number): void;
  getPosition(id: EntityId): [number, number, number] | null;
  setRotation(id: EntityId, x: number, y: number, z: number): void;
  setScale(id: EntityId, x: number, y: number, z: number): void;

  // Mesh
  setMeshType(id: EntityId, meshType: string): void;
  setColor(id: EntityId, color: string): void;
  setSize(id: EntityId, w: number, h: number, d: number): void;

  // Physics
  setVelocity(id: EntityId, x: number, y: number, z: number): void;
  getVelocity(id: EntityId): [number, number, number] | null;
  applyForce(id: EntityId, x: number, y: number, z: number): void;
  applyImpulse(id: EntityId, x: number, y: number, z: number): void;
  setGravity(x: number, y: number, z: number): void;
  raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number): RaycastHit | null;
  raycastAll(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number): RaycastHit[];

  // Utility
  print(...args: any[]): void;
  wait(seconds: number): void;
  getTime(): number;
}

export function createLuaAPI(world: World, physics?: PhysicsSystem): LuaAPI {
  const api: LuaAPI = {
    world,

    createPart(name: string): EntityId {
      const id = world.createEntity(name);
      const entity = world.getEntity(id)!;
      entity.addComponent(createTransform());
      entity.addComponent(createMeshRenderer('box', '#3498db'));
      entity.addComponent(createRigidBody('dynamic', 1, 'cuboid', [0.5, 0.5, 0.5]));
      return id;
    },

    createPlayer(userId: string, username: string): EntityId {
      const id = world.createEntity(`Player_${username}`);
      const entity = world.getEntity(id)!;
      entity.addComponent(createTransform([0, 5, 0]));
      entity.addComponent(createMeshRenderer('capsule', '#e74c3c', [0.6, 1.8, 0.6]));
      entity.addComponent(createRigidBody('dynamic', 1, 'capsule', [0.3, 0.9, 0.3]));
      entity.addComponent(createPlayer(userId, username, true));
      return id;
    },

    createLight(color: string, intensity: number): EntityId {
      const id = world.createEntity('Light');
      const entity = world.getEntity(id)!;
      entity.addComponent(createTransform([0, 10, 0]));
      entity.addComponent(createLight('point', color, intensity));
      return id;
    },

    destroyEntity(id: EntityId): void {
      world.destroyEntity(id);
    },

    setPosition(id: EntityId, x: number, y: number, z: number): void {
      const entity = world.getEntity(id);
      if (!entity) return;
      const transform = entity.getComponent<TransformComponent>('Transform');
      if (transform) {
        transform.position.set(x, y, z);
      }
    },

    getPosition(id: EntityId): [number, number, number] | null {
      const entity = world.getEntity(id);
      if (!entity) return null;
      const transform = entity.getComponent<TransformComponent>('Transform');
      if (transform) {
        return [transform.position.x, transform.position.y, transform.position.z];
      }
      return null;
    },

    setRotation(id: EntityId, x: number, y: number, z: number): void {
      const entity = world.getEntity(id);
      if (!entity) return;
      const transform = entity.getComponent<TransformComponent>('Transform');
      if (transform) {
        transform.rotation.set(x, y, z);
      }
    },

    setScale(id: EntityId, x: number, y: number, z: number): void {
      const entity = world.getEntity(id);
      if (!entity) return;
      const transform = entity.getComponent<TransformComponent>('Transform');
      if (transform) {
        transform.scale.set(x, y, z);
      }
    },

    setMeshType(id: EntityId, meshType: string): void {
      const entity = world.getEntity(id);
      if (!entity) return;
      const mesh = entity.getComponent<MeshRendererComponent>('MeshRenderer');
      if (mesh) {
        mesh.meshType = meshType as MeshType;
      }
    },

    setColor(id: EntityId, color: string): void {
      const entity = world.getEntity(id);
      if (!entity) return;
      const mesh = entity.getComponent<MeshRendererComponent>('MeshRenderer');
      if (mesh) {
        mesh.color = color;
      }
    },

    setSize(id: EntityId, w: number, h: number, d: number): void {
      const entity = world.getEntity(id);
      if (!entity) return;
      const mesh = entity.getComponent<MeshRendererComponent>('MeshRenderer');
      if (mesh) {
        mesh.size = [w, h, d];
      }
    },

    setVelocity(id: EntityId, x: number, y: number, z: number): void {
      if (physics) {
        physics.setVelocity(id, [x, y, z]);
        return;
      }
      const entity = world.getEntity(id);
      if (!entity) return;
      const rigidBody = entity.getComponent<RigidBodyComponent>('RigidBody');
      if (rigidBody) {
        rigidBody.linearVelocity = [x, y, z];
      }
    },

    getVelocity(id: EntityId): [number, number, number] | null {
      if (physics) {
        return physics.getVelocity(id);
      }
      const entity = world.getEntity(id);
      if (!entity) return null;
      const rigidBody = entity.getComponent<RigidBodyComponent>('RigidBody');
      if (rigidBody) {
        return rigidBody.linearVelocity;
      }
      return null;
    },

    applyForce(id: EntityId, x: number, y: number, z: number): void {
      if (physics) {
        physics.applyForce(id, [x, y, z]);
        return;
      }
      const entity = world.getEntity(id);
      if (!entity) return;
      const rigidBody = entity.getComponent<RigidBodyComponent>('RigidBody');
      if (rigidBody) {
        rigidBody.linearVelocity[0] += x;
        rigidBody.linearVelocity[1] += y;
        rigidBody.linearVelocity[2] += z;
      }
    },

    applyImpulse(id: EntityId, x: number, y: number, z: number): void {
      if (physics) {
        physics.applyImpulse(id, [x, y, z]);
      }
    },

    setGravity(x: number, y: number, z: number): void {
      if (physics) {
        physics.setGravity(x, y, z);
      }
    },

    raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number): RaycastHit | null {
      if (physics) {
        return physics.raycast([ox, oy, oz], [dx, dy, dz]);
      }
      return null;
    },

    raycastAll(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number): RaycastHit[] {
      if (physics) {
        return physics.raycastAll([ox, oy, oz], [dx, dy, dz]);
      }
      return [];
    },

    print(...args: any[]): void {
      console.log('[Lua]', ...args);
    },

    wait(_seconds: number): void {
      // Implemented via coroutines in Lua
    },

    getTime(): number {
      return performance.now() / 1000;
    },
  };

  return api;
}
