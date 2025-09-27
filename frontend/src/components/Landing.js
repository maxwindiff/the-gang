import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE, commonStyles, buttonColors } from '../utils/constants';

function Landing() {
  const [playerName, setPlayerName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Generate random username in dev mode
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const adjectives = ['Cool', 'Fast', 'Smart', 'Lucky', 'Bold', 'Quick', 'Wild', 'Sharp'];
      const animals = ['Fox', 'Cat', 'Dog', 'Wolf', 'Bear', 'Lion', 'Tiger', 'Eagle'];
      const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
      const animal = animals[Math.floor(Math.random() * animals.length)];
      const number = Math.floor(Math.random() * 100);
      setPlayerName(`${adjective}${animal}${number}`);
    }
  }, []);

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

  const isMobile = window.innerWidth <= 768;

  return (
    <div style={{ padding: isMobile ? '1rem' : '2rem', maxWidth: '400px', margin: '0 auto' }}>
      <h1 style={{
        fontSize: isMobile ? '1.25rem' : '2rem',
        margin: isMobile ? '0 0 1rem 0' : '0 0 1.5rem 0',
        textAlign: 'center'
      }}>The Gang - Poker</h1>
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
            style={commonStyles.input}
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
            style={commonStyles.input}
            maxLength="20"
            required
          />
        </div>

        {error && (
          <div style={commonStyles.errorBox}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            ...commonStyles.button,
            width: '100%',
            backgroundColor: loading ? '#ccc' : buttonColors.primary,
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Joining...' : 'Join Room'}
        </button>
      </form>

      <div style={{ marginTop: '2rem', fontSize: '0.9rem', color: '#666' }}>
        <h3 style={{
          fontSize: isMobile ? '1rem' : '1.17rem',
          margin: isMobile ? '1rem 0 0.5rem 0' : '1.5rem 0 0.83rem 0'
        }}>How to play:</h3>
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