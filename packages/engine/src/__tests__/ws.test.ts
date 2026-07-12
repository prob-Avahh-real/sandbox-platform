// Test 1: WebSocket multiplayer flow (self-contained, no fork)

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';

let passed = 0, failed = 0;
const assert = (c: boolean, m: string) => { c ? (passed++, console.log('  ✓ ' + m)) : (failed++, console.error('  ✗ ' + m)); };

// Minimal game server
interface Player { id: string; username: string; ws: WebSocket; position: any; rotation: any; }
const games = new Map<string, { players: Map<string, Player> }>();
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  const pid = uuidv4();
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === 'joinGame') {
      let game = games.get(msg.gameId);
      if (!game) { game = { players: new Map() }; games.set(msg.gameId, game); }
      const player: Player = { id: pid, username: msg.username || 'anon', ws, position: { x:0,y:0,z:0 }, rotation: { x:0,y:0,z:0 } };
      game.players.set(pid, player);
      ws.send(JSON.stringify({ type: 'joined', gameId: msg.gameId, playerId: pid, username: player.username, players: [...game.players.values()].filter(p=>p.id!==pid).map(p=>({id:p.id,username:p.username})) }));
      for (const p of game.players.values()) { if (p.id !== pid) p.ws.send(JSON.stringify({ type: 'playerJoined', playerId: pid, username: player.username })); }
    } else if (msg.type === 'chatMessage') {
      const game = games.get(msg.gameId);
      if (game) for (const p of game.players.values()) p.ws.send(JSON.stringify({ type: 'chatMessage', username: msg.username, message: msg.chatMessage }));
    } else if (msg.type === 'playerUpdate') {
      const game = games.get(msg.gameId);
      if (game) for (const p of game.players.values()) { if (p.id !== pid) p.ws.send(JSON.stringify({ type: 'playerUpdate', playerId: pid, position: msg.position })); }
    }
  });
});

async function test() {
  await new Promise<void>(r => server.listen(3099, r));
  console.log('  Server on 3099');

  const ws1 = new WebSocket('ws://localhost:3099');
  await new Promise(r => ws1.on('open', r));
  ws1.send(JSON.stringify({ type: 'joinGame', gameId: 'w', username: 'Alice' }));
  const m1: any = await new Promise(r => ws1.once('message', d => r(JSON.parse(d.toString()))));
  assert(m1.type === 'joined', 'joinGame returns joined');
  assert(m1.username === 'Alice', 'username correct');

  const ws2 = new WebSocket('ws://localhost:3099');
  await new Promise(r => ws2.on('open', r));
  ws2.send(JSON.stringify({ type: 'joinGame', gameId: 'w', username: 'Bob' }));
  const m2: any = await new Promise(r => ws2.once('message', d => r(JSON.parse(d.toString()))));
  assert(m2.type === 'joined', 'player2 joined');
  assert(m2.players.length >= 1, 'player2 sees player1');

  const p1event: any = await new Promise(r => ws1.once('message', d => { const m=JSON.parse(d.toString()); if(m.type==='playerJoined') r(m); }));
  assert(p1event.username === 'Bob', 'player1 gets playerJoined');

  ws1.send(JSON.stringify({ type: 'chatMessage', gameId: 'w', username: 'Alice', chatMessage: 'Hi' }));
  const chat: any = await new Promise(r => ws2.once('message', d => { const m=JSON.parse(d.toString()); if(m.type==='chatMessage') r(m); }));
  assert(chat.message === 'Hi', 'chat delivered');

  ws1.send(JSON.stringify({ type: 'playerUpdate', gameId: 'w', position: { x:5, y:0, z:2 } }));
  const upd: any = await new Promise(r => ws2.once('message', d => { const m=JSON.parse(d.toString()); if(m.type==='playerUpdate') r(m); }));
  assert(upd.position.x === 5, 'position sync');

  ws1.close(); ws2.close();
  server.close();
  console.log(`\n  WS: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

test().catch(e => { console.error('WS FAIL:', e.message); process.exit(1); });
