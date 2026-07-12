import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { createAuthRouter, verifyToken, AuthPayload, requireAuth } from './auth';
import * as gameStore from './games';

// Game server state
interface Player {
  id: string;
  userId?: string;
  username: string;
  ws: WebSocket;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
}

interface GameInstance {
  id: string;
  name: string;
  creatorId?: string;
  players: Map<string, Player>;
  maxPlayers: number;
}

// Running game instances
const games = new Map<string, GameInstance>();

// Create Express app
const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '10mb' }));

// Mount auth routes
app.use('/api/auth', createAuthRouter());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ============ Game Lobby API ============

// List published games (lobby)
app.get('/api/games', (req, res) => {
  const { search, tags, sort, creatorId, limit, offset } = req.query;
  const result = gameStore.listGames({
    search: search as string,
    tags: tags ? (tags as string).split(',') : undefined,
    sort: (sort as any) || 'popular',
    creatorId: creatorId as string,
    limit: limit ? parseInt(limit as string) : 20,
    offset: offset ? parseInt(offset as string) : 0,
  });
  res.json(result);
});

// Get tags
app.get('/api/tags', (_req, res) => {
  res.json(gameStore.getAllTags());
});

// Get game detail with full data
app.get('/api/games/:id', (req, res) => {
  const data = gameStore.getGame(req.params.id);
  if (!data) return res.status(404).json({ error: 'Game not found' });

  const live = games.get(req.params.id);
  const playerCount = live?.players.size ?? 0;

  res.json({
    ...data,
    meta: { ...data.meta, playerCount },
  });
});

// Create/publish a game (auth required)
app.post('/api/games', requireAuth, (req, res) => {
  const user = (req as any).user as AuthPayload;
  const { name, description, luaScript, entities, tags, maxPlayers } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Game name is required' });
  }

  const game = gameStore.createGame(
    name,
    description || '',
    user.userId,
    user.username,
    luaScript || '',
    entities || [],
    tags || [],
    maxPlayers || 16
  );

  res.status(201).json(game);
});

// Update a game (auth required, creator only)
app.put('/api/games/:id', requireAuth, (req, res) => {
  const user = (req as any).user as AuthPayload;
  const existing = gameStore.getGame(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Game not found' });
  if (existing.meta.creatorId !== user.userId) {
    return res.status(403).json({ error: 'You can only edit your own games' });
  }

  const { name, description, luaScript, entities, tags, thumbnail, maxPlayers } = req.body;
  const updated = gameStore.updateGame(req.params.id, {
    name, description, luaScript, entities, tags, thumbnail, maxPlayers,
  });

  res.json(updated);
});

// Delete a game (auth required, creator only)
app.delete('/api/games/:id', requireAuth, (req, res) => {
  const user = (req as any).user as AuthPayload;
  const existing = gameStore.getGame(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Game not found' });
  if (existing.meta.creatorId !== user.userId) {
    return res.status(403).json({ error: 'You can only delete your own games' });
  }

  gameStore.deleteGame(req.params.id);
  res.json({ success: true });
});

// Like a game
app.post('/api/games/:id/like', (req, res) => {
  const result = gameStore.toggleLike(req.params.id);
  res.json(result);
});

// Record play
app.post('/api/games/:id/play', (req, res) => {
  gameStore.incrementPlayCount(req.params.id);
  res.json({ success: true });
});

// Create HTTP server
const server = createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws: WebSocket, req) => {
  const playerId = uuidv4();
  let currentGameId: string | null = null;
  let username = `Player_${playerId.slice(0, 4)}`;
  let userId: string | undefined;

  // Check for token in query string
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const tokenParam = url.searchParams.get('token');
  if (tokenParam) {
    const payload = verifyToken(tokenParam);
    if (payload) {
      userId = payload.userId;
      username = payload.username;
      console.log(`Authenticated player: ${username} (${userId})`);
    }
  }

  console.log(`Player connected: ${playerId} (${username})`);

  ws.on('message', (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      handleMessage(ws, playerId, message, (gameId, name) => {
        currentGameId = gameId;
        if (name) username = name;
      }, userId);
    } catch (err) {
      console.error('Invalid message:', err);
    }
  });

  ws.on('close', () => {
    console.log(`Player disconnected: ${playerId}`);
    if (currentGameId) {
      const game = games.get(currentGameId);
      if (game) {
        game.players.delete(playerId);
        broadcastToGame(currentGameId, {
          type: 'playerLeft',
          playerId,
        }, ws);
      }
    }
  });
});

interface GameMessage {
  type: string;
  gameId?: string;
  token?: string;
  username?: string;
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  chatMessage?: string;
}

function handleMessage(
  ws: WebSocket,
  playerId: string,
  msg: GameMessage,
  setContext: (gameId: string, username: string) => void,
  currentUserId?: string
): void {
  switch (msg.type) {
    // Authentication via message (alternative to query param)
    case 'auth': {
      if (msg.token) {
        const payload = verifyToken(msg.token);
        if (payload) {
          currentUserId = payload.userId;
          ws.send(JSON.stringify({
            type: 'authenticated',
            userId: payload.userId,
            username: payload.username,
          }));
        } else {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid token' }));
        }
      }
      break;
    }

    case 'joinGame': {
      const gameId = msg.gameId;
      if (!gameId) return;

      let game = games.get(gameId);
      if (!game) {
        // Auto-create game if it doesn't exist
        game = {
          id: gameId,
          name: gameId,
          players: new Map(),
          maxPlayers: 16,
        };
        games.set(gameId, game);
      }

      if (game.players.size >= game.maxPlayers) {
        ws.send(JSON.stringify({ type: 'error', message: 'Game is full' }));
        return;
      }

      const username = msg.username || `Player_${playerId.slice(0, 4)}`;

      const player: Player = {
        id: playerId,
        userId: currentUserId,
        username,
        ws,
        position: { x: 0, y: 3, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
      };

      game.players.set(playerId, player);
      setContext(gameId, username);

      // Send join confirmation
      ws.send(JSON.stringify({
        type: 'joined',
        gameId,
        playerId,
        username,
        players: Array.from(game.players.values()).map(p => ({
          id: p.id,
          username: p.username,
          position: p.position,
        })),
      }));

      // Broadcast to others
      broadcastToGame(gameId, {
        type: 'playerJoined',
        playerId,
        username,
        position: player.position,
      }, ws);
      break;
    }

    case 'playerUpdate': {
      if (!msg.gameId) return;
      const game = games.get(msg.gameId);
      if (!game) return;

      const player = game.players.get(playerId);
      if (!player) return;

      if (msg.position) {
        player.position = msg.position;
      }
      if (msg.rotation) {
        player.rotation = msg.rotation;
      }

      // Broadcast to other players
      broadcastToGame(msg.gameId, {
        type: 'playerUpdate',
        playerId,
        position: player.position,
        rotation: player.rotation,
      }, ws);
      break;
    }

    case 'chatMessage': {
      if (!msg.gameId || !msg.chatMessage) return;
      broadcastToGame(msg.gameId, {
        type: 'chatMessage',
        playerId,
        username: msg.username || 'Unknown',
        message: msg.chatMessage,
      });
      break;
    }
  }
}

function broadcastToGame(gameId: string, message: any, exclude?: WebSocket): void {
  const game = games.get(gameId);
  if (!game) return;

  const data = JSON.stringify(message);
  for (const player of game.players.values()) {
    if (player.ws !== exclude && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(data);
    }
  }
}

// Start server
const PORT = parseInt(process.env.PORT || '3002', 10);
server.listen(PORT, () => {
  console.log(`🎮 Sandbox Platform Server running on port ${PORT}`);
  console.log(`   HTTP API: http://localhost:${PORT}/api`);
  console.log(`   WebSocket: ws://localhost:${PORT}/ws`);
});
