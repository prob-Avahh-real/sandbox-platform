// Game storage — JSON file persistence for game metadata and entity data

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { incrementGamesCreated } from './store';

const DATA_DIR = join(process.cwd(), 'data');
const GAMES_FILE = join(DATA_DIR, 'games.json');

export interface GameMeta {
  id: string;
  name: string;
  description: string;
  creatorId: string;
  creatorName: string;
  tags: string[];
  thumbnail: string;
  playCount: number;
  likeCount: number;
  maxPlayers: number;
  createdAt: string;
  updatedAt: string;
}

export interface GameEntityData {
  id: number;
  name: string;
  components: Array<{
    type: string;
    entityId: number;
    [key: string]: any;
  }>;
}

export interface GameData {
  meta: GameMeta;
  luaScript: string;
  entities: GameEntityData[];
  sceneConfig: {
    groundSize: number;
    skyColor: string;
    ambientLight: string;
    ambientIntensity: number;
  };
}

function loadAllGames(): Map<string, GameData> {
  if (!existsSync(GAMES_FILE)) return new Map();
  try {
    const raw = readFileSync(GAMES_FILE, 'utf-8');
    const entries: [string, GameData][] = JSON.parse(raw);
    return new Map(entries);
  } catch {
    return new Map();
  }
}

function saveAllGames(games: Map<string, GameData>): void {
  const entries = Array.from(games.entries());
  writeFileSync(GAMES_FILE, JSON.stringify(entries, null, 2), 'utf-8');
}

export function createGame(
  name: string,
  description: string,
  creatorId: string,
  creatorName: string,
  luaScript: string,
  entities: GameEntityData[],
  tags: string[] = [],
  maxPlayers = 16
): GameData {
  const games = loadAllGames();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const meta: GameMeta = {
    id,
    name,
    description,
    creatorId,
    creatorName,
    tags,
    thumbnail: '',
    playCount: 0,
    likeCount: 0,
    maxPlayers,
    createdAt: now,
    updatedAt: now,
  };

  const game: GameData = {
    meta,
    luaScript,
    entities,
    sceneConfig: {
      groundSize: 30,
      skyColor: '#1a1a2e',
      ambientLight: '#404060',
      ambientIntensity: 0.5,
    },
  };

  games.set(id, game);
  saveAllGames(games);
  incrementGamesCreated(creatorId);
  return game;
}

export function updateGame(
  id: string,
  updates: Partial<Pick<GameMeta, 'name' | 'description' | 'tags' | 'thumbnail' | 'maxPlayers'>> & {
    luaScript?: string;
    entities?: GameEntityData[];
  }
): GameData | null {
  const games = loadAllGames();
  const game = games.get(id);
  if (!game) return null;

  if (updates.name !== undefined) game.meta.name = updates.name;
  if (updates.description !== undefined) game.meta.description = updates.description;
  if (updates.tags !== undefined) game.meta.tags = updates.tags;
  if (updates.thumbnail !== undefined) game.meta.thumbnail = updates.thumbnail;
  if (updates.maxPlayers !== undefined) game.meta.maxPlayers = updates.maxPlayers;
  if (updates.luaScript !== undefined) game.luaScript = updates.luaScript;
  if (updates.entities !== undefined) game.entities = updates.entities;
  game.meta.updatedAt = new Date().toISOString();

  games.set(id, game);
  saveAllGames(games);
  return game;
}

export function getGame(id: string): GameData | undefined {
  return loadAllGames().get(id);
}

export function deleteGame(id: string): boolean {
  const games = loadAllGames();
  const existed = games.has(id);
  games.delete(id);
  saveAllGames(games);
  return existed;
}

export function listGames(options: {
  search?: string;
  tags?: string[];
  creatorId?: string;
  sort?: 'newest' | 'popular' | 'updated';
  limit?: number;
  offset?: number;
} = {}): { games: GameMeta[]; total: number } {
  const { search, tags, creatorId, sort = 'newest', limit = 20, offset = 0 } = options;

  let games = Array.from(loadAllGames().values()).map(g => g.meta);

  if (search) {
    const q = search.toLowerCase();
    games = games.filter(g =>
      g.name.toLowerCase().includes(q) ||
      g.description.toLowerCase().includes(q) ||
      g.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  if (tags && tags.length > 0) {
    games = games.filter(g => tags.every(t => g.tags.some(gt => gt.toLowerCase() === t.toLowerCase())));
  }

  if (creatorId) {
    games = games.filter(g => g.creatorId === creatorId);
  }

  switch (sort) {
    case 'popular':
      games.sort((a, b) => b.playCount - a.playCount);
      break;
    case 'updated':
      games.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      break;
    case 'newest':
    default:
      games.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      break;
  }

  const total = games.length;
  const paged = games.slice(offset, offset + limit);
  return { games: paged, total };
}

export function incrementPlayCount(id: string): void {
  const games = loadAllGames();
  const game = games.get(id);
  if (game) {
    game.meta.playCount++;
    games.set(id, game);
    saveAllGames(games);
  }
}

export function toggleLike(id: string): { liked: boolean; likeCount: number } {
  const games = loadAllGames();
  const game = games.get(id);
  if (!game) return { liked: false, likeCount: 0 };
  game.meta.likeCount = Math.max(0, game.meta.likeCount + 1);
  games.set(id, game);
  saveAllGames(games);
  return { liked: true, likeCount: game.meta.likeCount };
}

export function getAllTags(): { tag: string; count: number }[] {
  const games = loadAllGames();
  const tagCounts = new Map<string, number>();
  for (const game of games.values()) {
    for (const tag of game.meta.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }
  return Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}
