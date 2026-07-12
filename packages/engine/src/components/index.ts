// Built-in component types

import { IComponent, EntityId, registerComponent } from '../ecs/Component';
import * as THREE from 'three';

// ---- Transform ----
registerComponent('Transform');
export interface TransformComponent extends IComponent {
  type: 'Transform';
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
}

export function createTransform(pos?: [number, number, number]): TransformComponent {
  return {
    type: 'Transform',
    entityId: 0, // set by World
    position: new THREE.Vector3(pos?.[0] ?? 0, pos?.[1] ?? 0, pos?.[2] ?? 0),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
  };
}

// ---- MeshRenderer ----
registerComponent('MeshRenderer');
export type MeshType = 'box' | 'sphere' | 'cylinder' | 'plane' | 'capsule';

export interface MeshRendererComponent extends IComponent {
  type: 'MeshRenderer';
  meshType: MeshType;
  color: string;
  size: [number, number, number]; // width, height, depth
  visible: boolean;
  castShadow: boolean;
}

export function createMeshRenderer(
  meshType: MeshType = 'box',
  color = '#3498db',
  size: [number, number, number] = [1, 1, 1]
): MeshRendererComponent {
  return {
    type: 'MeshRenderer',
    entityId: 0,
    meshType,
    color,
    size,
    visible: true,
    castShadow: true,
  };
}

// ---- RigidBody ----
registerComponent('RigidBody');
export type RigidBodyType = 'static' | 'dynamic' | 'kinematic';
export type ColliderShape = 'cuboid' | 'ball' | 'cylinder' | 'capsule' | 'trimesh';

export interface RigidBodyComponent extends IComponent {
  type: 'RigidBody';
  bodyType: RigidBodyType;
  mass: number;
  colliderShape: ColliderShape;
  colliderSize: [number, number, number];  // half-extents for cuboid, radius+half-height for capsule/cylinder
  linearVelocity: [number, number, number];
  angularVelocity: [number, number, number];
  linearDamping: number;
  angularDamping: number;
  useGravity: boolean;
  isTrigger: boolean;
  canSleep: boolean;
  lockRotation: [boolean, boolean, boolean];
  friction: number;
  restitution: number;
}

export function createRigidBody(
  bodyType: RigidBodyType = 'dynamic',
  mass = 1,
  colliderShape: ColliderShape = 'cuboid',
  colliderSize: [number, number, number] = [0.5, 0.5, 0.5]
): RigidBodyComponent {
  return {
    type: 'RigidBody',
    entityId: 0,
    bodyType,
    mass,
    colliderShape,
    colliderSize,
    linearVelocity: [0, 0, 0],
    angularVelocity: [0, 0, 0],
    linearDamping: 0.1,
    angularDamping: 0.1,
    useGravity: true,
    isTrigger: false,
    canSleep: true,
    lockRotation: [false, false, false],
    friction: 0.5,
    restitution: 0.0,
  };
}

// ---- Script ----
registerComponent('Script');
export interface ScriptComponent extends IComponent {
  type: 'Script';
  source: string;
  compiled?: any;
  running: boolean;
}

export function createScript(source: string): ScriptComponent {
  return {
    type: 'Script',
    entityId: 0,
    source,
    running: false,
  };
}

// ---- Camera ----
registerComponent('Camera');
export interface CameraComponent extends IComponent {
  type: 'Camera';
  fov: number;
  near: number;
  far: number;
  isMain: boolean;
}

export function createCamera(fov = 60, isMain = true): CameraComponent {
  return {
    type: 'Camera',
    entityId: 0,
    fov,
    near: 0.1,
    far: 1000,
    isMain,
  };
}

// ---- Light ----
registerComponent('Light');
export type LightType = 'directional' | 'point' | 'spot' | 'ambient';

export interface LightComponent extends IComponent {
  type: 'Light';
  lightType: LightType;
  color: string;
  intensity: number;
  castShadow: boolean;
}

export function createLight(
  lightType: LightType = 'directional',
  color = '#ffffff',
  intensity = 1
): LightComponent {
  return {
    type: 'Light',
    entityId: 0,
    lightType,
    color,
    intensity,
    castShadow: lightType === 'directional',
  };
}

// ---- Player ----
registerComponent('Player');
export interface PlayerComponent extends IComponent {
  type: 'Player';
  userId: string;
  username: string;
  moveSpeed: number;
  jumpForce: number;
  isLocal: boolean;
}

export function createPlayer(
  userId: string,
  username: string,
  isLocal = false
): PlayerComponent {
  return {
    type: 'Player',
    entityId: 0,
    userId,
    username,
    moveSpeed: 5,
    jumpForce: 8,
    isLocal,
  };
}

// ---- NameTag ----
registerComponent('NameTag');
export interface NameTagComponent extends IComponent {
  type: 'NameTag';
  text: string;
  color: string;
  fontSize: number;
  offset: [number, number, number];
}

export function createNameTag(text: string): NameTagComponent {
  return {
    type: 'NameTag',
    entityId: 0,
    text,
    color: '#ffffff',
    fontSize: 14,
    offset: [0, 2, 0],
  };
}
