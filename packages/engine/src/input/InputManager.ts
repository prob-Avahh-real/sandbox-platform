// Input manager for keyboard, mouse, touch, and gamepad

export type InputAction =
  | 'moveForward'
  | 'moveBackward'
  | 'moveLeft'
  | 'moveRight'
  | 'jump'
  | 'sprint'
  | 'interact'
  | 'primaryAction'
  | 'secondaryAction'
  | 'escape';

export interface TouchPoint {
  id: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
}

export interface InputState {
  keys: Set<string>;
  mouseButtons: Set<number>;
  mouseX: number;
  mouseY: number;
  mouseDeltaX: number;
  mouseDeltaY: number;
  scrollDelta: number;
  /** Touch-based delta for camera orbit (one-finger drag on camera zone) */
  touchDeltaX: number;
  touchDeltaY: number;
  /** Normalized joystick direction [-1..1] from left-side touch */
  touchMoveX: number;
  touchMoveY: number;
  /** Active touch points */
  touches: TouchPoint[];
  /** Pinch distance for zoom, -1 if not pinching */
  pinchDistance: number;
  actions: Set<InputAction>;
}

export interface TouchZoneConfig {
  /** Fraction of screen width for the movement joystick zone (left side) */
  moveZoneWidth: number;
  /** Fraction of screen width for the camera orbit zone (right side) */
  cameraZoneWidth: number;
  /** Fraction of screen height for the jump button zone (bottom-right corner) */
  jumpZoneHeight: number;
  /** Dead zone radius in pixels for joystick center */
  deadZoneRadius: number;
}

// Default key bindings
const defaultBindings: Record<string, InputAction> = {
  KeyW: 'moveForward',
  ArrowUp: 'moveForward',
  KeyS: 'moveBackward',
  ArrowDown: 'moveBackward',
  KeyA: 'moveLeft',
  ArrowLeft: 'moveLeft',
  KeyD: 'moveRight',
  ArrowRight: 'moveRight',
  Space: 'jump',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
  KeyE: 'interact',
  KeyF: 'interact',
  Escape: 'escape',
};

const defaultTouchZones: TouchZoneConfig = {
  moveZoneWidth: 0.4,
  cameraZoneWidth: 0.6,
  jumpZoneHeight: 0.25,
  deadZoneRadius: 15,
};

export class InputManager {
  private state: InputState = {
    keys: new Set(),
    mouseButtons: new Set(),
    mouseX: 0,
    mouseY: 0,
    mouseDeltaX: 0,
    mouseDeltaY: 0,
    scrollDelta: 0,
    touchDeltaX: 0,
    touchDeltaY: 0,
    touchMoveX: 0,
    touchMoveY: 0,
    touches: [],
    pinchDistance: -1,
    actions: new Set(),
  };

  private prevMouseX = 0;
  private prevMouseY = 0;
  private keyBindings = new Map(Object.entries(defaultBindings));
  private canvas: HTMLCanvasElement | null = null;
  private pointerLocked = false;

  // Touch state
  private activeTouches = new Map<number, TouchPoint>();
  private touchZones: TouchZoneConfig = { ...defaultTouchZones };
  private moveTouchId: number | null = null;
  private cameraTouchId: number | null = null;
  private prevCameraX = 0;
  private prevCameraY = 0;
  private moveOriginX = 0;
  private moveOriginY = 0;

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;

    canvas.addEventListener('keydown', this.onKeyDown);
    canvas.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('mousedown', this.onMouseDown);
    canvas.addEventListener('mouseup', this.onMouseUp);
    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('wheel', this.onWheel, { passive: true });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Touch events
    canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
    canvas.addEventListener('touchend', this.onTouchEnd);
    canvas.addEventListener('touchcancel', this.onTouchEnd);

    // Pointer lock for FPS-style controls (desktop only)
    canvas.addEventListener('click', () => {
      if (!this.pointerLocked) {
        canvas.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas;
    });
  }

  detach(): void {
    if (!this.canvas) return;
    this.canvas.removeEventListener('keydown', this.onKeyDown);
    this.canvas.removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    this.canvas.removeEventListener('mouseup', this.onMouseUp);
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('touchstart', this.onTouchStart);
    this.canvas.removeEventListener('touchmove', this.onTouchMove);
    this.canvas.removeEventListener('touchend', this.onTouchEnd);
    this.canvas.removeEventListener('touchcancel', this.onTouchEnd);
    this.canvas = null;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.state.keys.add(e.code);
    const action = this.keyBindings.get(e.code);
    if (action !== undefined) this.state.actions.add(action);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.state.keys.delete(e.code);
    const action = this.keyBindings.get(e.code);
    if (action !== undefined) this.state.actions.delete(action);
  };

  private onMouseDown = (e: MouseEvent): void => {
    this.state.mouseButtons.add(e.button);
    if (e.button === 0) this.state.actions.add('primaryAction');
    if (e.button === 2) this.state.actions.add('secondaryAction');
  };

  private onMouseUp = (e: MouseEvent): void => {
    this.state.mouseButtons.delete(e.button);
    if (e.button === 0) this.state.actions.delete('primaryAction');
    if (e.button === 2) this.state.actions.delete('secondaryAction');
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (this.pointerLocked) {
      this.state.mouseDeltaX = e.movementX;
      this.state.mouseDeltaY = e.movementY;
    }
    this.state.mouseX = e.clientX;
    this.state.mouseY = e.clientY;
  };

  private onWheel = (e: WheelEvent): void => {
    this.state.scrollDelta = e.deltaY;
  };

  // ── Touch handlers ──────────────────────────────────────────

  configureTouchZones(config: Partial<TouchZoneConfig>): void {
    Object.assign(this.touchZones, config);
  }

  private getCanvasRect(): DOMRect {
    return this.canvas!.getBoundingClientRect();
  }

  private touchToCanvas(touch: Touch): { x: number; y: number } {
    const rect = this.getCanvasRect();
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    };
  }

  private isInMoveZone(x: number): boolean {
    return x < this.touchZones.moveZoneWidth * this.canvas!.width;
  }

  private isInCameraZone(x: number): boolean {
    return x > (1 - (this.touchZones.cameraZoneWidth - 0.4)) * this.canvas!.width;
  }

  private isInJumpZone(x: number, y: number): boolean {
    const w = this.canvas!.width;
    const h = this.canvas!.height;
    return x > w * 0.7 && y > h * (1 - this.touchZones.jumpZoneHeight);
  }

  private onTouchStart = (e: TouchEvent): void => {
    e.preventDefault();
    const rect = this.getCanvasRect();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const { x, y } = this.touchToCanvas(touch);

      const pt: TouchPoint = { id: touch.identifier, x, y, startX: x, startY: y };
      this.activeTouches.set(touch.identifier, pt);

      // Assign to move or camera zone
      if (this.isInMoveZone(x) && this.moveTouchId === null) {
        this.moveTouchId = touch.identifier;
        this.moveOriginX = x;
        this.moveOriginY = y;
        this.state.touchMoveX = 0;
        this.state.touchMoveY = 0;
      } else if (!this.isInMoveZone(x) && this.cameraTouchId === null) {
        this.cameraTouchId = touch.identifier;
        this.prevCameraX = x;
        this.prevCameraY = y;
      }

      // Tap for jump / interact
      if (this.isInJumpZone(x, y)) {
        this.state.actions.add('jump');
      }
    }

    this.syncTouchState();
  };

  private onTouchMove = (e: TouchEvent): void => {
    e.preventDefault();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const { x, y } = this.touchToCanvas(touch);
      const existing = this.activeTouches.get(touch.identifier);
      if (existing) {
        existing.x = x;
        existing.y = y;
      }

      // Update move joystick
      if (touch.identifier === this.moveTouchId) {
        const dx = x - this.moveOriginX;
        const dy = y - this.moveOriginY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const dead = this.touchZones.deadZoneRadius;

        if (dist < dead) {
          this.state.touchMoveX = 0;
          this.state.touchMoveY = 0;
        } else {
          // Normalize: clamp to 1.0 beyond dead zone, scale smoothly
          const clamped = Math.min(dist, 100);
          const norm = (clamped - dead) / (100 - dead);
          const angle = Math.atan2(dy, dx);
          this.state.touchMoveX = Math.cos(angle) * norm;
          this.state.touchMoveY = Math.sin(angle) * norm;
        }

        // Map joystick to movement actions
        if (this.state.touchMoveY < -0.3) this.state.actions.add('moveForward');
        else this.state.actions.delete('moveForward');

        if (this.state.touchMoveY > 0.3) this.state.actions.add('moveBackward');
        else this.state.actions.delete('moveBackward');

        if (this.state.touchMoveX < -0.3) this.state.actions.add('moveLeft');
        else this.state.actions.delete('moveLeft');

        if (this.state.touchMoveX > 0.3) this.state.actions.add('moveRight');
        else this.state.actions.delete('moveRight');
      }

      // Update camera orbit
      if (touch.identifier === this.cameraTouchId) {
        this.state.touchDeltaX = x - this.prevCameraX;
        this.state.touchDeltaY = y - this.prevCameraY;
        this.prevCameraX = x;
        this.prevCameraY = y;
      }
    }

    // Pinch detection
    if (this.activeTouches.size === 2) {
      const pts = Array.from(this.activeTouches.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      this.state.pinchDistance = Math.sqrt(dx * dx + dy * dy);
    } else {
      this.state.pinchDistance = -1;
    }

    this.syncTouchState();
  };

  private onTouchEnd = (e: TouchEvent): void => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      this.activeTouches.delete(touch.identifier);

      if (touch.identifier === this.moveTouchId) {
        this.moveTouchId = null;
        this.state.touchMoveX = 0;
        this.state.touchMoveY = 0;
        this.state.actions.delete('moveForward');
        this.state.actions.delete('moveBackward');
        this.state.actions.delete('moveLeft');
        this.state.actions.delete('moveRight');
      }

      if (touch.identifier === this.cameraTouchId) {
        this.cameraTouchId = null;
      }

      // Release jump on touch end
      this.state.actions.delete('jump');
    }

    this.syncTouchState();
  };

  private syncTouchState(): void {
    this.state.touches = Array.from(this.activeTouches.values());
  }

  // Call at end of frame to reset delta values
  endFrame(): void {
    this.state.mouseDeltaX = 0;
    this.state.mouseDeltaY = 0;
    this.state.scrollDelta = 0;
    this.state.touchDeltaX = 0;
    this.state.touchDeltaY = 0;
  }

  getState(): Readonly<InputState> {
    return this.state;
  }

  isActionPressed(action: InputAction): boolean {
    return this.state.actions.has(action);
  }

  isKeyPressed(code: string): boolean {
    return this.state.keys.has(code);
  }

  bindKey(code: string, action: InputAction): void {
    this.keyBindings.set(code, action);
  }

  unbindKey(code: string): void {
    this.keyBindings.delete(code);
  }
}
