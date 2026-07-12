// JSON-file-based user persistence
// In production, replace with PostgreSQL/Supabase.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import bcrypt from 'bcryptjs';
const { hashSync, compareSync } = bcrypt;

const DATA_DIR = join(process.cwd(), 'data');
const USERS_FILE = join(DATA_DIR, 'users.json');

export interface UserRecord {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  createdAt: string;
  lastLoginAt: string;
  gamesCreated: number;
  totalPlayTime: number; // seconds
}

// Ensure data directory
function ensureDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Load all users
function loadUsers(): Map<string, UserRecord> {
  ensureDir();
  if (!existsSync(USERS_FILE)) {
    return new Map();
  }
  try {
    const raw = readFileSync(USERS_FILE, 'utf-8');
    const entries: [string, UserRecord][] = JSON.parse(raw);
    return new Map(entries);
  } catch {
    return new Map();
  }
}

// Save all users
function saveUsers(users: Map<string, UserRecord>): void {
  ensureDir();
  const entries = Array.from(users.entries());
  writeFileSync(USERS_FILE, JSON.stringify(entries, null, 2), 'utf-8');
}

// Create a new user
export function createUser(
  username: string,
  email: string,
  password: string,
  displayName?: string
): UserRecord | { error: string } {
  const users = loadUsers();

  // Check existing
  for (const u of users.values()) {
    if (u.username.toLowerCase() === username.toLowerCase()) {
      return { error: 'Username already taken' };
    }
    if (u.email.toLowerCase() === email.toLowerCase()) {
      return { error: 'Email already registered' };
    }
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const user: UserRecord = {
    id,
    username,
    email: email.toLowerCase(),
    passwordHash: hashSync(password, 10),
    displayName: displayName || username,
    avatarUrl: '',
    bio: '',
    createdAt: now,
    lastLoginAt: now,
    gamesCreated: 0,
    totalPlayTime: 0,
  };

  users.set(id, user);
  saveUsers(users);
  return user;
}

// Authenticate by email + password
export function authenticateUser(
  email: string,
  password: string
): UserRecord | { error: string } {
  const users = loadUsers();
  const user = Array.from(users.values()).find(
    u => u.email.toLowerCase() === email.toLowerCase()
  );

  if (!user) {
    return { error: 'Invalid email or password' };
  }

  if (!compareSync(password, user.passwordHash)) {
    return { error: 'Invalid email or password' };
  }

  // Update last login
  user.lastLoginAt = new Date().toISOString();
  users.set(user.id, user);
  saveUsers(users);

  return user;
}

// Get user by ID
export function getUserById(id: string): UserRecord | undefined {
  return loadUsers().get(id);
}

// Get user by username
export function getUserByUsername(username: string): UserRecord | undefined {
  const users = loadUsers();
  return Array.from(users.values()).find(
    u => u.username.toLowerCase() === username.toLowerCase()
  );
}

// Update user profile
export function updateUser(
  id: string,
  updates: Partial<Pick<UserRecord, 'displayName' | 'bio' | 'avatarUrl'>>
): UserRecord | undefined {
  const users = loadUsers();
  const user = users.get(id);
  if (!user) return undefined;

  if (updates.displayName !== undefined) user.displayName = updates.displayName;
  if (updates.bio !== undefined) user.bio = updates.bio;
  if (updates.avatarUrl !== undefined) user.avatarUrl = updates.avatarUrl;

  users.set(id, user);
  saveUsers(users);
  return user;
}

// Increment games created counter
export function incrementGamesCreated(id: string): void {
  const users = loadUsers();
  const user = users.get(id);
  if (user) {
    user.gamesCreated++;
    users.set(id, user);
    saveUsers(users);
  }
}

// Add play time
export function addPlayTime(id: string, seconds: number): void {
  const users = loadUsers();
  const user = users.get(id);
  if (user) {
    user.totalPlayTime += seconds;
    users.set(id, user);
    saveUsers(users);
  }
}

// Get public profile (no password hash)
export function getPublicProfile(user: UserRecord) {
  const { passwordHash, email, ...profile } = user;
  return profile;
}

// List all users (for leaderboard / friends)
export function listUsers(limit = 50): ReturnType<typeof getPublicProfile>[] {
  const users = loadUsers();
  return Array.from(users.values())
    .slice(0, limit)
    .map(getPublicProfile);
}
