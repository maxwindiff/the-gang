import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWebSocket } from '../hooks/useWebSocket';
import { commonStyles, statusColors, buttonColors } from '../utils/constants';

function Waiting() {
  const { roomName, playerName } = useParams();
  const navigate = useNavigate();
  const [roomData, setRoomData] = useState(null);

  const handleMessage = useCallback((data) => {
    switch (data.type) {
      case 'room_update':
        setRoomData(data.room_data);
        break;
      case 'game_started':
        setRoomData(data.room_data);
        navigate(`/game/${roomName}/${playerName}`);
        break;
      case 'error':
        setError(data.message);
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  }, [navigate, roomName, playerName]);

  const { connectionStatus, error, setError, sendMessage } = useWebSocket(roomName, playerName, handleMessage);

  const handleStartGame = () => {
    const success = sendMessage({ type: 'start_game' });
    if (!success) {
      setError('Failed to start game. Please try again.');
    }
  };

  const handleLeaveRoom = () => {
    sendMessage({ type: 'leave_room' });
    navigate('/');
  };

  return (
    <div style={commonStyles.container}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '2rem'
      }}>
        <h1>Room: {roomName}</h1>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem',
          fontSize: '0.9rem'
        }}>
          <div 
            style={{ 
              ...commonStyles.statusIndicator,
              backgroundColor: statusColors[connectionStatus] || statusColors.default
            }}
          />
          {connectionStatus}
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <strong>You are: {playerName}</strong>
      </div>

      {error && (
        <div style={commonStyles.errorBox}>
          {error}
        </div>
      )}

      {roomData ? (
        <div>
          <h2>Players ({roomData.player_count}/6)</h2>
          <ul style={{ 
            listStyle: 'none', 
            padding: 0,
            marginBottom: '2rem'
          }}>
            {roomData.players.map((player, index) => (
              <li key={index} style={{ 
                padding: '0.5rem',
                margin: '0.25rem 0',
                backgroundColor: player === playerName ? '#e7f3ff' : '#f8f9fa',
                border: '1px solid #dee2e6',
                borderRadius: '4px'
              }}>
                {player} {player === playerName && '(You)'}
              </li>
            ))}
          </ul>

          <div style={{ marginBottom: '1rem' }}>
            <strong>Room State:</strong> {roomData.state}
          </div>

          {roomData.state === 'waiting' && (
            <div>
              {roomData.can_start ? (
                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ color: '#28a745', marginBottom: '1rem' }}>
                    Ready to start! Need 3-6 players to play.
                  </p>
                  <button
                    onClick={handleStartGame}
                    style={{
                      ...commonStyles.button,
                      backgroundColor: buttonColors.success,
                      marginRight: '1rem'
                    }}
                  >
                    Start Game
                  </button>
                </div>
              ) : (
                <p style={{ color: '#666', marginBottom: '1rem' }}>
                  Waiting for more players... (Need 3-6 players)
                </p>
              )}
            </div>
          )}

          <button
            onClick={handleLeaveRoom}
            style={{
              ...commonStyles.smallButton,
              backgroundColor: buttonColors.danger
            }}
          >
            Leave Room
          </button>
        </div>
      ) : (
        <div>Loading room data...</div>
      )}
    </div>
  );
}

export default Waiting;