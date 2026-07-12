/// <reference path="./fengari.d.ts" />
/**
 * Lua Runtime — Fengari-based Lua 5.3 execution environment
 *
 * Uses the fengari library for pure-JavaScript Lua interpretation.
 */

// Dynamic import since fengari may not have perfect ESM types
// @ts-ignore
let fengari: any = null;
let fengariLoaded = false;

async function ensureFengari(): Promise<void> {
  if (fengariLoaded) return;
  try {
    fengari = await import('fengari');
    fengariLoaded = true;
  } catch {
    throw new Error(
      'Fengari not installed. Run: npm install fengari fengari-interop'
    );
  }
}

export interface LuaScript {
  id: string;
  source: string;
  compiled: boolean;
}

export interface LuaRuntimeOptions {
  /** Maximum execution time per script tick in ms */
  timeoutMs: number;
  /** Maximum instruction count */
  maxInstructions: number;
  /** Allowed globals to register */
  globals: Record<string, any>;
}

const defaultOptions: LuaRuntimeOptions = {
  timeoutMs: 100,
  maxInstructions: 100000,
  globals: {},
};

export class LuaRuntime {
  private options: LuaRuntimeOptions;
  private globals: Record<string, any>;
  private scripts = new Map<string, LuaScript>();
  private luaState: any = null;

  constructor(options: Partial<LuaRuntimeOptions> = {}) {
    this.options = { ...defaultOptions, ...options };
    this.globals = { ...this.options.globals };
  }

  /**
   * Initialize the Lua state
   */
  async init(): Promise<void> {
    await ensureFengari();
    const { lauxlib, lualib } = fengari;
    this.luaState = lauxlib.luaL_newstate();
    lualib.luaL_openlibs(this.luaState);
    this.registerGlobals();
  }

  get L(): any {
    return this.luaState;
  }

  /**
   * Register all configured globals in the Lua state
   */
  private registerGlobals(): void {
    if (!this.luaState || !this.globals) return;

    for (const [name, api] of Object.entries(this.globals)) {
      this.registerGlobalNative(name, api);
    }
  }

  /**
   * Register a single API object as a Lua global table
   */
  registerGlobal(name: string, api: Record<string, any>): void {
    this.globals[name] = api;
    if (this.luaState) {
      this.registerGlobalNative(name, api);
    }
  }

  private registerGlobalNative(name: string, api: Record<string, any>): void {
    const { lauxlib, lua, to_luastring } = fengari;
    const L = this.luaState;

    // Create a table for the API
    lua.lua_createtable(L, 0, Object.keys(api).length);

    for (const [key, value] of Object.entries(api)) {
      if (typeof value === 'function') {
        // Push the function wrapper (Fengari cb receives L as first arg)
        const wrappedFn = (L_inner: any) => {
          try {
            const top = lua.lua_gettop(L_inner);
            const jsArgs: any[] = [];
            for (let i = 1; i <= top; i++) {
              jsArgs.push(fengari.tojs(L_inner, i));
            }
            const result = (value as Function)(...jsArgs);
            if (result !== undefined) {
              fengari.tolua(L_inner, result);
              return 1;
            }
            return 0;
          } catch (err: any) {
            lua.lua_pushstring(L_inner, to_luastring(err.message || String(err)));
            return lua.lua_error(L_inner);
          }
        };
        lua.lua_pushjsfunction(L, wrappedFn);
        lua.lua_setfield(L, -2, to_luastring(key));
      } else if (typeof value === 'number') {
        lua.lua_pushnumber(L, value);
        lua.lua_setfield(L, -2, to_luastring(key));
      } else if (typeof value === 'string') {
        lua.lua_pushstring(L, to_luastring(value));
        lua.lua_setfield(L, -2, to_luastring(key));
      }
    }

    lua.lua_setglobal(L, to_luastring(name));
  }

  /**
   * Load a Lua script
   */
  loadScript(id: string, source: string): LuaScript {
    const script: LuaScript = { id, source, compiled: false };
    this.scripts.set(id, script);
    return script;
  }

  /**
   * Execute Lua source code.
   * Returns { success, result?, error? }
   */
  execute(source: string): { success: boolean; result?: any; error?: string } {
    if (!this.luaState) {
      return { success: false, error: 'Lua state not initialized. Call init() first.' };
    }

    const { lauxlib, lua, to_luastring, to_jsstring } = fengari;
    const L = this.luaState;

    try {
      // Load the source string (must convert to Lua string format)
      const loadResult = lauxlib.luaL_loadstring(L, to_luastring(source));
      if (loadResult !== 0) {
        // Error on load
        const raw = lua.lua_tostring(L, -1);
        const errMsg = raw ? to_jsstring(raw) : 'Syntax error';
        lua.lua_pop(L, 1);
        return { success: false, error: errMsg || 'Syntax error' };
      }

      // Execute (protected call with 0 args, 1 return)
      const callResult = lua.lua_pcall(L, 0, 1, 0);
      if (callResult !== 0) {
        const raw = lua.lua_tostring(L, -1);
        const errMsg = raw ? to_jsstring(raw) : 'Runtime error';
        lua.lua_pop(L, 1);
        return { success: false, error: errMsg || 'Runtime error' };
      }

      // Get return value
      const result = fengari.tojs(L, -1);
      lua.lua_pop(L, 1);

      return { success: true, result };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  }

  /**
   * Execute a specific script by ID
   */
  executeScript(id: string): { success: boolean; result?: any; error?: string } {
    const script = this.scripts.get(id);
    if (!script) {
      return { success: false, error: `Script not found: ${id}` };
    }
    return this.execute(script.source);
  }

  /**
   * Update script source
   */
  updateScript(id: string, source: string): void {
    const script = this.scripts.get(id);
    if (script) {
      script.source = source;
      script.compiled = false;
    }
  }

  /**
   * Remove a script
   */
  removeScript(id: string): void {
    this.scripts.delete(id);
  }

  /**
   * Destroy the Lua state
   */
  close(): void {
    if (this.luaState) {
      const { lua } = fengari;
      lua.lua_close(this.luaState);
      this.luaState = null;
    }
  }
}

/**
 * Default Lua engine API that scripts can call.
 * Mirrors the engine's LuaAPI interface.
 */
export const DEFAULT_LUA_GLOBALS = {
  math: Math,

  vector3: (x: number, y: number, z: number) => ({ x, y, z }),
  vector2: (x: number, y: number) => ({ x, y }),
  color3: (r: number, g: number, b: number) => ({ r, g, b }),

  time: () => performance.now() / 1000,
  deltaTime: () => 0,

  print: (...args: any[]) => console.log('[Lua]', ...args),
  warn: (...args: any[]) => console.warn('[Lua]', ...args),
  error: (...args: any[]) => console.error('[Lua]', ...args),

  random: (min = 0, max = 1) => Math.random() * (max - min) + min,
  randomInt: (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1)) + min,
};
