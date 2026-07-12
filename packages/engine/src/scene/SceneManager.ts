import * as THREE from 'three';
import { World } from '../ecs/World';
import { Entity } from '../ecs/Entity';
import { Signature, registerComponent, getComponentId } from '../ecs/Component';
import {
  TransformComponent,
  MeshRendererComponent,
  CameraComponent,
  LightComponent,
} from '../components';

export class SceneManager {
  readonly scene: THREE.Scene;
  private world: World;
  private entityObjects = new Map<number, THREE.Object3D>();
  private transformSig: Signature;
  private meshSig: Signature;
  private cameraSig: Signature;
  private lightSig: Signature;

  constructor(world: World) {
    this.world = world;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#1a1a2e');

    // Build signatures
    this.transformSig = new Signature();
    this.transformSig.set(getComponentId('Transform')!);

    this.meshSig = new Signature();
    this.meshSig.set(getComponentId('Transform')!);
    this.meshSig.set(getComponentId('MeshRenderer')!);

    this.cameraSig = new Signature();
    this.cameraSig.set(getComponentId('Transform')!);
    this.cameraSig.set(getComponentId('Camera')!);

    this.lightSig = new Signature();
    this.lightSig.set(getComponentId('Transform')!);
    this.lightSig.set(getComponentId('Light')!);
  }

  // Default lighting
  setupDefaultLighting(): void {
    const ambient = new THREE.AmbientLight('#404060', 0.5);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight('#ffffff', 1);
    sun.position.set(10, 20, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 100;
    sun.shadow.camera.left = -50;
    sun.shadow.camera.right = 50;
    sun.shadow.camera.top = 50;
    sun.shadow.camera.bottom = -50;
    this.scene.add(sun);
  }

  // Clear all entity-linked Three.js objects from the scene
  clearScene(): void {
    for (const [, obj] of this.entityObjects) {
      this.scene.remove(obj);
    }
    this.entityObjects.clear();
  }

  // Add a grid for reference
  addGrid(size = 20, divisions = 20): void {
    const grid = new THREE.GridHelper(size, divisions, '#444444', '#222222');
    this.scene.add(grid);
  }

  // Sync ECS world to Three.js scene
  syncEntities(): void {
    // Create/update mesh entities
    const meshEntities = this.world.query(this.meshSig);
    for (const entity of meshEntities) {
      this.syncMeshEntity(entity);
    }

    // Create/update camera entities
    const cameraEntities = this.world.query(this.cameraSig);
    for (const entity of cameraEntities) {
      this.syncCameraEntity(entity);
    }

    // Create/update light entities
    const lightEntities = this.world.query(this.lightSig);
    for (const entity of lightEntities) {
      this.syncLightEntity(entity);
    }

    // Remove objects for destroyed entities
    for (const [id] of this.entityObjects) {
      if (!this.world.getEntity(id)) {
        const obj = this.entityObjects.get(id);
        if (obj) {
          this.scene.remove(obj);
          this.entityObjects.delete(id);
        }
      }
    }
  }

  private syncMeshEntity(entity: Entity): void {
    const transform = entity.getComponent<TransformComponent>('Transform');
    const mesh = entity.getComponent<MeshRendererComponent>('MeshRenderer');
    if (!transform || !mesh) return;

    let obj = this.entityObjects.get(entity.id);
    if (!obj || !(obj instanceof THREE.Mesh)) {
      // Remove old object if it exists
      if (obj) this.scene.remove(obj);

      obj = this.createMesh(mesh);
      obj.userData.entityId = entity.id;
      this.scene.add(obj);
      this.entityObjects.set(entity.id, obj);
    }

    // Sync transform
    obj.position.copy(transform.position);
    obj.rotation.copy(transform.rotation);
    obj.scale.copy(transform.scale);
    obj.visible = mesh.visible;
  }

  private createMesh(comp: MeshRendererComponent): THREE.Mesh {
    let geometry: THREE.BufferGeometry;

    switch (comp.meshType) {
      case 'sphere':
        geometry = new THREE.SphereGeometry(comp.size[0] / 2, 32, 32);
        break;
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(
          comp.size[0] / 2,
          comp.size[0] / 2,
          comp.size[1],
          32
        );
        break;
      case 'plane':
        geometry = new THREE.PlaneGeometry(comp.size[0], comp.size[2]);
        break;
      case 'capsule':
        geometry = new THREE.CapsuleGeometry(comp.size[0] / 2, comp.size[1], 8, 16);
        break;
      case 'box':
      default:
        geometry = new THREE.BoxGeometry(comp.size[0], comp.size[1], comp.size[2]);
        break;
    }

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(comp.color),
      roughness: 0.5,
      metalness: 0.1,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = comp.castShadow;
    mesh.receiveShadow = true;
    return mesh;
  }

  private syncCameraEntity(entity: Entity): void {
    const transform = entity.getComponent<TransformComponent>('Transform');
    const camera = entity.getComponent<CameraComponent>('Camera');
    if (!transform || !camera) return;

    let obj = this.entityObjects.get(entity.id);
    if (!obj || !(obj instanceof THREE.PerspectiveCamera)) {
      if (obj) this.scene.remove(obj);

      obj = new THREE.PerspectiveCamera(camera.fov, 1, camera.near, camera.far);
      obj.userData.entityId = entity.id;
      this.scene.add(obj);
      this.entityObjects.set(entity.id, obj);
    }

    obj.position.copy(transform.position);
    obj.rotation.copy(transform.rotation);
  }

  private syncLightEntity(entity: Entity): void {
    const transform = entity.getComponent<TransformComponent>('Transform');
    const light = entity.getComponent<LightComponent>('Light');
    if (!transform || !light) return;

    let obj = this.entityObjects.get(entity.id);
    if (!obj || !(obj instanceof THREE.Light)) {
      if (obj) this.scene.remove(obj);

      switch (light.lightType) {
        case 'point':
          obj = new THREE.PointLight(light.color, light.intensity, 50);
          break;
        case 'spot':
          obj = new THREE.SpotLight(light.color, light.intensity, 50, Math.PI / 6);
          break;
        case 'ambient':
          obj = new THREE.AmbientLight(light.color, light.intensity);
          break;
        case 'directional':
        default:
          obj = new THREE.DirectionalLight(light.color, light.intensity);
          break;
      }

      if (obj instanceof THREE.DirectionalLight || obj instanceof THREE.SpotLight) {
        obj.castShadow = light.castShadow;
      }

      obj.userData.entityId = entity.id;
      this.scene.add(obj);
      this.entityObjects.set(entity.id, obj);
    }

    obj.position.copy(transform.position);
    obj.rotation.copy(transform.rotation);
  }

  // Get the Three.js object for an entity
  getObject3D(entityId: number): THREE.Object3D | undefined {
    return this.entityObjects.get(entityId);
  }

  // Get the main camera
  getMainCamera(): THREE.PerspectiveCamera | undefined {
    const cameraEntities = this.world.query(this.cameraSig);
    for (const entity of cameraEntities) {
      const cam = entity.getComponent<CameraComponent>('Camera');
      if (cam?.isMain) {
        const obj = this.entityObjects.get(entity.id);
        if (obj instanceof THREE.PerspectiveCamera) return obj;
      }
    }
    return undefined;
  }
}
