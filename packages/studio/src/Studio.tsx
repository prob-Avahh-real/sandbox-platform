import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Game, World, EntityId, createTransform, createMeshRenderer, createRigidBody } from '@sandbox/engine';
import { getStoredUser, logout as authLogout } from './auth';
import StudioLogin from './StudioLogin';
import PublishDialog from './PublishDialog';

// Simple Monaco-like code editor component (uses a textarea as fallback,
// full Monaco can be added via @monaco-editor/react)
function CodeEditor({
  value,
  onChange,
  language = 'lua',
}: {
  value: string;
  onChange: (v: string) => void;
  language?: string;
}) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        background: '#313244',
        padding: '4px 12px',
        fontSize: '11px',
        color: '#a6adc8',
        borderBottom: '1px solid #45475a',
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span>Script.lua</span>
        <span>{language.toUpperCase()}</span>
      </div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        spellCheck={false}
        style={{
          flex: 1,
          background: '#1e1e2e',
          color: '#cdd6f4',
          border: 'none',
          padding: '12px',
          fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace",
          fontSize: '13px',
          lineHeight: '1.6',
          resize: 'none',
          outline: 'none',
          tabSize: 2,
        }}
        placeholder="-- Write your Lua script here..."
      />
    </div>
  );
}

// Scene hierarchy panel
function SceneHierarchy({
  world,
  selectedId,
  onSelect,
}: {
  world: World;
  selectedId: EntityId | null;
  onSelect: (id: EntityId) => void;
}) {
  const [entities, setEntities] = useState<{ id: EntityId; name: string }[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      const list: { id: EntityId; name: string }[] = [];
      for (const [id, entity] of world.getEntities()) {
        list.push({ id, name: entity.name });
      }
      setEntities(list);
    }, 500);
    return () => clearInterval(interval);
  }, [world]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        padding: '8px 12px',
        fontSize: '11px',
        fontWeight: 'bold',
        color: '#a6adc8',
        borderBottom: '1px solid #45475a',
        textTransform: 'uppercase',
        letterSpacing: '1px',
      }}>
        Explorer
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {entities.map(e => (
          <div
            key={e.id}
            onClick={() => onSelect(e.id)}
            style={{
              padding: '4px 12px',
              cursor: 'pointer',
              fontSize: '13px',
              background: selectedId === e.id ? '#45475a' : 'transparent',
              color: selectedId === e.id ? '#cdd6f4' : '#a6adc8',
              borderLeft: selectedId === e.id ? '2px solid #89b4fa' : '2px solid transparent',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => {
              if (String(selectedId) !== e.currentTarget.dataset.id) {
                (e.currentTarget as HTMLElement).style.background = '#313244';
              }
            }}
            onMouseLeave={e => {
              if (String(selectedId) !== (e.currentTarget as HTMLElement).dataset.id) {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }
            }}
          >
            📦 {e.name}
          </div>
        ))}
      </div>
    </div>
  );
}

// Property inspector panel
function PropertyInspector({
  world,
  selectedId,
}: {
  world: World;
  selectedId: EntityId | null;
}) {
  if (!selectedId) {
    return (
      <div style={{ padding: '16px', color: '#6c7086', fontSize: '13px', fontStyle: 'italic' }}>
        Select an entity to inspect
      </div>
    );
  }

  const entity = world.getEntity(selectedId);
  if (!entity) return null;

  const components = entity.getAllComponents();

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        padding: '8px 12px',
        fontSize: '11px',
        fontWeight: 'bold',
        color: '#a6adc8',
        borderBottom: '1px solid #45475a',
        textTransform: 'uppercase',
        letterSpacing: '1px',
      }}>
        Properties
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', color: '#6c7086', marginBottom: '4px' }}>Entity</div>
          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{entity.name}</div>
          <div style={{ fontSize: '11px', color: '#6c7086' }}>ID: {entity.id}</div>
        </div>

        {Array.from(components.entries()).map(([type, comp]) => (
          <div key={type} style={{
            marginBottom: '8px',
            background: '#313244',
            borderRadius: '4px',
            padding: '8px',
          }}>
            <div style={{
              fontSize: '11px',
              fontWeight: 'bold',
              color: '#89b4fa',
              marginBottom: '6px',
              textTransform: 'uppercase',
            }}>
              {type}
            </div>
            <div style={{ fontSize: '12px', fontFamily: 'monospace' }}>
              {Object.entries(comp).map(([key, value]) => {
                if (key === 'type' || key === 'entityId') return null;
                let displayValue = String(value);
                if (typeof value === 'object' && value !== null) {
                  displayValue = JSON.stringify(value, null, 0).slice(0, 60);
                }
                return (
                  <div key={key} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '2px 0',
                    color: '#a6adc8',
                  }}>
                    <span style={{ color: '#6c7086' }}>{key}</span>
                    <span style={{ color: '#a6e3a1', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {displayValue}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Main Studio component
export default function Studio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [selectedId, setSelectedId] = useState<EntityId | null>(null);
  const [authUser, setAuthUser] = useState<{ username: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showPublish, setShowPublish] = useState(false);
  const [publishedGameId, setPublishedGameId] = useState<string | undefined>();
  const [luaCode, setLuaCode] = useState(`-- Welcome to Sandbox Studio!
-- This is a Lua scripting environment.

-- Create a colorful platform
local part = sandbox.createPart("MyPart")
sandbox.setPosition(part, 0, 5, 0)
sandbox.setColor(part, "#e74c3c")
sandbox.setSize(part, 4, 1, 4)

-- Apply an impulse
sandbox.applyForce(part, 0, 10, 0)

print("Hello from Lua! Created part " .. part)
`);
  const [output, setOutput] = useState<string[]>([]);

  // Check auth on mount
  useEffect(() => {
    getStoredUser().then(user => {
      if (user) setAuthUser({ username: user.username });
      setAuthLoading(false);
    });
  }, []);

  // Initialize game engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const game = new Game({
      canvas,
      enablePhysics: true,
      enableEditor: true,
    });

    gameRef.current = game;
    game.start();

    // Wait for physics WASM before creating entities
    game.ready.then(() => {
      game.createGround(30);
      game.createDefaultPlayer();
      game.createDemoScene();
    });

    return () => {
      game.dispose();
    };
  }, []);

  // Run Lua script
  const runScript = useCallback(async () => {
    const game = gameRef.current;
    if (!game) return;

    setOutput(prev => [...prev.slice(-100), '> Running script...']);

    try {
      const lr = game.luaRuntime;

      // Ensure Lua state is initialized
      try { await lr.init(); } catch { /* already inited */ }

      const result = lr.execute(luaCode);

      if (result.success) {
        setOutput(prev => [
          ...prev.slice(-100),
          result.result !== undefined ? `  ⇒ ${JSON.stringify(result.result)}` : '  (no return value)',
          '✓ Script completed',
        ]);
      } else {
        setOutput(prev => [...prev.slice(-100), `✗ ${result.error}`]);
      }
    } catch (err: any) {
      // Fallback: direct JS execution
      try {
        const scriptOutput: string[] = [];
        const fn = new Function('sandbox', 'print', luaCode);
        fn(game.lua, (...args: any[]) => {
          scriptOutput.push(args.map(String).join(' '));
        });
        setOutput(prev => [...prev.slice(-100), ...scriptOutput.map(s => `  ${s}`), '✓ Script completed (JS fallback)']);
      } catch (err2: any) {
        setOutput(prev => [...prev.slice(-100), `✗ Error: ${err2.message}`]);
      }
    }
  }, [luaCode]);

  // Toolbar actions
  const addPart = useCallback(() => {
    const game = gameRef.current;
    if (!game) return;
    const id = game.lua.createPart('NewPart');
    game.lua.setPosition(id, Math.random() * 6 - 3, 5, Math.random() * 6 - 3);
    setSelectedId(id);
  }, []);

  const addSphere = useCallback(() => {
    const game = gameRef.current;
    if (!game) return;
    const id = game.world.createEntity('Sphere');
    const entity = game.world.getEntity(id)!;
    entity.addComponent(createTransform([0, 8, 0]));
    entity.addComponent(createMeshRenderer('sphere', '#f1c40f'));
    entity.addComponent(createRigidBody('dynamic', 1));
    setSelectedId(id);
  }, []);

  const handleLogout = useCallback(() => {
    authLogout();
    setAuthUser(null);
  }, []);

  // Auth loading
  if (authLoading) {
    return (
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#1e1e2e', color: '#6c7086', fontSize: '14px',
      }}>
        Loading...
      </div>
    );
  }

  // Auth gate
  if (!authUser) {
    return <StudioLogin onLogin={(username) => setAuthUser({ username })} />;
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div style={{
        height: '40px',
        background: '#313244',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: '8px',
        borderBottom: '1px solid #45475a',
      }}>
        <span style={{ fontWeight: 'bold', color: '#89b4fa', fontSize: '14px', marginRight: '16px' }}>
          🎮 Sandbox Studio
        </span>
        <ToolbarButton onClick={addPart} label="📦 Add Part" />
        <ToolbarButton onClick={addSphere} label="🔵 Add Sphere" />
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '12px', color: '#a6e3a1', marginRight: '12px' }}>
          👤 {authUser?.username}
        </span>
        <ToolbarButton onClick={handleLogout} label="Logout" />
        <div style={{ width: '4px' }} />
        <ToolbarButton onClick={() => setShowPublish(true)} label="🚀 Publish" />
        <div style={{ width: '4px' }} />
        <ToolbarButton onClick={runScript} label="▶ Run Script" primary />
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left panel - Explorer */}
        <div style={{
          width: '220px',
          background: '#1e1e2e',
          borderRight: '1px solid #45475a',
          overflow: 'hidden',
        }}>
          {gameRef.current && (
            <SceneHierarchy
              world={gameRef.current.world}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
        </div>

        {/* Center - Viewport + Output */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* 3D Viewport */}
          <div style={{ flex: 1, position: 'relative', background: '#11111b' }}>
            <canvas
              ref={canvasRef}
              style={{ width: '100%', height: '100%', display: 'block' }}
            />
            <div style={{
              position: 'absolute',
              top: '8px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.6)',
              borderRadius: '4px',
              padding: '4px 12px',
              fontSize: '11px',
              color: '#a6adc8',
              pointerEvents: 'none',
            }}>
              Game View · Click to focus
            </div>
          </div>

          {/* Output console */}
          <div style={{
            height: '120px',
            background: '#11111b',
            borderTop: '1px solid #45475a',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{
              padding: '4px 12px',
              fontSize: '11px',
              color: '#a6adc8',
              borderBottom: '1px solid #313244',
              background: '#1e1e2e',
            }}>
              Output
            </div>
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '4px 12px',
              fontFamily: 'monospace',
              fontSize: '12px',
            }}>
              {output.map((line, i) => (
                <div key={i} style={{
                  color: line.startsWith('✗') ? '#f38ba8' :
                         line.startsWith('✓') ? '#a6e3a1' :
                         line.startsWith('>') ? '#89b4fa' : '#a6adc8',
                  padding: '1px 0',
                }}>
                  {line}
                </div>
              ))}
              {output.length === 0 && (
                <div style={{ color: '#6c7086', fontStyle: 'italic' }}>
                  Script output will appear here...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right panel - Inspector */}
        <div style={{
          width: '260px',
          background: '#1e1e2e',
          borderLeft: '1px solid #45475a',
          overflow: 'hidden',
        }}>
          {gameRef.current && (
            <PropertyInspector
              world={gameRef.current.world}
              selectedId={selectedId}
            />
          )}
        </div>
      </div>

      {/* Bottom panel - Script Editor */}
      <div style={{
        height: '220px',
        borderTop: '1px solid #45475a',
        background: '#1e1e2e',
      }}>
        <CodeEditor value={luaCode} onChange={setLuaCode} language="lua" />
      </div>

      {/* Publish dialog */}
      {showPublish && gameRef.current && (
        <PublishDialog
          game={gameRef.current}
          luaScript={luaCode}
          existingGameId={publishedGameId}
          onClose={() => setShowPublish(false)}
          onPublished={(id) => setPublishedGameId(id)}
        />
      )}
    </div>
  );
}

function ToolbarButton({
  onClick,
  label,
  primary,
}: {
  onClick: () => void;
  label: string;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: primary ? '#89b4fa' : '#45475a',
        color: primary ? '#1e1e2e' : '#cdd6f4',
        border: 'none',
        borderRadius: '4px',
        padding: '4px 10px',
        fontSize: '12px',
        cursor: 'pointer',
        fontWeight: primary ? 'bold' : 'normal',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => {
        if (!primary) (e.currentTarget as HTMLElement).style.background = '#585b70';
      }}
      onMouseLeave={e => {
        if (!primary) (e.currentTarget as HTMLElement).style.background = '#45475a';
      }}
    >
      {label}
    </button>
  );
}
