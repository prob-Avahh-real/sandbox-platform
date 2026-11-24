import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import module from "node:module";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Compile and evaluate a local TypeScript CommonJS-like module graph using Node 22's
 * built-in `module.stripTypeScriptTypes`, without requiring node_modules installation.
 */
function createTsRequire(baseDir) {
  const cache = new Map();

  function resolveTs(fromDir, spec) {
    const base = path.resolve(fromDir, spec);
    for (const candidate of [base, `${base}.ts`, path.join(base, "index.ts")]) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    }
    throw new Error(`Cannot resolve ${spec} from ${fromDir}`);
  }

  return function tsRequire(spec, fromDir = baseDir) {
    const filename = resolveTs(fromDir, spec);
    if (cache.has(filename)) return cache.get(filename).exports;

    const rawTs = fs.readFileSync(filename, "utf8");
    const stripped = module.stripTypeScriptTypes(rawTs, { mode: "strip" });
    // Convert ESM export/import syntax in pure engine/runtime modules into CJS for isolated testing
    const cjs = stripped
      .replace(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]\s*;?/g, (_, names, mod) => {
        const mapped = names
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => s.replace(/\s+as\s+/, ": "))
          .join(", ");
        return `const { ${mapped} } = __req(${JSON.stringify(mod)});`;
      })
      .replace(/export\s+class\s+(\w+)/g, "class $1")
      .replace(/export\s+function\s+(\w+)/g, "function $1")
      .replace(/export\s+const\s+(\w+)/g, "const $1");

    const exportedNames = [
      ...stripped.matchAll(/export\s+(?:class|function|const)\s+(\w+)/g),
    ].map((m) => m[1]);

    const modRecord = { exports: {} };
    cache.set(filename, modRecord);

    const fn = new vm.Script(
      `(function(exports, __req) {\n${cjs}\n${exportedNames
        .map((n) => `exports.${n} = ${n};`)
        .join("\n")}\n})`,
      { filename }
    ).runInThisContext();

    fn(modRecord.exports, (childSpec) => tsRequire(childSpec, path.dirname(filename)));
    return modRecord.exports;
  };
}

test("ECS World, Entity, Signature, and System priority & recursive destruction invariants", () => {
  const req = createTsRequire(path.join(ROOT, "packages/engine/src/ecs"));
  const { registerComponent, Signature } = req("./Component.ts");
  const { World } = req("./World.ts");
  const { System } = req("./System.ts");

  const transformId = registerComponent("Transform");
  const rigidBodyId = registerComponent("RigidBody");
  assert.equal(registerComponent("Transform"), transformId, "component registration must be idempotent");
  assert.notEqual(transformId, rigidBodyId);

  const world = new World();
  const parentId = world.createEntity("Parent");
  const childId = world.createEntity("Child");
  const parent = world.getEntity(parentId);
  const child = world.getEntity(childId);

  parent.addChild(childId);
  child.parent = parentId;
  parent.addComponent({ type: "Transform", entityId: parentId, position: [1, 2, 3] });
  parent.addComponent({ type: "RigidBody", entityId: parentId, mass: 5 });
  child.addComponent({ type: "Transform", entityId: childId, position: [0, 1, 0] });

  const physicsSig = new Signature();
  physicsSig.set(transformId);
  physicsSig.set(rigidBodyId);

  const matched = world.query(physicsSig);
  assert.equal(matched.length, 1);
  assert.equal(matched[0].id, parentId);

  const order = [];
  class LowPrioritySystem extends System {
    requiredSignature = physicsSig;
    priority = 1;
    update(dt) {
      order.push(`low:${dt}`);
    }
  }
  class HighPrioritySystem extends System {
    requiredSignature = physicsSig;
    priority = 10;
    update(dt) {
      order.push(`high:${dt}`);
    }
  }

  world.addSystem(new LowPrioritySystem(world));
  world.addSystem(new HighPrioritySystem(world));
  world.update(0.016);
  assert.deepEqual(order, ["high:0.016", "low:0.016"]);

  // Destroying parent flushes both parent and child across update ticks
  world.destroyEntity(parentId);
  world.update(0.016);
  assert.equal(world.getEntity(parentId), undefined);
  world.update(0.016);
  assert.equal(world.getEntity(childId), undefined);
});

test("LuaRuntime script registry, uninitialized execution guard, and DEFAULT_LUA_GLOBALS math helpers", () => {
  const req = createTsRequire(path.join(ROOT, "packages/lua-runtime/src"));
  const { LuaRuntime, DEFAULT_LUA_GLOBALS } = req("./index.ts");

  const rt = new LuaRuntime({ timeoutMs: 50 });
  const uninit = rt.execute("return 1 + 1");
  assert.equal(uninit.success, false);
  assert.match(uninit.error, /not initialized/i);

  const missing = rt.executeScript("unknown");
  assert.equal(missing.success, false);
  assert.match(missing.error, /Script not found: unknown/);

  const loaded = rt.loadScript("spin", "return 42");
  assert.equal(loaded.id, "spin");
  rt.updateScript("spin", "return 99");
  assert.equal(rt.executeScript("spin").success, false); // still guarded cleanly before Fengari init
  rt.removeScript("spin");
  assert.match(rt.executeScript("spin").error, /Script not found/);

  assert.deepEqual(DEFAULT_LUA_GLOBALS.vector3(1, 2, 3), { x: 1, y: 2, z: 3 });
  assert.deepEqual(DEFAULT_LUA_GLOBALS.color3(0.2, 0.4, 0.8), { r: 0.2, g: 0.4, b: 0.8 });
  for (let i = 0; i < 20; i++) {
    const n = DEFAULT_LUA_GLOBALS.randomInt(3, 7);
    assert.ok(Number.isInteger(n) && n >= 3 && n <= 7);
  }
});

test("workspace packages and persisted server game schema stay consistent", () => {
  const rootPkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.deepEqual(rootPkg.workspaces, ["packages/*"]);

  for (const pkgDir of ["engine", "lua-runtime", "server", "client", "studio"]) {
    const pkgJson = JSON.parse(
      fs.readFileSync(path.join(ROOT, "packages", pkgDir, "package.json"), "utf8")
    );
    assert.ok(pkgJson.name.startsWith("@sandbox/"), `unexpected package name ${pkgJson.name}`);
  }

  const gamesEntries = JSON.parse(
    fs.readFileSync(path.join(ROOT, "packages/server/data/games.json"), "utf8")
  );
  assert.ok(Array.isArray(gamesEntries) && gamesEntries.length >= 1);
  const [gameId, gameData] = gamesEntries[0];
  assert.equal(gameId, gameData.meta.id);
  assert.equal(typeof gameData.luaScript, "string");
  assert.ok(Array.isArray(gameData.entities) && gameData.entities.length >= 1);
  assert.ok(gameData.entities[0].components.some((c) => c.type === "Transform"));
});
