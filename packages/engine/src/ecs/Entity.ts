import { EntityId, Signature, getComponentId } from './Component';

export class Entity {
  readonly id: EntityId;
  readonly signature = new Signature();
  private components = new Map<string, any>();
  active = true;
  name: string;
  parent: EntityId | null = null;
  children: EntityId[] = [];

  constructor(id: EntityId, name = `Entity_${id}`) {
    this.id = id;
    this.name = name;
  }

  addComponent<T>(component: T & { type: string }): void {
    this.components.set(component.type, component);
    const cid = getComponentId(component.type);
    if (cid !== undefined) this.signature.set(cid);
  }

  removeComponent(type: string): void {
    this.components.delete(type);
    const cid = getComponentId(type);
    if (cid !== undefined) this.signature.clear(cid);
  }

  getComponent<T>(type: string): T | undefined {
    return this.components.get(type) as T | undefined;
  }

  hasComponent(type: string): boolean {
    return this.components.has(type);
  }

  getAllComponents(): Map<string, any> {
    return this.components;
  }

  addChild(childId: EntityId): void {
    if (!this.children.includes(childId)) {
      this.children.push(childId);
    }
  }

  removeChild(childId: EntityId): void {
    this.children = this.children.filter(id => id !== childId);
  }
}
