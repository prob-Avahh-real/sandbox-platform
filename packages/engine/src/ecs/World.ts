import { EntityId, createEntityId, Signature, registerComponent } from './Component';
import { Entity } from './Entity';
import { System } from './System';

export class World {
  private entities = new Map<EntityId, Entity>();
  private systems: System[] = [];
  private entityDestroyQueue: EntityId[] = [];

  // Create a new entity
  createEntity(name?: string): EntityId {
    const id = createEntityId();
    const entity = new Entity(id, name);
    this.entities.set(id, entity);
    return id;
  }

  // Destroy an entity and its children
  destroyEntity(id: EntityId): void {
    this.entityDestroyQueue.push(id);
  }

  // Get entity by id
  getEntity(id: EntityId): Entity | undefined {
    return this.entities.get(id);
  }

  // Query entities matching a signature
  query(signature: Signature): Entity[] {
    const result: Entity[] = [];
    for (const entity of this.entities.values()) {
      if (entity.active && entity.signature.contains(signature)) {
        result.push(entity);
      }
    }
    return result;
  }

  // Add a system
  addSystem(system: System): void {
    this.systems.push(system);
    this.systems.sort((a, b) => b.priority - a.priority);
    system.start?.();
  }

  // Remove a system
  removeSystem(system: System): void {
    const idx = this.systems.indexOf(system);
    if (idx !== -1) {
      system.stop?.();
      this.systems.splice(idx, 1);
    }
  }

  // Process destruction queue
  private flushDestroys(): void {
    for (const id of this.entityDestroyQueue) {
      const entity = this.entities.get(id);
      if (!entity) continue;

      // Destroy children recursively
      for (const childId of entity.children) {
        this.destroyEntity(childId);
      }

      // Remove from parent
      if (entity.parent !== null) {
        const parent = this.entities.get(entity.parent);
        parent?.removeChild(id);
      }

      this.entities.delete(id);
    }
    this.entityDestroyQueue = [];
  }

  // Main update loop
  update(dt: number): void {
    for (const system of this.systems) {
      system.update(dt);
    }
    this.flushDestroys();
  }

  // Get all entities
  getEntities(): Map<EntityId, Entity> {
    return this.entities;
  }

  // Clear all entities and the destruction queue
  clearAll(): void {
    this.entities.clear();
    this.entityDestroyQueue = [];
  }
}
