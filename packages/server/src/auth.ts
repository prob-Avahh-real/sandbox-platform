// Auth routes: register, login, token verification, profile

import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import {
  createUser,
  authenticateUser,
  getUserById,
  updateUser,
  getPublicProfile,
  listUsers,
} from './store';

const JWT_SECRET = process.env.JWT_SECRET || 'sandbox-dev-secret-change-in-production';
const JWT_EXPIRY = '7d';

export interface AuthPayload {
  userId: string;
  username: string;
  email: string;
}

// Sign a JWT token
function signToken(user: { id: string; username: string; email: string }): string {
  const payload: AuthPayload = {
    userId: user.id,
    username: user.username,
    email: user.email,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

// Verify JWT token
export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

// Middleware: require auth
export function requireAuth(req: Request, res: Response, next: Function): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  (req as any).user = payload;
  next();
}

// Optional auth middleware (does not reject)
export function optionalAuth(req: Request, _res: Response, next: Function): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    if (payload) {
      (req as any).user = payload;
    }
  }
  next();
}

export function createAuthRouter(): Router {
  const router = Router();

  // POST /api/auth/register
  router.post('/register', (req: Request, res: Response) => {
    const { username, email, password, displayName } = req.body;

    if (!username || !email || !password) {
      res.status(400).json({ error: 'username, email, and password are required' });
      return;
    }

    if (username.length < 3 || username.length > 20) {
      res.status(400).json({ error: 'Username must be 3-20 characters' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: 'Invalid email format' });
      return;
    }

    const result = createUser(username, email, password, displayName);
    if ('error' in result) {
      res.status(409).json({ error: result.error });
      return;
    }

    const token = signToken(result);
    res.status(201).json({
      token,
      user: getPublicProfile(result),
    });
  });

  // POST /api/auth/login
  router.post('/login', (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }

    const result = authenticateUser(email, password);
    if ('error' in result) {
      res.status(401).json({ error: result.error });
      return;
    }

    const token = signToken(result);
    res.json({
      token,
      user: getPublicProfile(result),
    });
  });

  // GET /api/auth/me — get current user profile
  router.get('/me', requireAuth, (req: Request, res: Response) => {
    const { userId } = (req as any).user as AuthPayload;
    const user = getUserById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ user: getPublicProfile(user) });
  });

  // PUT /api/auth/me — update profile
  router.put('/me', requireAuth, (req: Request, res: Response) => {
    const { userId } = (req as any).user as AuthPayload;
    const { displayName, bio, avatarUrl } = req.body;

    const updated = updateUser(userId, { displayName, bio, avatarUrl });
    if (!updated) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ user: getPublicProfile(updated) });
  });

  // GET /api/auth/verify — verify a token
  router.get('/verify', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ valid: false });
      return;
    }

    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    if (!payload) {
      res.status(401).json({ valid: false });
      return;
    }

    const user = getUserById(payload.userId);
    if (!user) {
      res.status(401).json({ valid: false });
      return;
    }

    res.json({ valid: true, user: getPublicProfile(user) });
  });

  // GET /api/users — list users (leaderboard)
  router.get('/', (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const users = listUsers(limit);
    res.json({ users });
  });

  // GET /api/users/:id — get user by ID
  router.get('/:id', (req: Request, res: Response) => {
    const user = getUserById(req.params.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ user: getPublicProfile(user) });
  });

  return router;
}
