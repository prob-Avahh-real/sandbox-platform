# Sandbox Platform

A Roblox-like sandbox game platform built with TypeScript, Three.js, and React.
Players can explore millions of user-created games, and creators can build their
own games using a Lua scripting environment.

## Architecture

```
sandbox-platform/
├── packages/
│   ├── engine/       # Core game engine (ECS, Three.js, Physics)
│   ├── lua-runtime/  # Lua execution environment (Fengari)
│   ├── server/       # Express + WebSocket game server
│   ├── client/       # React + Three.js player client
│   └── studio/       # Game editor/development studio
├── docker-compose.yml
└── package.json
```

## Tech Stack

- **3D Engine**: Three.js with React Three Fiber
- **Architecture**: Entity Component System (ECS)
- **Physics**: Rapier3D (via @dimforge/rapier3d-compat) + custom simple physics
- **Scripting**: Lua 5.3 via Fengari (pure JS interpreter)
- **Networking**: WebSocket for real-time multiplayer
- **Frontend**: React 18, Vite
- **Backend**: Node.js, Express, ws
- **Editor**: Monaco Editor (optional), custom React panels

## Quick Start

```bash
# Install dependencies
npm install

# Start all services in development mode
npm run dev

# Or start individually:
npm run dev:server   # Game server on :3002
npm run dev:client   # Player client on :3000
npm run dev:studio   # Studio editor on :3001
```

## Features

### For Players
- 3D game world with physics
- Multiplayer with real-time state sync
- Chat system
- Game browser and lobby
- WASD movement, mouse look

### For Creators
- Scene hierarchy explorer
- Property inspector
- Lua script editor with live execution
- Entity creation tools
- 3D viewport with live preview
- Script output console

## Lua API Reference

```lua
-- Create entities
local part = sandbox.createPart("MyPart")
sandbox.setPosition(part, 0, 5, 0)
sandbox.setColor(part, "#e74c3c")
sandbox.setSize(part, 4, 1, 4)

-- Physics
sandbox.applyForce(part, 0, 10, 0)
sandbox.setVelocity(part, 2, 0, 0)

-- Get properties
local pos = sandbox.getPosition(part)
print("Position: " .. pos[1] .. ", " .. pos[2] .. ", " .. pos[3])
```

## Multiplayer Protocol

The server uses WebSocket with JSON messages:

- `joinGame` - Join a game instance
- `playerUpdate` - Send position/rotation updates
- `chatMessage` - Send chat messages

## License

MIT
