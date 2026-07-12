// CameraFollowSystem — makes the main camera smoothly follow the player entity

import { System } from '../ecs/System';
import { World } from '../ecs/World';
import { Entity } from '../ecs/Entity';
import { Signature, getComponentId } from '../ecs/Component';
import { TransformComponent, CameraComponent, PlayerComponent } from '../components';
import * as THREE from 'three';

export class CameraFollowSystem extends System {
  readonly requiredSignature: Signature;

  private playerSig: Signature;
  private cameraEntityId: number | null = null;
  private playerEntityId: number | null = null;
  private offset = new THREE.Vector3(0, 5, -8);
  private smoothSpeed = 8.0;

  constructor(world: World) {
    super(world);

    // We need both cameras and players
    const transformId = getComponentId('Transform')!;
    const cameraId = getComponentId('Camera')!;
    const playerId = getComponentId('Player')!;

    this.playerSig = new Signature();
    this.playerSig.set(transformId);
    this.playerSig.set(playerId);

    // Accept entities with Transform (we handle both cameras and players internally)
    this.requiredSignature = new Signature();
    this.requiredSignature.set(transformId);

    this.priority = 90;
  }

  setCameraEntity(id: number): void {
    this.cameraEntityId = id;
  }

  setPlayerEntity(id: number): void {
    this.playerEntityId = id;
  }

  setOffset(x: number, y: number, z: number): void {
    this.offset.set(x, y, z);
  }

  update(dt: number): void {
    // Find local player
    const players = this.world.query(this.playerSig);
    for (const entity of players) {
      const player = entity.getComponent<PlayerComponent>('Player');
      if (player?.isLocal) {
        this.playerEntityId = entity.id;
        break;
      }
    }

    if (this.playerEntityId === null || this.cameraEntityId === null) return;

    const playerEntity = this.world.getEntity(this.playerEntityId);
    const camEntity = this.world.getEntity(this.cameraEntityId);

    if (!playerEntity || !camEntity) return;

    const playerTransform = playerEntity.getComponent<TransformComponent>('Transform');
    const camTransform = camEntity.getComponent<TransformComponent>('Transform');

    if (!playerTransform || !camTransform) return;

    // Target camera position
    const targetPos = new THREE.Vector3(
      playerTransform.position.x + this.offset.x,
      playerTransform.position.y + this.offset.y,
      playerTransform.position.z + this.offset.z
    );

    // Smooth lerp
    const t = 1 - Math.exp(-this.smoothSpeed * dt);
    camTransform.position.lerp(targetPos, t);

    // Look at player
    const lookTarget = new THREE.Vector3(
      playerTransform.position.x,
      playerTransform.position.y + 1.5,
      playerTransform.position.z
    );
    camEntity.getComponent<CameraComponent>('Camera'); // ensure camera comp exists
    // Use lookAt via quaternion
    const mat = new THREE.Matrix4();
    mat.lookAt(camTransform.position, lookTarget, new THREE.Vector3(0, 1, 0));
    const quat = new THREE.Quaternion();
    quat.setFromRotationMatrix(mat);
    camTransform.rotation.setFromQuaternion(quat);
  }
}
