import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const WS_BASE = 'ws://localhost:8000';

function Game() {
  const { roomName, playerName } = useParams();
  const navigate = useNavigate();
  const [roomData, setRoomData] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [error, setError] = useState('');
  const ws = useRef(null);
  const isClosing = useRef(false);

  useEffect(() => {
    const connectWebSocket = () => {
      ws.current = new WebSocket(`${WS_BASE}/ws/game/${roomName}/${playerName}/`);

      ws.current.onopen = () => {
        console.log('Game WebSocket connected');
        setConnectionStatus('connected');
        setError('');
        isClosing.current = false;
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Game WebSocket message:', data);

          switch (data.type) {
            case 'room_update':
              setRoomData(data.room_data);
              break;
            case 'game_ended':
              setRoomData(data.room_data);
              break;
            case 'error':
              setError(data.message);
              break;
            default:
              console.log('Unknown message type:', data.type);
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.current.onclose = (event) => {
        console.log('Game WebSocket closed:', event.code, event.reason);
        setConnectionStatus('disconnected');
        
        if (event.code !== 1000) {
          setTimeout(connectWebSocket, 3000);
        }
      };

      ws.current.onerror = (event) => {
        console.error('Game WebSocket error:', event);
        setConnectionStatus('error');
        setError('Connection error occurred');
      };
    };

    connectWebSocket();

    return () => {
      if (ws.current && !isClosing.current) {
        try {
          // Only close if WebSocket is in OPEN or CONNECTING state and not already closing
          if (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING) {
            isClosing.current = true;
            ws.current.close(1001, 'Component unmounting');
          }
        } catch (error) {
          console.log('WebSocket close error (safe to ignore):', error);
        }
      }
    };
  }, [roomName, playerName]);

  const handleEndGame = () => {
    try {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ type: 'end_game' }));
      }
    } catch (error) {
      console.log('Error ending game:', error);
      setError('Failed to end game. Please try again.');
    }
  };

  const handleRestartGame = () => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'restart_game' }));
    }
  };

  const handleBackToWaiting = () => {
    navigate(`/waiting/${roomName}/${playerName}`);
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return '#28a745';
      case 'connecting': return '#ffc107';
      case 'disconnected': return '#dc3545';
      case 'error': return '#dc3545';
      default: return '#6c757d';
    }
  };

  if (roomData?.state === 'intermission') {
    return (
      <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '2rem'
        }}>
          <h1>Game Over - Room: {roomName}</h1>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem',
            fontSize: '0.9rem'
          }}>
            <div 
              style={{ 
                width: '10px', 
                height: '10px', 
                borderRadius: '50%', 
                backgroundColor: getConnectionStatusColor() 
              }}
            />
            {connectionStatus}
          </div>
        </div>

        <div style={{ 
          textAlign: 'center',
          padding: '2rem',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          marginBottom: '2rem'
        }}>
          <h2>🎉 Game Finished!</h2>
          <p>The game has ended. You can start a new game or return to the waiting room.</p>
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button
            onClick={handleRestartGame}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Start New Game
          </button>
          <button
            onClick={handleBackToWaiting}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Back to Waiting
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '2rem'
      }}>
        <h1>Game in Progress - Room: {roomName}</h1>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem',
          fontSize: '0.9rem'
        }}>
          <div 
            style={{ 
              width: '10px', 
              height: '10px', 
              borderRadius: '50%', 
              backgroundColor: getConnectionStatusColor() 
            }}
          />
          {connectionStatus}
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <strong>You are: {playerName}</strong>
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

      {roomData ? (
        <div>
          <h2>Players in Game</h2>
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

          <div style={{ 
            textAlign: 'center',
            padding: '3rem',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            marginBottom: '2rem'
          }}>
            <h2>🃏 Game Area</h2>
            <p style={{ fontSize: '1.1rem', marginBottom: '2rem' }}>
              Game logic will be implemented here in the future.
            </p>
            <p style={{ color: '#666' }}>
              This is a placeholder for the actual poker game interface.
            </p>
          </div>

          <div style={{ textAlign: 'center' }}>
            <button
              onClick={handleEndGame}
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '1rem',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              End Game (Demo)
            </button>
          </div>
        </div>
      ) : (
        <div>Loading game data...</div>
      )}
    </div>
  );
}

export default Game;