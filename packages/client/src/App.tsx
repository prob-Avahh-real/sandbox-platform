import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Game } from '@sandbox/engine';
import { useAuth } from './AuthContext';
import LoginModal from './LoginModal';
import GameLobby from './GameLobby';
import TouchControls from './TouchControls';

const API_BASE = `http://${window.location.hostname}:3002`;
const WS_BASE = `ws://${window.location.hostname}:3002/ws`;

export default function App() {
  const { user, token, loading, logout } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [players, setPlayers] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<{ username: string; message: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [playAsGuest, setPlayAsGuest] = useState(false);
  const [currentGame, setCurrentGame] = useState<{ id: string; name: string } | null>(null);
  const playerIdRef = useRef<string>('');
  const positionRef = useRef({ x: 0, y: 3, z: 0 });
  const usernameRef = useRef<string>('');

  // Initialize game engine (once)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const game = new Game({ canvas });
    gameRef.current = game;
    game.start();

    return () => {
      game.dispose();
    };
  }, []);

  // Load game data when entering a specific game
  useEffect(() => {
    if (!currentGame || !gameRef.current) return;

    const game = gameRef.current;
    const gameId = currentGame.id;

    // Fetch game data from server
    fetch(`${API_BASE}/api/games/${gameId}`)
      .then(res => res.json())
      .then(async (data) => {
        if (!data.entities) {
          // Fallback: no saved data, create demo
          await game.ready;
          game.createGround(30);
          game.createDemoScene();
          game.createDefaultPlayer();
          return;
        }

        await game.ready;
        game.loadFromData(data);
      })
      .catch(async () => {
        // Server error — fallback to demo
        await game.ready;
        game.createGround(30);
        game.createDemoScene();
        game.createDefaultPlayer();
      });
  }, [currentGame]);

  // Connect WebSocket when entering a game
  useEffect(() => {
    if (loading) return;
    if (!currentGame) return;
    if (!user && !playAsGuest) return;

    let wsUrl = WS_BASE;
    if (token) {
      wsUrl += `?token=${encodeURIComponent(token)}`;
    }

    const displayName = user?.username || `Guest_${Math.random().toString(36).slice(2, 6)}`;
    usernameRef.current = displayName;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({
        type: 'joinGame',
        gameId: currentGame.id,
        username: displayName,
      }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      handleServerMessage(msg);
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    // Record play
    fetch(`${API_BASE}/api/games/${currentGame.id}/play`, { method: 'POST' }).catch(() => {});

    return () => {
      ws.close();
    };
  }, [user, token, loading, playAsGuest, currentGame]);

  // Handle play game from lobby
  const handlePlayGame = useCallback((gameId: string, gameName: string) => {
    if (!user && !playAsGuest) {
      setPlayAsGuest(true);
    }
    setCurrentGame({ id: gameId, name: gameName });
  }, [user, playAsGuest]);

  // Back to lobby
  const handleBackToLobby = useCallback(() => {
    if (wsRef.current) wsRef.current.close();
    setCurrentGame(null);
    setPlayers([]);
    setChatMessages([]);
    setConnected(false);
  }, []);

  const handleServerMessage = useCallback((msg: any) => {
    switch (msg.type) {
      case 'joined':
        playerIdRef.current = msg.playerId;
        setPlayers(msg.players || []);
        break;
      case 'authenticated':
        console.log('Authenticated as', msg.username);
        break;
      case 'playerJoined':
        setPlayers(prev => [...prev.filter(p => p.id !== msg.playerId), {
          id: msg.playerId,
          username: msg.username,
          position: msg.position,
        }]);
        break;
      case 'playerLeft':
        setPlayers(prev => prev.filter(p => p.id !== msg.playerId));
        break;
      case 'playerUpdate':
        setPlayers(prev => prev.map(p =>
          p.id === msg.playerId ? { ...p, position: msg.position } : p
        ));
        break;
      case 'chatMessage':
        setChatMessages(prev => [...prev.slice(-50), {
          username: msg.username,
          message: msg.message,
        }]);
        break;
    }
  }, []);

  // Handle chat send
  const sendChat = useCallback(() => {
    if (!chatInput.trim() || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({
      type: 'chatMessage',
      gameId: currentGame?.id || 'unknown',
      username: usernameRef.current,
      chatMessage: chatInput.trim(),
    }));
    setChatInput('');
  }, [chatInput]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !showChat) {
        e.preventDefault();
        setShowChat(true);
      }
      if (e.key === 'Escape' && showChat) {
        setShowChat(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showChat]);

  // Loading state
  if (loading) {
    return (
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#1a1a2e', color: '#a6adc8', fontSize: '16px',
      }}>
        <span style={{ animation: 'pulse 1.5s infinite' }}>Loading...</span>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
      </div>
    );
  }

  // Show login prompt if not authenticated and not guest
  const needsAuth = !user && !playAsGuest;
  const inGame = !!currentGame;

  // Lobby view
  if (!inGame) {
    return (
      <>
        <GameLobby onPlayGame={handlePlayGame} />
        {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      </>
    );
  }

  // Game view
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Game canvas */}
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />

      {/* Touch controls overlay (mobile only, pointer-events: none) */}
      {gameRef.current && (
        <TouchControls input={gameRef.current.input} />
      )}

      {/* HUD overlay */}
      {(
        <>
          {/* Top bar */}
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            padding: '16px',
            pointerEvents: 'none',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={handleBackToLobby}
                style={{
                  background: 'rgba(0,0,0,0.6)',
                  border: '1px solid #45475a',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  color: '#a6adc8',
                  fontSize: '12px',
                  cursor: 'pointer',
                  pointerEvents: 'auto',
                }}
              >
                ← Lobby
              </button>
              <div style={{
                display: 'inline-block',
                background: 'rgba(0,0,0,0.6)',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '14px',
              }}>
                <span style={{ color: connected ? '#2ecc71' : '#e74c3c' }}>●</span>
                {' '}{currentGame?.name || 'Game'}
                {' · '}{players.length + 1} online
              </div>
            </div>

            {/* User info + logout */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              pointerEvents: 'auto',
            }}>
              <div style={{
                background: 'rgba(0,0,0,0.6)',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '13px',
                color: '#cdd6f4',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <span style={{
                  width: '8px', height: '8px',
                  borderRadius: '50%',
                  background: user ? '#a6e3a1' : '#f9c74f',
                  display: 'inline-block',
                }}/>
                {usernameRef.current}
                {user && (
                  <span style={{ color: '#6c7086', fontSize: '11px' }}>
                    Lv.{user.gamesCreated + 1}
                  </span>
                )}
              </div>
              {user && (
                <button
                  onClick={logout}
                  style={{
                    background: 'rgba(0,0,0,0.6)',
                    border: '1px solid #45475a',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    color: '#a6adc8',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Logout
                </button>
              )}
            </div>
          </div>

          {/* Player list */}
          <div style={{
            position: 'absolute',
            top: '60px',
            right: '16px',
            background: 'rgba(0,0,0,0.6)',
            borderRadius: '8px',
            padding: '12px',
            fontSize: '13px',
            minWidth: '150px',
            pointerEvents: 'auto',
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#aaa' }}>PLAYERS</div>
            {players.map(p => (
              <div key={p.id} style={{ padding: '2px 0', color: '#ccc' }}>
                {p.username}
              </div>
            ))}
            {players.length === 0 && (
              <div style={{ color: '#666', fontStyle: 'italic' }}>No other players</div>
            )}
          </div>

          {/* Chat */}
          {showChat && (
            <div style={{
              position: 'absolute',
              bottom: '80px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '500px',
              maxWidth: '90vw',
              maxHeight: '300px',
              background: 'rgba(0,0,0,0.8)',
              borderRadius: '8px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              pointerEvents: 'auto',
            }}>
              <div style={{
                flex: 1,
                overflowY: 'auto',
                marginBottom: '8px',
                fontSize: '13px',
                maxHeight: '200px',
              }}>
                {chatMessages.map((m, i) => (
                  <div key={i} style={{ padding: '2px 0' }}>
                    <span style={{ color: '#f1c40f' }}>{m.username}: </span>
                    <span style={{ color: '#ddd' }}>{m.message}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  autoFocus
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendChat()}
                  placeholder="Type a message... (Esc to close)"
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '4px',
                    padding: '6px 10px',
                    color: '#fff',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={sendChat}
                  style={{
                    background: '#3498db',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '6px 16px',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  Send
                </button>
              </div>
            </div>
          )}

          {/* Controls hint */}
          <div style={{
            position: 'absolute',
            bottom: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.6)',
            borderRadius: '8px',
            padding: '8px 16px',
            fontSize: '12px',
            color: '#888',
            pointerEvents: 'none',
          }}>
            WASD Move · Space Jump · Mouse Look · / Chat · Esc Menu
            {' | '}
            📱 Left-drag Move · Right-drag Look · Bottom-right Jump
          </div>
        </>
      )}
    </div>
  );
}
