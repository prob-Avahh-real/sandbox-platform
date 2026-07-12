// Publish dialog — collect game metadata and upload to server

import React, { useState } from 'react';
import { Game, EntityId } from '@sandbox/engine';
import { getToken } from './auth';

const API_BASE = `http://${window.location.hostname}:3002/api`;

interface PublishDialogProps {
  game: Game;
  luaScript: string;
  existingGameId?: string;  // for editing existing
  existingName?: string;
  existingDesc?: string;
  existingTags?: string[];
  onClose: () => void;
  onPublished: (gameId: string) => void;
}

export default function PublishDialog({
  game,
  luaScript,
  existingGameId,
  existingName,
  existingDesc,
  existingTags,
  onClose,
  onPublished,
}: PublishDialogProps) {
  const [name, setName] = useState(existingName || '');
  const [description, setDescription] = useState(existingDesc || '');
  const [tagsInput, setTagsInput] = useState((existingTags || []).join(', '));
  const [maxPlayers, setMaxPlayers] = useState(16);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isUpdate = !!existingGameId;

  async function handlePublish() {
    if (!name.trim()) {
      setError('Game name is required');
      return;
    }

    setSubmitting(true);
    setError('');

    const token = getToken();
    if (!token) {
      setError('You must be logged in to publish');
      setSubmitting(false);
      return;
    }

    const tags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    // Serialize using engine's saveToData
    const saveData = game.saveToData();

    const body = {
      name: name.trim(),
      description: description.trim(),
      luaScript,
      entities: saveData.entities,
      tags,
      maxPlayers,
    };

    try {
      const url = isUpdate
        ? `${API_BASE}/games/${existingGameId}`
        : `${API_BASE}/games`;

      const method = isUpdate ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to publish');
      } else {
        onPublished(data.meta?.id || existingGameId || '');
        onClose();
      }
    } catch {
      setError('Cannot reach server. Is it running?');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: '#1e1e2e',
        borderRadius: '12px',
        padding: '28px',
        width: '480px',
        maxWidth: '90vw',
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#cdd6f4', margin: 0 }}>
            {isUpdate ? '📝 Update Game' : '🚀 Publish Game'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6c7086', cursor: 'pointer', fontSize: '20px' }}>
            ✕
          </button>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={labelStyle}>Game Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="My Awesome Game" maxLength={50} style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What's your game about?"
              maxLength={300}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', minHeight: '60px' }}
            />
          </div>

          <div>
            <label style={labelStyle}>Tags (comma separated)</label>
            <input value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="adventure, racing, puzzle" style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Max Players</label>
            <select value={maxPlayers} onChange={e => setMaxPlayers(parseInt(e.target.value))} style={inputStyle}>
              {[2, 4, 8, 16, 32, 64].map(n => (
                <option key={n} value={n}>{n} players</option>
              ))}
            </select>
          </div>

          <div style={{ fontSize: '11px', color: '#6c7086' }}>
            💡 After publishing, your game will appear in the lobby for everyone to play.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button onClick={onClose} style={cancelBtnStyle}>Cancel</button>
          <button onClick={handlePublish} disabled={submitting} style={publishBtnStyle(submitting)}>
            {submitting ? 'Publishing...' : isUpdate ? 'Update' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 'bold',
  color: '#a6adc8',
  marginBottom: '4px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#313244',
  border: '1px solid #45475a',
  borderRadius: '6px',
  padding: '8px 12px',
  color: '#cdd6f4',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box',
};

const cancelBtnStyle: React.CSSProperties = {
  background: '#313244',
  border: '1px solid #45475a',
  borderRadius: '6px',
  padding: '8px 20px',
  color: '#cdd6f4',
  fontSize: '13px',
  cursor: 'pointer',
};

function publishBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    background: disabled ? '#585b70' : '#89b4fa',
    color: '#1e1e2e',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 24px',
    fontSize: '13px',
    fontWeight: 'bold',
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}
