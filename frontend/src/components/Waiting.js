import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const WS_BASE = 'ws://localhost:8000';

function Waiting() {
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
        console.log('WebSocket connected');
        setConnectionStatus('connected');
        setError('');
        isClosing.current = false;
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message:', data);

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
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.current.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setConnectionStatus('disconnected');
        
        if (event.code !== 1000) {
          setTimeout(connectWebSocket, 3000);
        }
      };

      ws.current.onerror = (event) => {
        console.error('WebSocket error:', event);
        setConnectionStatus('error');
        setError('Connection error occurred');
      };
    };

    connectWebSocket();

    const handleBeforeUnload = () => {
      try {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({ type: 'leave_room' }));
        }
      } catch (error) {
        console.log('Error in beforeunload (safe to ignore):', error);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
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
  }, [roomName, playerName, navigate]);

  const handleStartGame = () => {
    try {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ type: 'start_game' }));
      }
    } catch (error) {
      console.log('Error starting game:', error);
      setError('Failed to start game. Please try again.');
    }
  };

  const handleLeaveRoom = () => {
    try {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ type: 'leave_room' }));
      } else {
        navigate('/');
      }
    } catch (error) {
      console.log('Error leaving room, navigating anyway:', error);
      navigate('/');
    }
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

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
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
                      padding: '0.75rem 1.5rem',
                      fontSize: '1rem',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
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
              padding: '0.5rem 1rem',
              fontSize: '0.9rem',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
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