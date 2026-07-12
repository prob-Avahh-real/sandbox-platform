import { Signature } from './Component';
import { World } from './World';

export abstract class System {
  abstract readonly requiredSignature: Signature;
  protected world: World;
  priority = 0;

  constructor(world: World) {
    this.world = world;
  }

  // Called once when system is added
  start?(): void;

  // Called every frame with delta time in seconds
  abstract update(dt: number): void;

  // Called when system is removed
  stop?(): void;
}
