// Login / Register modal component

import React, { useState } from 'react';
import { useAuth } from './AuthContext';

type Mode = 'login' | 'register';

interface LoginModalProps {
  onClose?: () => void;
}

export default function LoginModal({ onClose }: LoginModalProps) {
  const { login, register } = useAuth();
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

    let result: { success: boolean; error?: string };
    if (mode === 'login') {
      result = await login(email, password);
    } else {
      result = await register(username, email, password);
    }

    setSubmitting(false);

    if (result.success) {
      onClose?.();
    } else {
      setError(result.error || 'Something went wrong');
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: '#1e1e2e',
        borderRadius: '12px',
        padding: '32px',
        width: '380px',
        maxWidth: '90vw',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>🎮</div>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#cdd6f4', margin: 0 }}>
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p style={{ fontSize: '13px', color: '#6c7086', marginTop: '4px' }}>
            {mode === 'login'
              ? 'Sign in to your Sandbox account'
              : 'Join the Sandbox community'}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(243, 139, 168, 0.15)',
            border: '1px solid rgba(243, 139, 168, 0.3)',
            borderRadius: '6px',
            padding: '8px 12px',
            color: '#f38ba8',
            fontSize: '13px',
            marginBottom: '16px',
          }}>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {mode === 'register' && (
            <InputField
              label="Username"
              type="text"
              value={username}
              onChange={setUsername}
              placeholder="coolplayer99"
              minLength={3}
              maxLength={20}
              autoFocus
            />
          )}

          <InputField
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            autoFocus={mode === 'login'}
          />

          <InputField
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            minLength={6}
          />

          <button
            type="submit"
            disabled={submitting}
            style={{
              marginTop: '8px',
              background: submitting ? '#585b70' : '#89b4fa',
              color: '#1e1e2e',
              border: 'none',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: submitting ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {submitting
              ? 'Please wait...'
              : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {/* Mode switch */}
        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: '#6c7086' }}>
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <button
                onClick={() => { setMode('register'); setError(''); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#89b4fa',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  padding: 0,
                }}
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                onClick={() => { setMode('login'); setError(''); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#89b4fa',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  padding: 0,
                }}
              >
                Sign in
              </button>
            </>
          )}
        </div>

        {/* Close */}
        {onClose && (
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: 'none',
              border: 'none',
              color: '#6c7086',
              cursor: 'pointer',
              fontSize: '18px',
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

function InputField({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoFocus,
  minLength,
  maxLength,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  minLength?: number;
  maxLength?: number;
}) {
  return (
    <div>
      <label style={{
        display: 'block',
        fontSize: '12px',
        fontWeight: 'bold',
        color: '#a6adc8',
        marginBottom: '4px',
      }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        minLength={minLength}
        maxLength={maxLength}
        required
        style={{
          width: '100%',
          background: '#313244',
          border: '1px solid #45475a',
          borderRadius: '6px',
          padding: '10px 12px',
          color: '#cdd6f4',
          fontSize: '14px',
          outline: 'none',
          transition: 'border-color 0.15s',
          boxSizing: 'border-box',
        }}
        onFocus={e => (e.target.style.borderColor = '#89b4fa')}
        onBlur={e => (e.target.style.borderColor = '#45475a')}
      />
    </div>
  );
}
