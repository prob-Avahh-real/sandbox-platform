// Entity Component System - Core types

export type EntityId = number;

let nextEntityId = 1;
export function createEntityId(): EntityId {
  return nextEntityId++;
}

export interface IComponent {
  type: string;
  entityId: EntityId;
}

// Component type registry
const componentTypes = new Map<string, number>();
let nextComponentId = 1;

export function registerComponent(name: string): number {
  if (componentTypes.has(name)) return componentTypes.get(name)!;
  const id = nextComponentId++;
  componentTypes.set(name, id);
  return id;
}

export function getComponentId(name: string): number | undefined {
  return componentTypes.get(name);
}

// Entity signature - bitmask of component types
export class Signature {
  private bits: bigint = 0n;

  set(componentId: number): void {
    this.bits |= (1n << BigInt(componentId));
  }

  clear(componentId: number): void {
    this.bits &= ~(1n << BigInt(componentId));
  }

  has(componentId: number): boolean {
    return (this.bits & (1n << BigInt(componentId))) !== 0n;
  }

  contains(other: Signature): boolean {
    return (this.bits & other.bits) === other.bits;
  }
}
