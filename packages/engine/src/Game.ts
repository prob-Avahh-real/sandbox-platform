import * as THREE from 'three';
import { World } from './ecs/World';
import { Signature, getComponentId } from './ecs/Component';
import { SceneManager } from './scene/SceneManager';
import { PhysicsSystem } from './physics/PhysicsSystem';
import { InputManager } from './input/InputManager';
import { PlayerMovementSystem } from './systems/PlayerMovementSystem';
import { CameraFollowSystem } from './systems/CameraFollowSystem';
import { createLuaAPI, LuaAPI } from './scripting/ScriptHost';
import { LuaRuntime } from '@sandbox/lua-runtime';

export interface GameConfig {
  canvas: HTMLCanvasElement;
  width?: number;
  height?: number;
  enablePhysics?: boolean;
  enableEditor?: boolean;
}

export class Game {
  readonly world: World;
  readonly sceneManager: SceneManager;
  readonly input: InputManager;
  readonly lua: LuaAPI;

  private renderer: THREE.WebGLRenderer;
  private physics?: PhysicsSystem;
  private playerMovement?: PlayerMovementSystem;
  private cameraFollow?: CameraFollowSystem;
  private _luaRuntime: LuaRuntime;
  private playerId: number | null = null;
  private camId: number | null = null;
  private clock: THREE.Clock;
  private running = false;
  private animFrameId = 0;
  private canvas: HTMLCanvasElement;
  private width: number;
  private height: number;
  private _ready = false;
  private _readyPromise: Promise<void>;

  constructor(config: GameConfig) {
    this.canvas = config.canvas;
    this.width = config.width || window.innerWidth;
    this.height = config.height || window.innerHeight;

    // Initialize Three.js renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // Core systems
    this.world = new World();
    this.sceneManager = new SceneManager(this.world);
    this.input = new InputManager();

    // Attach input
    this.input.attach(this.canvas);

    // Add physics if enabled (async init)
    if (config.enablePhysics !== false) {
      this.physics = new PhysicsSystem(this.world);
      this.world.addSystem(this.physics);
    }

    // Player movement system (requires input and physics)
    this.playerMovement = new PlayerMovementSystem(this.world, this.input, this.physics);
    this.world.addSystem(this.playerMovement);

    // Camera follow system
    this.cameraFollow = new CameraFollowSystem(this.world);
    this.world.addSystem(this.cameraFollow);

    // Lua API (physics must be created first)
    this.lua = createLuaAPI(this.world, this.physics);

    // Initialize Fengari Lua runtime
    this._luaRuntime = new LuaRuntime();
    this._luaRuntime.registerGlobal('sandbox', this.lua);

    // Default scene setup
    this.sceneManager.setupDefaultLighting();
    this.sceneManager.addGrid(50, 50);

    // Clock
    this.clock = new THREE.Clock();

    // Handle resize
    window.addEventListener('resize', this.onResize);

    // Async init for WASM physics + Lua
    this._readyPromise = (this.physics
      ? this.physics.init()
      : Promise.resolve()
    ).then(() => this._luaRuntime.init()).then(() => { this._ready = true; });
  }

  /** Wait until physics WASM is loaded */
  get ready(): Promise<void> {
    return this._readyPromise;
  }

  get isReady(): boolean {
    return this._ready;
  }

  /** Get the physics system (for raycasts, forces, etc.) */
  get physicsSystem(): PhysicsSystem | undefined {
    return this.physics;
  }

  /** Get the player movement system */
  get playerMovementSystem(): PlayerMovementSystem | undefined {
    return this.playerMovement;
  }

  /** Get the Lua runtime (Fengari) */
  get luaRuntime(): LuaRuntime {
    return this._luaRuntime;
  }

  private onResize = (): void => {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.renderer.setSize(this.width, this.height);

    const camera = this.sceneManager.getMainCamera();
    if (camera) {
      camera.aspect = this.width / this.height;
      camera.updateProjectionMatrix();
    }
  };

  // Create a default player character
  createDefaultPlayer(): number {
    const playerId = this.world.createEntity('LocalPlayer');
    const entity = this.world.getEntity(playerId)!;

    entity.addComponent({
      type: 'Transform',
      entityId: playerId,
      position: new THREE.Vector3(0, 3, 0),
      rotation: new THREE.Euler(0, 0, 0),
      scale: new THREE.Vector3(1, 1, 1),
    });

    entity.addComponent({
      type: 'MeshRenderer',
      entityId: playerId,
      meshType: 'capsule' as const,
      color: '#e74c3c',
      size: [0.6, 1.8, 0.6],
      visible: true,
      castShadow: true,
    });

    entity.addComponent({
      type: 'RigidBody',
      entityId: playerId,
      bodyType: 'dynamic' as const,
      mass: 1,
      colliderShape: 'capsule' as const,
      colliderSize: [0.3, 0.9, 0.3],
      linearVelocity: [0, 0, 0],
      angularVelocity: [0, 0, 0],
      linearDamping: 0.5,
      angularDamping: 0.5,
      useGravity: true,
      isTrigger: false,
      canSleep: false,
      lockRotation: [true, false, true] as [boolean, boolean, boolean],
      friction: 0.3,
      restitution: 0.0,
    });

    entity.addComponent({
      type: 'Player',
      entityId: playerId,
      userId: 'local',
      username: 'Player',
      moveSpeed: 6,
      jumpForce: 10,
      isLocal: true,
    });

    this.playerId = playerId;
    this.playerMovement?.setPlayerEntity(playerId);
    this.cameraFollow?.setPlayerEntity(playerId);

    // Camera that follows player
    const camId = this.world.createEntity('MainCamera');
    const camEntity = this.world.getEntity(camId)!;

    camEntity.addComponent({
      type: 'Transform',
      entityId: camId,
      position: new THREE.Vector3(0, 8, -10),
      rotation: new THREE.Euler(-0.5, 0, 0),
      scale: new THREE.Vector3(1, 1, 1),
    });

    camEntity.addComponent({
      type: 'Camera',
      entityId: camId,
      fov: 60,
      near: 0.1,
      far: 1000,
      isMain: true,
    });

    this.camId = camId;
    this.playerMovement?.setCameraEntity(camId);
    this.cameraFollow?.setCameraEntity(camId);

    return playerId;
  }

  // Create a simple ground platform
  createGround(size = 20): number {
    const groundId = this.world.createEntity('Ground');
    const entity = this.world.getEntity(groundId)!;

    entity.addComponent({
      type: 'Transform',
      entityId: groundId,
      position: new THREE.Vector3(0, 0, 0),
      rotation: new THREE.Euler(0, 0, 0),
      scale: new THREE.Vector3(1, 1, 1),
    });

    entity.addComponent({
      type: 'MeshRenderer',
      entityId: groundId,
      meshType: 'plane' as const,
      color: '#2ecc71',
      size: [size, 0.2, size],
      visible: true,
      castShadow: false,
    });

    entity.addComponent({
      type: 'RigidBody',
      entityId: groundId,
      bodyType: 'static' as const,
      mass: 0,
      colliderShape: 'cuboid' as const,
      colliderSize: [size / 2, 0.1, size / 2],
      linearVelocity: [0, 0, 0],
      angularVelocity: [0, 0, 0],
      linearDamping: 0,
      angularDamping: 0,
      useGravity: false,
      isTrigger: false,
      canSleep: true,
      lockRotation: [true, true, true] as [boolean, boolean, boolean],
      friction: 0.6,
      restitution: 0.1,
    });

    return groundId;
  }

  // Create a simple scene with some objects
  createDemoScene(): void {
    this.createGround(30);

    // Create a few colored blocks
    const colors = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c'];
    for (let i = 0; i < 15; i++) {
      const id = this.world.createEntity(`Block_${i}`);
      const entity = this.world.getEntity(id)!;
      const x = (Math.random() - 0.5) * 10;
      const z = (Math.random() - 0.5) * 10;
      const color = colors[Math.floor(Math.random() * colors.length)];

      entity.addComponent({
        type: 'Transform',
        entityId: id,
        position: new THREE.Vector3(x, 2 + Math.random() * 5, z),
        rotation: new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, 0),
        scale: new THREE.Vector3(0.5 + Math.random(), 0.5 + Math.random(), 0.5 + Math.random()),
      });

      entity.addComponent({
        type: 'MeshRenderer',
        entityId: id,
        meshType: 'box' as const,
        color,
        size: [1, 1, 1],
        visible: true,
        castShadow: true,
      });

      entity.addComponent({
        type: 'RigidBody',
        entityId: id,
        bodyType: 'dynamic' as const,
        mass: 1,
        colliderShape: 'cuboid' as const,
        colliderSize: [0.5, 0.5, 0.5],
        linearVelocity: [0, 0, 0],
        angularVelocity: [0, 0, 0],
        linearDamping: 0.1,
        angularDamping: 0.1,
        useGravity: true,
        isTrigger: false,
        canSleep: true,
        lockRotation: [false, false, false] as [boolean, boolean, boolean],
        friction: 0.5,
        restitution: 0.2,
      });
    }
  }

  /**
   * Load game from published data (from server)
   */
  loadFromData(data: {
    entities: Array<{
      id: number;
      name: string;
      components: Array<{ type: string; entityId: number; [key: string]: any }>;
    }>;
    sceneConfig: { groundSize: number; skyColor: string; ambientLight: string; ambientIntensity: number };
    luaScript: string;
  }): void {
    // Wipe previous world
    this.world.clearAll();
    this.sceneManager.clearScene();
    this.playerId = null;
    this.camId = null;

    // Apply scene config
    this.sceneManager.scene.background = new THREE.Color(data.sceneConfig.skyColor);

    // Recreate entities from saved data
    for (const savedEntity of data.entities) {
      const entityId = this.world.createEntity(savedEntity.name);
      const entity = this.world.getEntity(entityId);
      if (!entity) continue;

      for (const comp of savedEntity.components) {
        // Deserialize THREE types
        const deserialized: any = { ...comp, entityId };

        // Convert [x,y,z] arrays back to THREE objects
        for (const key of ['position', 'rotation', 'scale']) {
          if (Array.isArray(deserialized[key])) {
            if (key === 'rotation') {
              deserialized[key] = new THREE.Euler(
                deserialized[key][0],
                deserialized[key][1],
                deserialized[key][2]
              );
            } else {
              deserialized[key] = new THREE.Vector3(
                deserialized[key][0],
                deserialized[key][1],
                deserialized[key][2]
              );
            }
          }
        }

        // Convert colliderSize and size arrays
        for (const key of ['colliderSize', 'size', 'linearVelocity', 'angularVelocity', 'offset']) {
          if (Array.isArray(deserialized[key])) {
            deserialized[key] = deserialized[key] as [number, number, number];
          }
        }

        // Convert lockRotation (outside loop — standalone check)
        if (Array.isArray(deserialized.lockRotation)) {
          deserialized.lockRotation = deserialized.lockRotation as [boolean, boolean, boolean];
        }

        entity.addComponent(deserialized);

        // Track player entity
        if (comp.type === 'Player' && (comp as any).isLocal) {
          this.playerId = entityId;
          this.playerMovement?.setPlayerEntity(entityId);
          this.cameraFollow?.setPlayerEntity(entityId);
        }
      }
    }

    // Create default camera if the loaded data didn't include one
    {
      const cameraSig = new Signature();
      cameraSig.set(getComponentId('Camera')!);
      const existingCameras = this.world.query(cameraSig);

      if (existingCameras.length === 0) {
        const camId = this.world.createEntity('MainCamera');
        const camEntity = this.world.getEntity(camId)!;
        camEntity.addComponent({
          type: 'Transform', entityId: camId,
          position: new THREE.Vector3(0, 8, -10),
          rotation: new THREE.Euler(-0.5, 0, 0),
          scale: new THREE.Vector3(1, 1, 1),
        });
        camEntity.addComponent({
          type: 'Camera', entityId: camId,
          fov: 60, near: 0.1, far: 1000, isMain: true,
        });
        this.camId = camId;
        this.playerMovement?.setCameraEntity(camId);
        this.cameraFollow?.setCameraEntity(camId);
      }
    }

    // Ensure a local player exists
    {
      const playerSig = new Signature();
      playerSig.set(getComponentId('Player')!);
      const existingPlayers = this.world.query(playerSig);
      if (existingPlayers.length === 0) {
        this.createDefaultPlayer();
      }
    }

    // Execute Lua script if present
    if (data.luaScript && data.luaScript.trim()) {
      this._luaRuntime.execute(data.luaScript);
    }
  }

  /**
   * Serialize current ECS world to storage format (inverse of loadFromData)
   */
  saveToData(): { entities: any[]; sceneConfig: any; luaScript: string } {
    const entities: any[] = [];
    for (const [id, entity] of this.world.getEntities()) {
      const comps: any[] = [];
      for (const [type, comp] of entity.getAllComponents()) {
        const serialized: any = { type, entityId: id };
        for (const [key, value] of Object.entries(comp)) {
          if (key === 'type' || key === 'entityId') continue;
          if (value && typeof value === 'object' && 'x' in value && 'y' in value && 'z' in value) {
            serialized[key] = [value.x, value.y, value.z];
          } else if (Array.isArray(value)) {
            serialized[key] = value;
          } else {
            serialized[key] = value;
          }
        }
        comps.push(serialized);
      }
      entities.push({ id, name: entity.name, components: comps });
    }

    const bg = this.sceneManager.scene.background as THREE.Color;
    return {
      entities,
      sceneConfig: {
        groundSize: 30,
        skyColor: '#' + (bg?.getHexString?.() || '1a1a2e'),
        ambientLight: '#404060',
        ambientIntensity: 0.5,
      },
      luaScript: '',
    };
  }

  // Start the game loop
  start(): void {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    this.loop();
  }

  // Stop the game loop
  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.animFrameId);
  }

  private loop = (): void => {
    if (!this.running) return;

    const dt = Math.min(this.clock.getDelta(), 0.1); // Cap delta to avoid spiral

    // Update ECS world
    this.world.update(dt);

    // Sync Three.js scene with ECS world
    this.sceneManager.syncEntities();

    // Render
    const camera = this.sceneManager.getMainCamera();
    if (camera) {
      this.renderer.render(this.sceneManager.scene, camera);
    }

    // Reset input deltas
    this.input.endFrame();

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  // Dispose resources
  dispose(): void {
    this.stop();
    this.input.detach();
    this.renderer.dispose();
    window.removeEventListener('resize', this.onResize);
  }
}
