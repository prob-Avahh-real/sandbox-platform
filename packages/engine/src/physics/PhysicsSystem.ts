// Rapier3D physics system — full integration
// Uses @dimforge/rapier3d-compat (WASM)

import RAPIER from '@dimforge/rapier3d-compat';
import { System } from '../ecs/System';
import { World } from '../ecs/World';
import { Entity } from '../ecs/Entity';
import { EntityId, Signature, getComponentId } from '../ecs/Component';
import { TransformComponent, RigidBodyComponent, ColliderShape } from '../components';
import * as THREE from 'three';

// Rapier body handle map: entityId → handle
interface PhysicsHandles {
  rigidBody: RAPIER.RigidBody;
  collider: RAPIER.Collider;
}

// Contact event callback data
export interface ContactEvent {
  entityA: EntityId;
  entityB: EntityId;
  started: boolean;
  point: [number, number, number];
  normal: [number, number, number];
}

// Raycast result
export interface RaycastHit {
  entityId: EntityId;
  point: [number, number, number];
  normal: [number, number, number];
  distance: number;
}

export class PhysicsSystem extends System {
  readonly requiredSignature: Signature;

  private rapierWorld!: RAPIER.World;
  private eventQueue!: RAPIER.EventQueue;
  private handles = new Map<EntityId, PhysicsHandles>();
  private pendingRemovals = new Set<EntityId>();
  private initialized = false;
  private gravity: [number, number, number] = [0, -9.81, 0];
  private contactListeners: ((event: ContactEvent) => void)[] = [];

  // Query signature matching
  private transformSig: Signature;
  private rigidBodySig: Signature;

  constructor(world: World) {
    super(world);

    this.transformSig = new Signature();
    this.transformSig.set(getComponentId('Transform')!);

    this.rigidBodySig = new Signature();
    this.rigidBodySig.set(getComponentId('Transform')!);
    this.rigidBodySig.set(getComponentId('RigidBody')!);

    this.requiredSignature = this.rigidBodySig;
  }

  /**
   * Initialize Rapier (async — call once before first update)
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    await RAPIER.init();
    this.rapierWorld = new RAPIER.World({ x: this.gravity[0], y: this.gravity[1], z: this.gravity[2] });
    this.eventQueue = new RAPIER.EventQueue(true);
    this.initialized = true;
  }

  setGravity(x: number, y: number, z: number): void {
    this.gravity = [x, y, z];
    if (this.initialized) {
      this.rapierWorld.gravity = { x, y, z };
    }
  }

  /**
   * Register a callback for contact events
   */
  onContact(cb: (event: ContactEvent) => void): () => void {
    this.contactListeners.push(cb);
    return () => {
      this.contactListeners = this.contactListeners.filter(l => l !== cb);
    };
  }

  /**
   * Raycast into the physics world
   */
  raycast(
    origin: [number, number, number],
    direction: [number, number, number],
    maxDistance = 100
  ): RaycastHit | null {
    if (!this.initialized) return null;

    const ray = new RAPIER.Ray(
      { x: origin[0], y: origin[1], z: origin[2] },
      { x: direction[0], y: direction[1], z: direction[2] }
    );
    const hit = this.rapierWorld.castRay(ray, maxDistance, true);

    if (hit) {
      // @ts-ignore rapier compat types
      const point = hit.point();
      // @ts-ignore
      const normal = hit.normal();
      const collider = hit.collider;
      let entityId = 0;
      for (const [eid, h] of this.handles) {
        if (h.collider === collider) {
          entityId = eid;
          break;
        }
      }
      return {
        entityId,
        point: [point.x, point.y, point.z],
        normal: [normal.x, normal.y, normal.z],
        // @ts-ignore
      distance: hit.toi,
      };
    }
    return null;
  }

  /**
   * Raycast all hits
   */
  raycastAll(
    origin: [number, number, number],
    direction: [number, number, number],
    maxDistance = 100
  ): RaycastHit[] {
    if (!this.initialized) return [];

    const ray = new RAPIER.Ray(
      { x: origin[0], y: origin[1], z: origin[2] },
      { x: direction[0], y: direction[1], z: direction[2] }
    );
    const hits: RaycastHit[] = [];
    this.rapierWorld.intersectionsWithRay(ray, maxDistance, true, (intersection) => {
      // @ts-ignore
      const point = intersection.point();
      // @ts-ignore
      const normal = intersection.normal();
      const collider = intersection.collider;
      let entityId = 0;
      for (const [eid, h] of this.handles) {
        if (h.collider === collider) {
          entityId = eid;
          break;
        }
      }
      hits.push({
        entityId,
        point: [point.x, point.y, point.z],
        normal: [normal.x, normal.y, normal.z],
        // @ts-ignore
        distance: intersection.toi,
      });
      return true;
    });
    return hits;
  }

  start(): void {
    // Deferred init — caller should call init() before first update
  }

  update(dt: number): void {
    if (!this.initialized) return;

    // 1. Process pending removals
    for (const entityId of this.pendingRemovals) {
      this.removePhysicsBody(entityId);
    }
    this.pendingRemovals.clear();

    // 2. Sync ECS → Rapier: create/update bodies
    this.syncECS2Rapier();

    // 3. Step simulation (set timestep first, then step)
    this.rapierWorld.timestep = Math.min(dt, 0.033);
    this.rapierWorld.step();

    // 4. Process contact events
    // @ts-ignore rapier compat
    this.eventQueue.drainContactEvents((collider1: any, collider2: any, started: any) => {
      const eidA = this.findEntityByCollider(collider1);
      const eidB = this.findEntityByCollider(collider2);
      if (eidA && eidB) {
        const manifolds = collider1.contactManifoldsWith(collider2);
        let point: [number, number, number] = [0, 0, 0];
        let normal: [number, number, number] = [0, 1, 0];

        if (manifolds.length > 0 && manifolds[0].numContacts() > 0) {
          const cp = manifolds[0].contact(0);
          if (cp) {
            point = [cp.point().x, cp.point().y, cp.point().z];
          }
          const n = manifolds[0].normal();
          normal = [n.x, n.y, n.z];
        }

        const event: ContactEvent = {
          entityA: eidA,
          entityB: eidB,
          started,
          point,
          normal,
        };
        for (const listener of this.contactListeners) {
          listener(event);
        }
      }
    });

    this.eventQueue.drainCollisionEvents((_collider1, _collider2, _started) => {
      // Collision start/stop events (includes sensors/triggers)
    });

    // 5. Sync Rapier → ECS: copy transforms back
    this.syncRapier2ECS();

    // 6. Remove destroyed entities
    this.cleanupDestroyed();
  }

  /**
   * Apply an impulse to an entity's rigid body
   */
  applyImpulse(entityId: EntityId, impulse: [number, number, number], wake = true): void {
    const handle = this.handles.get(entityId);
    if (!handle) return;
    handle.rigidBody.applyImpulse(
      { x: impulse[0], y: impulse[1], z: impulse[2] },
      wake
    );
  }

  /**
   * Apply a force at the center of mass
   */
  applyForce(entityId: EntityId, force: [number, number, number], wake = true): void {
    const handle = this.handles.get(entityId);
    if (!handle) return;
    // @ts-ignore rapier compat
    handle.rigidBody.applyForce(
      { x: force[0], y: force[1], z: force[2] },
      wake
    );
  }

  /**
   * Set linear velocity
   */
  setVelocity(entityId: EntityId, velocity: [number, number, number]): void {
    const handle = this.handles.get(entityId);
    if (!handle) return;
    // @ts-ignore rapier compat
    handle.rigidBody.setLinvel({ x: velocity[0], y: velocity[1], z: velocity[2] }, true);
  }

  /**
   * Get linear velocity
   */
  getVelocity(entityId: EntityId): [number, number, number] | null {
    const handle = this.handles.get(entityId);
    if (!handle) return null;
    const v = handle.rigidBody.linvel();
    return [v.x, v.y, v.z];
  }

  /**
   * Get the Rapier rigid body for an entity
   */
  getRigidBody(entityId: EntityId): RAPIER.RigidBody | undefined {
    return this.handles.get(entityId)?.rigidBody;
  }

  /**
   * Get the Rapier collider for an entity
   */
  getCollider(entityId: EntityId): RAPIER.Collider | undefined {
    return this.handles.get(entityId)?.collider;
  }

  // ---- Internal ----

  private syncECS2Rapier(): void {
    const entities = this.world.query(this.rigidBodySig);

    for (const entity of entities) {
      const transform = entity.getComponent<TransformComponent>('Transform');
      const rigidBody = entity.getComponent<RigidBodyComponent>('RigidBody');
      if (!transform || !rigidBody) continue;

      const existingHandle = this.handles.get(entity.id);

      if (!existingHandle) {
        this.createPhysicsBody(entity.id, transform, rigidBody);
      } else {
        this.updatePhysicsBody(existingHandle, rigidBody);
      }
    }
  }

  private createPhysicsBody(
    entityId: EntityId,
    transform: TransformComponent,
    rb: RigidBodyComponent
  ): void {
    const bodyDesc = this.buildBodyDesc(rb);
    bodyDesc.setTranslation(
      transform.position.x,
      transform.position.y,
      transform.position.z
    );

    bodyDesc.setRotation({
      x: transform.rotation.x,
      y: transform.rotation.y,
      z: transform.rotation.z,
      w: 1,
    });

    const rigidBody = this.rapierWorld.createRigidBody(bodyDesc);

    const colliderDesc = this.buildColliderDesc(rb);
    const collider = this.rapierWorld.createCollider(colliderDesc, rigidBody);

    this.handles.set(entityId, { rigidBody, collider });
  }

  private buildBodyDesc(rb: RigidBodyComponent): RAPIER.RigidBodyDesc {
    let desc: RAPIER.RigidBodyDesc;

    switch (rb.bodyType) {
      case 'static':
        desc = RAPIER.RigidBodyDesc.fixed();
        break;
      case 'kinematic':
        desc = RAPIER.RigidBodyDesc.kinematicPositionBased();
        break;
      case 'dynamic':
      default:
        desc = RAPIER.RigidBodyDesc.dynamic();
        // @ts-ignore rapier compat — setAdditionalMass or setMass
        if (typeof desc.setMass === 'function') desc.setMass(rb.mass > 0 ? rb.mass : 1);
        break;
    }

    // @ts-ignore rapier compat
    desc.setLinvel(rb.linearVelocity[0], rb.linearVelocity[1], rb.linearVelocity[2]);
    desc.setAngvel({ x: rb.angularVelocity[0], y: rb.angularVelocity[1], z: rb.angularVelocity[2] });
    desc.setGravityScale(rb.useGravity ? 1 : 0);
    desc.setLinearDamping(rb.linearDamping);
    desc.setAngularDamping(rb.angularDamping);
    desc.setCanSleep(rb.canSleep);
    // @ts-ignore rapier compat
    desc.lockRotations(rb.lockRotation[0], rb.lockRotation[1], rb.lockRotation[2]);

    return desc;
  }

  private buildColliderDesc(rb: RigidBodyComponent): RAPIER.ColliderDesc {
    let desc: RAPIER.ColliderDesc;
    const [sx, sy, sz] = rb.colliderSize;

    switch (rb.colliderShape) {
      case 'ball':
        desc = RAPIER.ColliderDesc.ball(sx);
        break;
      case 'capsule':
        desc = RAPIER.ColliderDesc.capsule(sy, sx);
        break;
      case 'cylinder':
        desc = RAPIER.ColliderDesc.cylinder(sy, sx);
        break;
      case 'trimesh':
        desc = RAPIER.ColliderDesc.cuboid(sx, sy, sz);
        break;
      case 'cuboid':
      default:
        desc = RAPIER.ColliderDesc.cuboid(sx, sy, sz);
        break;
    }

    desc.setSensor(rb.isTrigger);
    desc.setFriction(rb.friction);
    desc.setRestitution(rb.restitution);
    desc.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

    return desc;
  }

  private updatePhysicsBody(
    handles: PhysicsHandles,
    rb: RigidBodyComponent
  ): void {
    const body = handles.rigidBody;
    body.setLinvel(
      { x: rb.linearVelocity[0], y: rb.linearVelocity[1], z: rb.linearVelocity[2] },
      true
    );
    if (!rb.canSleep) {
      body.wakeUp();
    }
  }

  private syncRapier2ECS(): void {
    for (const [entityId, handles] of this.handles) {
      const entity = this.world.getEntity(entityId);
      if (!entity) continue;

      const transform = entity.getComponent<TransformComponent>('Transform');
      if (!transform) continue;

      const body = handles.rigidBody;
      if (!body || body.isFixed()) continue;

      const pos = body.translation();
      const rot = body.rotation();

      transform.position.set(pos.x, pos.y, pos.z);

      const quat = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w);
      transform.rotation.setFromQuaternion(quat);
    }
  }

  private removePhysicsBody(entityId: EntityId): void {
    const handles = this.handles.get(entityId);
    if (!handles) return;

    this.rapierWorld.removeCollider(handles.collider, true);
    this.rapierWorld.removeRigidBody(handles.rigidBody);
    this.handles.delete(entityId);
  }

  private cleanupDestroyed(): void {
    for (const [entityId] of this.handles) {
      if (!this.world.getEntity(entityId)) {
        this.pendingRemovals.add(entityId);
      }
    }
  }

  private findEntityByCollider(collider: RAPIER.Collider): EntityId | null {
    for (const [eid, h] of this.handles) {
      if (h.collider === collider) return eid;
    }
    return null;
  }

  stop(): void {
    for (const [entityId] of this.handles) {
      this.removePhysicsBody(entityId);
    }
    this.handles.clear();
  }
}
