// Lightweight auth for Studio - shares token with client via localStorage

const API_BASE = `http://${window.location.hostname}:3002/api`;

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  createdAt: string;
  gamesCreated: number;
}

export async function getStoredUser(): Promise<UserProfile | null> {
  const token = localStorage.getItem('sandbox_token');
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE}/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      return data.user;
    }
  } catch {
    // Server not available
  }
  return null;
}

export function getToken(): string | null {
  return localStorage.getItem('sandbox_token');
}

export function logout(): void {
  localStorage.removeItem('sandbox_token');
}
