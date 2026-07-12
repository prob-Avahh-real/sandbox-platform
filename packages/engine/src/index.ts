// @sandbox/engine - Core game engine

export { World } from './ecs/World';
export { Entity } from './ecs/Entity';
export { System } from './ecs/System';
export { Signature, createEntityId, registerComponent, getComponentId } from './ecs/Component';
export type { EntityId, IComponent } from './ecs/Component';

export { Game } from './Game';
export type { GameConfig } from './Game';

export { SceneManager } from './scene/SceneManager';
export { PhysicsSystem } from './physics/PhysicsSystem';
export type { ContactEvent, RaycastHit } from './physics/PhysicsSystem';
export { InputManager } from './input/InputManager';
export type { InputAction, InputState, TouchPoint, TouchZoneConfig } from './input/InputManager';

export { PlayerMovementSystem } from './systems/PlayerMovementSystem';
export { CameraFollowSystem } from './systems/CameraFollowSystem';

export { createLuaAPI } from './scripting/ScriptHost';
export type { LuaAPI } from './scripting/ScriptHost';

export * from './components';
