import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = 'http://localhost:8000';

function Landing() {
  const [playerName, setPlayerName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const validateInput = (value) => {
    return /^[a-zA-Z0-9]+$/.test(value);
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    setError('');

    if (!playerName.trim() || !roomName.trim()) {
      setError('Player name and room name are required');
      return;
    }

    if (!validateInput(playerName) || !validateInput(roomName)) {
      setError('Player name and room name must be alphanumeric');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/join-room/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          player_name: playerName.trim(),
          room_name: roomName.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        navigate(`/waiting/${roomName.trim()}/${playerName.trim()}`);
      } else {
        setError(data.error || 'Failed to join room');
      }
    } catch (err) {
      setError('Unable to connect to server');
      console.error('Join room error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '400px', margin: '0 auto' }}>
      <h1>The Gang - Poker</h1>
      <form onSubmit={handleJoinRoom}>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="playerName" style={{ display: 'block', marginBottom: '0.5rem' }}>
            Player Name (alphanumeric):
          </label>
          <input
            id="playerName"
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '0.5rem', 
              fontSize: '1rem',
              marginBottom: '0.5rem'
            }}
            maxLength="20"
            required
          />
        </div>
        
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="roomName" style={{ display: 'block', marginBottom: '0.5rem' }}>
            Room Name (alphanumeric):
          </label>
          <input
            id="roomName"
            type="text"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '0.5rem', 
              fontSize: '1rem',
              marginBottom: '0.5rem'
            }}
            maxLength="20"
            required
          />
        </div>

        {error && (
          <div style={{ 
            color: 'red', 
            marginBottom: '1rem',
            padding: '0.5rem',
            border: '1px solid red',
            borderRadius: '4px'
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '0.75rem',
            fontSize: '1rem',
            backgroundColor: loading ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Joining...' : 'Join Room'}
        </button>
      </form>

      <div style={{ marginTop: '2rem', fontSize: '0.9rem', color: '#666' }}>
        <h3>How to play:</h3>
        <ul style={{ textAlign: 'left' }}>
          <li>Enter your player name and room name</li>
          <li>If the room doesn't exist, it will be created</li>
          <li>Wait for 3-6 players to join</li>
          <li>Any player can start the game once enough players are present</li>
        </ul>
      </div>
    </div>
  );
}

export default Landing;