// PlayerMovementSystem — reads InputManager and drives the local player entity
// Handles WASD movement, jumping, mouse-look orbit camera

import { System } from '../ecs/System';
import { World } from '../ecs/World';
import { Entity } from '../ecs/Entity';
import { Signature, getComponentId } from '../ecs/Component';
import { TransformComponent, RigidBodyComponent, PlayerComponent } from '../components';
import { InputManager } from '../input/InputManager';
import { PhysicsSystem } from '../physics/PhysicsSystem';
import * as THREE from 'three';

export class PlayerMovementSystem extends System {
  readonly requiredSignature: Signature;

  private input: InputManager;
  private physics: PhysicsSystem | null;
  private playerSig: Signature;
  private isGrounded = true;
  private jumpCooldown = 0;
  private yaw = 0;
  private pitch = 0;
  private cameraEntityId: number | null = null;
  private playerEntityId: number | null = null;

  constructor(world: World, input: InputManager, physics?: PhysicsSystem) {
    super(world);

    this.input = input;
    this.physics = physics ?? null;

    this.playerSig = new Signature();
    this.playerSig.set(getComponentId('Transform')!);
    this.playerSig.set(getComponentId('RigidBody')!);
    this.playerSig.set(getComponentId('Player')!);

    this.requiredSignature = this.playerSig;
    this.priority = 100; // after physics
  }

  setCameraEntity(id: number): void { this.cameraEntityId = id; }
  setPlayerEntity(id: number): void { this.playerEntityId = id; }

  update(dt: number): void {
    const players = this.world.query(this.playerSig);

    let playerEntity: Entity | null = null;
    for (const entity of players) {
      const player = entity.getComponent<PlayerComponent>('Player');
      if (player?.isLocal) {
        playerEntity = entity;
        this.playerEntityId = entity.id;
        break;
      }
    }

    if (!playerEntity) return;

    const transform = playerEntity.getComponent<TransformComponent>('Transform');
    const rigidBody = playerEntity.getComponent<RigidBodyComponent>('RigidBody');
    const player = playerEntity.getComponent<PlayerComponent>('Player');
    if (!transform || !rigidBody || !player) return;

    const inputState = this.input.getState();

    // --- Camera look (mouse or touch drag) ---
    const lookDx = inputState.mouseDeltaX || inputState.touchDeltaX;
    const lookDy = inputState.mouseDeltaY || inputState.touchDeltaY;
    if (lookDx !== 0 || lookDy !== 0) {
      const sensitivity = inputState.mouseDeltaX !== 0 ? 0.002 : 0.005;
      this.yaw -= lookDx * sensitivity;
      this.pitch -= lookDy * sensitivity;
      this.pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.pitch));
    }

    // --- Ground check ---
    const groundResult = this.checkGrounded(transform);
    this.isGrounded = groundResult;

    // --- Jump cooldown ---
    this.jumpCooldown = Math.max(0, this.jumpCooldown - dt);

    // --- Movement ---
    const speed = player.moveSpeed;
    const jumpForce = player.jumpForce;
    const sprintMultiplier = inputState.actions.has('sprint') ? 1.6 : 1.0;

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    let mx = 0, mz = 0;
    if (inputState.actions.has('moveForward'))  mz -= 1;
    if (inputState.actions.has('moveBackward')) mz += 1;
    if (inputState.actions.has('moveLeft'))    mx -= 1;
    if (inputState.actions.has('moveRight'))   mx += 1;

    const len = Math.sqrt(mx * mx + mz * mz);
    if (len > 0) { mx /= len; mz /= len; }

    // Apply horizontal velocity directly
    rigidBody.linearVelocity[0] = forward.x * mz * speed * sprintMultiplier + right.x * mx * speed * sprintMultiplier;
    rigidBody.linearVelocity[2] = forward.z * mz * speed * sprintMultiplier + right.z * mx * speed * sprintMultiplier;

    // Jump
    if (inputState.actions.has('jump') && this.isGrounded && this.jumpCooldown <= 0) {
      this.physics?.setVelocity(playerEntity.id, [
        rigidBody.linearVelocity[0],
        jumpForce,
        rigidBody.linearVelocity[2],
      ]);
      this.jumpCooldown = 0.2;
      this.isGrounded = false;
    }

    // --- Camera orbit ---
    if (this.cameraEntityId !== null) {
      const camEntity = this.world.getEntity(this.cameraEntityId);
      if (camEntity) {
        const camTransform = camEntity.getComponent<TransformComponent>('Transform');
        if (camTransform) {
          const dist = 8 + Math.sin(this.pitch) * 3;
          const height = 5 - Math.sin(this.pitch) * 2;

          camTransform.position.set(
            transform.position.x + Math.sin(this.yaw) * dist,
            transform.position.y + height,
            transform.position.z + Math.cos(this.yaw) * dist
          );

          const lookTarget = new THREE.Vector3(
            transform.position.x,
            transform.position.y + 1.5,
            transform.position.z
          );
          const dir = new THREE.Vector3().subVectors(lookTarget, camTransform.position).normalize();
          const euler = new THREE.Euler();
          const q = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 0, -1), dir
          );
          euler.setFromQuaternion(q);
          camTransform.rotation.copy(euler);
        }
      }
    }
  }

  private checkGrounded(transform: TransformComponent): boolean {
    // Simple ground check: if near y=0
    if (transform.position.y <= 0.05) return true;

    // Raycast check
    if (this.physics && this.playerEntityId !== null) {
      const origin: [number, number, number] = [
        transform.position.x,
        transform.position.y + 0.5,
        transform.position.z,
      ];
      const hit = this.physics.raycast(origin, [0, -1, 0], 1.0);
      return hit !== null && hit.entityId !== this.playerEntityId;
    }

    return transform.position.y < 0.1;
  }

  getCameraYaw(): number { return this.yaw; }
  setCameraYaw(y: number): void { this.yaw = y; }
}
