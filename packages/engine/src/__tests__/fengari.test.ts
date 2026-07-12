// Test 3: Fengari Lua execution

let passed = 0, failed = 0;
const assert = (c: boolean, m: string) => { c ? (passed++, console.log('  ✓ ' + m)) : (failed++, console.error('  ✗ ' + m)); };

async function test() {
  // Dynamic import of fengari
  const fengari = await import('fengari');
  const { lauxlib, lualib, lua, to_luastring } = fengari;

  // Create Lua state
  const L = lauxlib.luaL_newstate();
  assert(!!L, 'luaL_newstate() creates state');

  // Open standard libs
  lualib.luaL_openlibs(L);
  assert(true, 'luaL_openlibs() succeeds');

  // Test 1: Simple calculation
  let result = lauxlib.luaL_loadstring(L, to_luastring('return 1 + 2'));
  assert(result === 0, 'luaL_loadstring succeeds');

  result = lua.lua_pcall(L, 0, 1, 0);
  assert(result === 0, 'lua_pcall succeeds');

  const val = lua.lua_tonumber(L, -1);
  assert(val === 3, `1+2 = ${val}`);
  lua.lua_pop(L, 1);

  // Test 2: String concatenation
  lauxlib.luaL_loadstring(L, to_luastring('return "Hello " .. "Lua"'));
  lua.lua_pcall(L, 0, 1, 0);
  const raw = lua.lua_tostring(L, -1);
  const str = fengari.to_jsstring(raw);
  assert(str === 'Hello Lua', `string concat: "${str}"`);
  lua.lua_pop(L, 1);

  // Test 3: Table operations
  lauxlib.luaL_loadstring(L, to_luastring(`
    local t = {a = 1, b = 2}
    return t.a + t.b
  `));
  lua.lua_pcall(L, 0, 1, 0);
  assert(lua.lua_tonumber(L, -1) === 3, 'table ops: 1+2=3');
  lua.lua_pop(L, 1);

  // Test 4: Function definition + call
  lauxlib.luaL_loadstring(L, to_luastring(`
    local function fib(n)
      if n < 2 then return n end
      return fib(n-1) + fib(n-2)
    end
    return fib(10)
  `));
  lua.lua_pcall(L, 0, 1, 0);
  assert(lua.lua_tonumber(L, -1) === 55, `fib(10) = 55`);
  lua.lua_pop(L, 1);

  // Test 5: Error handling
  const loadErr = lauxlib.luaL_loadstring(L, to_luastring('return 1 +'));
  assert(loadErr !== 0, 'syntax error detected');

  // Test 6: Register JS function (Fengari cb receives L as arg, returns ret count)
  lua.lua_pushjsfunction(L, (L_inner: any) => {
    lua.lua_pushnumber(L_inner, 42);
    return 1;
  });
  lua.lua_setglobal(L, to_luastring('getAnswer'));
  lauxlib.luaL_loadstring(L, to_luastring('return getAnswer()'));
  lua.lua_pcall(L, 0, 1, 0);
  assert(lua.lua_tonumber(L, -1) === 42, 'JS function registered and called');
  lua.lua_pop(L, 1);

  lua.lua_close(L);
  console.log(`\n  Fengari: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

test().catch(e => { console.error('FENGARI FAIL:', e.message); process.exit(1); });
