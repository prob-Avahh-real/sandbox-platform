// Game Lobby — browse, search, and select games to play

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import LoginModal from './LoginModal';

const API_BASE = `http://${window.location.hostname}:3002/api`;

type SortMode = 'popular' | 'newest' | 'updated';

interface GameCard {
  id: string;
  name: string;
  description: string;
  creatorName: string;
  tags: string[];
  thumbnail: string;
  playCount: number;
  likeCount: number;
  maxPlayers: number;
  playerCount?: number; // live
  createdAt: string;
  updatedAt: string;
}

interface GameLobbyProps {
  onPlayGame: (gameId: string, gameName: string) => void;
}

export default function GameLobby({ onPlayGame }: GameLobbyProps) {
  const { user } = useAuth();
  const [games, setGames] = useState<GameCard[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('popular');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [showLogin, setShowLogin] = useState(false);
  const pageSize = 12;

  const fetchGames = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        sort,
        limit: String(pageSize),
        offset: String(page * pageSize),
      });
      if (search) params.set('search', search);

      const res = await fetch(`${API_BASE}/games?${params}`);
      if (!res.ok) throw new Error('Failed to load games');
      const data = await res.json();
      setGames(data.games);
      setTotal(data.total);
    } catch (err: any) {
      setError(err.message || 'Cannot reach server');
    } finally {
      setLoading(false);
    }
  }, [search, sort, page]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#1a1a2e',
      color: '#cdd6f4',
      overflow: 'auto',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'linear-gradient(180deg, #1e1e2e 80%, transparent)',
        padding: '24px 32px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0 0 4px' }}>
              🎮 Sandbox Games
            </h1>
            <p style={{ fontSize: '13px', color: '#6c7086', margin: 0 }}>
              {total} games available
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {user ? (
              <span style={{ fontSize: '13px', color: '#a6e3a1', alignSelf: 'center' }}>
                👤 {user.username}
              </span>
            ) : (
              <button onClick={() => setShowLogin(true)} style={secondaryBtnStyle}>
                Sign In
              </button>
            )}
          </div>
        </div>

        {/* Search + Sort */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px' }}>
              🔍
            </span>
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search games..."
              style={{
                width: '100%',
                background: '#313244',
                border: '1px solid #45475a',
                borderRadius: '8px',
                padding: '10px 12px 10px 40px',
                color: '#cdd6f4',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <select
            value={sort}
            onChange={e => { setSort(e.target.value as SortMode); setPage(0); }}
            style={{
              background: '#313244',
              border: '1px solid #45475a',
              borderRadius: '8px',
              padding: '10px 12px',
              color: '#cdd6f4',
              fontSize: '13px',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="popular">🔥 Most Played</option>
            <option value="newest">✨ Newest</option>
            <option value="updated">🔄 Recently Updated</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '0 32px 32px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#6c7086' }}>
            Loading games...
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#f38ba8' }}>
            {error}
            <br />
            <button onClick={fetchGames} style={{ ...secondaryBtnStyle, marginTop: '12px' }}>
              Retry
            </button>
          </div>
        ) : games.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#6c7086' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
            <div style={{ fontSize: '16px', marginBottom: '8px' }}>No games found</div>
            <div style={{ fontSize: '13px' }}>
              {search ? 'Try a different search term' : 'Be the first to create a game in Studio!'}
            </div>
          </div>
        ) : (
          <>
            {/* Game cards grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '16px',
            }}>
              {games.map(game => (
                <GameCardItem key={game.id} game={game} onPlay={() => onPlayGame(game.id, game.name)} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex', justifyContent: 'center', gap: '8px',
                marginTop: '24px',
              }}>
                <button
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                  style={pageBtnStyle(page === 0)}
                >
                  ← Prev
                </button>
                <span style={{ padding: '8px 16px', color: '#6c7086', fontSize: '13px' }}>
                  {page + 1} / {totalPages}
                </span>
                <button
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}
                  style={pageBtnStyle(page >= totalPages - 1)}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Login modal */}
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </div>
  );
}

function GameCardItem({ game, onPlay }: { game: GameCard; onPlay: () => void }) {
  const colors = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#2ecc71'];
  const bgColor = colors[game.name.length % colors.length];
  const daysAgo = Math.floor((Date.now() - new Date(game.updatedAt).getTime()) / 86400000);

  return (
    <div
      onClick={onPlay}
      style={{
        background: '#1e1e2e',
        borderRadius: '12px',
        overflow: 'hidden',
        cursor: 'pointer',
        border: '1px solid #313244',
        transition: 'transform 0.15s, border-color 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget;
        el.style.transform = 'translateY(-2px)';
        el.style.borderColor = '#89b4fa';
        el.style.boxShadow = '0 8px 24px rgba(137,180,250,0.15)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget;
        el.style.transform = '';
        el.style.borderColor = '#313244';
        el.style.boxShadow = '';
      }}
    >
      {/* Thumbnail placeholder */}
      <div style={{
        height: '140px',
        background: `linear-gradient(135deg, ${bgColor}, ${bgColor}88)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '40px',
      }}>
        🎮
      </div>

      <div style={{ padding: '14px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '15px', marginBottom: '4px', color: '#cdd6f4' }}>
          {game.name}
        </div>
        {game.description && (
          <div style={{
            fontSize: '12px',
            color: '#6c7086',
            marginBottom: '8px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {game.description}
          </div>
        )}

        {/* Tags */}
        {game.tags.length > 0 && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '10px' }}>
            {game.tags.slice(0, 3).map(tag => (
              <span key={tag} style={{
                fontSize: '10px',
                background: '#313244',
                color: '#89b4fa',
                padding: '2px 8px',
                borderRadius: '10px',
              }}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#585b70' }}>
          <span>👤 {game.creatorName}</span>
          <span>▶ {game.playCount.toLocaleString()}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#45475a', marginTop: '2px' }}>
          <span>{game.playerCount ?? 0} playing</span>
          <span>{daysAgo === 0 ? 'Today' : `${daysAgo}d ago`}</span>
        </div>
      </div>
    </div>
  );
}

const secondaryBtnStyle: React.CSSProperties = {
  background: '#313244',
  border: '1px solid #45475a',
  borderRadius: '6px',
  padding: '6px 16px',
  color: '#cdd6f4',
  fontSize: '13px',
  cursor: 'pointer',
};

function pageBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    background: disabled ? '#1e1e2e' : '#313244',
    border: '1px solid #45475a',
    borderRadius: '6px',
    padding: '8px 16px',
    color: disabled ? '#45475a' : '#cdd6f4',
    fontSize: '13px',
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}
