// Login modal for Studio (standalone, no AuthContext dependency)

import React, { useState } from 'react';
import { getToken } from './auth';

const API_BASE = `http://${window.location.hostname}:3002/api`;

type Mode = 'login' | 'register';

interface StudioLoginProps {
  onLogin: (username: string) => void;
}

export default function StudioLogin({ onLogin }: StudioLoginProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const endpoint = mode === 'login' ? 'login' : 'register';
    const body: any = { email, password };
    if (mode === 'register') body.username = username;

    try {
      const res = await fetch(`${API_BASE}/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed');
        setSubmitting(false);
        return;
      }

      localStorage.setItem('sandbox_token', data.token);
      onLogin(data.user.username);
    } catch {
      setError('Cannot reach server. Run `npm run dev:server` first.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#1e1e2e',
    }}>
      <div style={{
        background: '#313244',
        borderRadius: '12px',
        padding: '32px',
        width: '380px',
        maxWidth: '90vw',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🛠️</div>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#cdd6f4', margin: 0 }}>
            Sandbox Studio
          </h2>
          <p style={{ fontSize: '13px', color: '#6c7086', marginTop: '4px' }}>
            {mode === 'login' ? 'Sign in to create games' : 'Create your developer account'}
          </p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(243,139,168,0.15)',
            border: '1px solid rgba(243,139,168,0.3)',
            borderRadius: '6px',
            padding: '8px 12px',
            color: '#f38ba8',
            fontSize: '13px',
            marginBottom: '16px',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {mode === 'register' && (
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Username"
              minLength={3}
              maxLength={20}
              required
              autoFocus
              style={inputStyle}
            />
          )}
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            required
            autoFocus={mode === 'login'}
            style={inputStyle}
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            minLength={6}
            required
            style={inputStyle}
          />
          <button type="submit" disabled={submitting} style={{
            marginTop: '8px',
            background: submitting ? '#585b70' : '#89b4fa',
            color: '#1e1e2e',
            border: 'none',
            borderRadius: '8px',
            padding: '12px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}>
            {submitting ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: '#6c7086' }}>
          {mode === 'login' ? (
            <>No account? <button onClick={() => { setMode('register'); setError(''); }} style={linkStyle}>Sign up</button></>
          ) : (
            <>Have an account? <button onClick={() => { setMode('login'); setError(''); }} style={linkStyle}>Sign in</button></>
          )}
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#1e1e2e',
  border: '1px solid #45475a',
  borderRadius: '6px',
  padding: '10px 12px',
  color: '#cdd6f4',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
};

const linkStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#89b4fa',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 'bold',
  padding: 0,
};
