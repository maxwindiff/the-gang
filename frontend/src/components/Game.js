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
            case 'game_started':
              setRoomData(data.room_data);
              break;
            case 'game_update':
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
    try {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ type: 'restart_game' }));
      }
    } catch (error) {
      console.log('Error restarting game:', error);
      setError('Failed to restart game. Please try again.');
    }
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  const handleTakeChipFromPublic = (chipNumber) => {
    try {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ 
          type: 'take_chip_public', 
          chip_number: chipNumber 
        }));
      }
    } catch (error) {
      console.log('Error taking chip from public:', error);
      setError('Failed to take chip. Please try again.');
    }
  };

  const handleTakeChipFromPlayer = (targetPlayer) => {
    try {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ 
          type: 'take_chip_player', 
          target_player: targetPlayer 
        }));
      }
    } catch (error) {
      console.log('Error taking chip from player:', error);
      setError('Failed to take chip. Please try again.');
    }
  };

  const handleReturnChip = () => {
    try {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ type: 'return_chip' }));
      }
    } catch (error) {
      console.log('Error returning chip:', error);
      setError('Failed to return chip. Please try again.');
    }
  };

  const handleAdvanceRound = () => {
    try {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ type: 'advance_round' }));
      }
    } catch (error) {
      console.log('Error advancing round:', error);
      setError('Failed to advance round. Please try again.');
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
          <p>The game has ended. You can start a new game or return to the home page.</p>
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
            onClick={handleBackToHome}
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
            Back to Home
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

      {roomData && roomData.poker_game ? (
        <div>

          {/* Community Cards */}
          {roomData.poker_game.community_cards.length > 0 && (
            <div style={{ 
              textAlign: 'center',
              marginBottom: '2rem',
              padding: '1rem',
              backgroundColor: '#e8f5e8',
              borderRadius: '8px'
            }}>
              <h3>Community Cards</h3>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                {roomData.poker_game.community_cards.map((card, index) => (
                  <div key={index} style={{
                    padding: '0.5rem',
                    backgroundColor: 'white',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    minWidth: '40px',
                    textAlign: 'center'
                  }}>
                    {card.rank_str}{card.suit === 'hearts' ? '♥️' : card.suit === 'diamonds' ? '♦️' : card.suit === 'clubs' ? '♣️' : '♠️'}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pocket Cards */}
          {roomData.poker_game.pocket_cards && roomData.poker_game.pocket_cards.length > 0 && (
            <div style={{ 
              textAlign: 'center',
              marginBottom: '2rem',
              padding: '1rem',
              backgroundColor: '#fff3cd',
              borderRadius: '8px'
            }}>
              <h3>Your Pocket Cards</h3>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                {roomData.poker_game.pocket_cards.map((card, index) => (
                  <div key={index} style={{
                    padding: '0.5rem',
                    backgroundColor: 'white',
                    border: '2px solid #ffc107',
                    borderRadius: '4px',
                    minWidth: '40px',
                    textAlign: 'center'
                  }}>
                    {card.rank_str}{card.suit === 'hearts' ? '♥️' : card.suit === 'diamonds' ? '♦️' : card.suit === 'clubs' ? '♣️' : '♠️'}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Available Chips */}
          {roomData.poker_game.available_chips.length > 0 && (
            <div style={{ 
              marginBottom: '2rem',
              padding: '1rem',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px'
            }}>
              <h3>Available Chips (Public Area)</h3>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                {roomData.poker_game.available_chips.map((chipNumber) => (
                  <button
                    key={chipNumber}
                    onClick={() => handleTakeChipFromPublic(chipNumber)}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: roomData.poker_game.current_chip_color === 'white' ? '#f8f9fa' :
                                     roomData.poker_game.current_chip_color === 'yellow' ? '#fff3cd' :
                                     roomData.poker_game.current_chip_color === 'orange' ? '#ffeaa7' :
                                     roomData.poker_game.current_chip_color === 'red' ? '#f8d7da' : '#f8f9fa',
                      border: '2px solid #dee2e6',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      minWidth: '40px',
                      minHeight: '40px'
                    }}
                  >
                    {chipNumber}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Bidding History - All Players and All Rounds */}
          <div style={{ 
            marginBottom: '2rem',
            padding: '1rem',
            backgroundColor: '#e7f3ff',
            borderRadius: '8px'
          }}>
            <h3>📈 Bidding History (All Rounds)</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse',
                backgroundColor: 'white',
                borderRadius: '8px',
                overflow: 'hidden'
              }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa' }}>
                    <th style={{ 
                      padding: '0.75rem', 
                      textAlign: 'left', 
                      borderBottom: '2px solid #dee2e6',
                      fontWeight: 'bold'
                    }}>
                      Player
                    </th>
                    <th style={{ 
                      padding: '0.75rem', 
                      textAlign: 'center', 
                      borderBottom: '2px solid #dee2e6',
                      backgroundColor: '#f8f9fa',
                      fontWeight: 'bold'
                    }}>
                      Pre-flop<br/><span style={{ fontSize: '0.8em', color: '#666' }}>White</span>
                    </th>
                    <th style={{ 
                      padding: '0.75rem', 
                      textAlign: 'center', 
                      borderBottom: '2px solid #dee2e6',
                      backgroundColor: '#fff3cd',
                      fontWeight: 'bold'
                    }}>
                      Flop<br/><span style={{ fontSize: '0.8em', color: '#666' }}>Yellow</span>
                    </th>
                    <th style={{ 
                      padding: '0.75rem', 
                      textAlign: 'center', 
                      borderBottom: '2px solid #dee2e6',
                      backgroundColor: '#ffeaa7',
                      fontWeight: 'bold'
                    }}>
                      Turn<br/><span style={{ fontSize: '0.8em', color: '#666' }}>Orange</span>
                    </th>
                    <th style={{ 
                      padding: '0.75rem', 
                      textAlign: 'center', 
                      borderBottom: '2px solid #dee2e6',
                      backgroundColor: '#f8d7da',
                      fontWeight: 'bold'
                    }}>
                      River<br/><span style={{ fontSize: '0.8em', color: '#666' }}>Red</span>
                    </th>
                    <th style={{ 
                      padding: '0.75rem', 
                      textAlign: 'center', 
                      borderBottom: '2px solid #dee2e6',
                      fontWeight: 'bold'
                    }}>
                      Current Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {roomData.players.map((player, index) => {
                    const isCurrentPlayer = player === playerName;
                    const playerHistory = roomData.poker_game.chip_history[player] || {};
                    const currentChip = roomData.poker_game.player_chips[player];
                    
                    return (
                      <tr key={player} style={{ 
                        backgroundColor: isCurrentPlayer ? '#e7f3ff' : (index % 2 === 0 ? 'white' : '#f9f9f9'),
                        border: isCurrentPlayer ? '2px solid #007bff' : 'none'
                      }}>
                        <td style={{ 
                          padding: '0.75rem', 
                          fontWeight: isCurrentPlayer ? 'bold' : 'normal',
                          borderBottom: '1px solid #dee2e6'
                        }}>
                          {player} {isCurrentPlayer && '(You)'}
                        </td>
                        
                        {/* Pre-flop (White) */}
                        <td style={{ 
                          padding: '0.75rem', 
                          textAlign: 'center',
                          borderBottom: '1px solid #dee2e6',
                          backgroundColor: '#f8f9fa'
                        }}>
                          {playerHistory.white ? (
                            <div style={{
                              display: 'inline-block',
                              padding: '0.25rem 0.5rem',
                              backgroundColor: 'white',
                              border: '2px solid #666',
                              borderRadius: '50%',
                              fontWeight: 'bold',
                              minWidth: '30px'
                            }}>
                              {playerHistory.white}
                            </div>
                          ) : (
                            <span style={{ color: '#ccc', fontStyle: 'italic' }}>-</span>
                          )}
                        </td>
                        
                        {/* Flop (Yellow) */}
                        <td style={{ 
                          padding: '0.75rem', 
                          textAlign: 'center',
                          borderBottom: '1px solid #dee2e6',
                          backgroundColor: '#fff3cd'
                        }}>
                          {playerHistory.yellow ? (
                            <div style={{
                              display: 'inline-block',
                              padding: '0.25rem 0.5rem',
                              backgroundColor: 'white',
                              border: '2px solid #ffc107',
                              borderRadius: '50%',
                              fontWeight: 'bold',
                              minWidth: '30px'
                            }}>
                              {playerHistory.yellow}
                            </div>
                          ) : (
                            <span style={{ color: '#ccc', fontStyle: 'italic' }}>-</span>
                          )}
                        </td>
                        
                        {/* Turn (Orange) */}
                        <td style={{ 
                          padding: '0.75rem', 
                          textAlign: 'center',
                          borderBottom: '1px solid #dee2e6',
                          backgroundColor: '#ffeaa7'
                        }}>
                          {playerHistory.orange ? (
                            <div style={{
                              display: 'inline-block',
                              padding: '0.25rem 0.5rem',
                              backgroundColor: 'white',
                              border: '2px solid #fd7e14',
                              borderRadius: '50%',
                              fontWeight: 'bold',
                              minWidth: '30px'
                            }}>
                              {playerHistory.orange}
                            </div>
                          ) : (
                            <span style={{ color: '#ccc', fontStyle: 'italic' }}>-</span>
                          )}
                        </td>
                        
                        {/* River (Red) */}
                        <td style={{ 
                          padding: '0.75rem', 
                          textAlign: 'center',
                          borderBottom: '1px solid #dee2e6',
                          backgroundColor: '#f8d7da'
                        }}>
                          {playerHistory.red ? (
                            <div style={{
                              display: 'inline-block',
                              padding: '0.25rem 0.5rem',
                              backgroundColor: 'white',
                              border: '2px solid #dc3545',
                              borderRadius: '50%',
                              fontWeight: 'bold',
                              minWidth: '30px'
                            }}>
                              {playerHistory.red}
                            </div>
                          ) : (
                            <span style={{ color: '#ccc', fontStyle: 'italic' }}>-</span>
                          )}
                        </td>
                        
                        {/* Current Action */}
                        <td style={{ 
                          padding: '0.75rem', 
                          textAlign: 'center',
                          borderBottom: '1px solid #dee2e6'
                        }}>
                          {currentChip ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                              <div style={{
                                padding: '0.25rem 0.5rem',
                                backgroundColor: roomData.poker_game.current_chip_color === 'white' ? '#f8f9fa' :
                                               roomData.poker_game.current_chip_color === 'yellow' ? '#fff3cd' :
                                               roomData.poker_game.current_chip_color === 'orange' ? '#ffeaa7' :
                                               roomData.poker_game.current_chip_color === 'red' ? '#f8d7da' : '#f8f9fa',
                                border: '2px solid #666',
                                borderRadius: '50%',
                                fontWeight: 'bold',
                                minWidth: '30px'
                              }}>
                                {currentChip}
                              </div>
                              {!isCurrentPlayer && (
                                <button
                                  onClick={() => handleTakeChipFromPlayer(player)}
                                  style={{
                                    padding: '0.25rem 0.5rem',
                                    fontSize: '0.7rem',
                                    backgroundColor: '#28a745',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Take
                                </button>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: '#666', fontStyle: 'italic' }}>No chip</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Player Actions */}
          <div style={{ 
            textAlign: 'center',
            marginBottom: '2rem',
            padding: '1rem',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px'
          }}>
            <h3>Your Actions</h3>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              {roomData.poker_game.player_chips[playerName] && (
                <button
                  onClick={handleReturnChip}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#ffc107',
                    color: 'black',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Return My Chip
                </button>
              )}
              
              {roomData.poker_game.can_advance && (
                <button
                  onClick={handleAdvanceRound}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  {roomData.poker_game.round === 'river' ? 'Go to Scoring' : 'Next Round'}
                </button>
              )}
              
              <button
                onClick={handleEndGame}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                End Game
              </button>
            </div>
          </div>

          {/* Scoring Results */}
          {roomData.poker_game.round === 'scoring' && roomData.poker_game.scoring && (
            <div style={{
              marginBottom: '2rem',
              padding: '2rem',
              backgroundColor: roomData.poker_game.scoring.win ? '#d4edda' : '#f8d7da',
              border: `2px solid ${roomData.poker_game.scoring.win ? '#c3e6cb' : '#f5c6cb'}`,
              borderRadius: '8px'
            }}>
              <h2 style={{ 
                textAlign: 'center', 
                color: roomData.poker_game.scoring.win ? '#155724' : '#721c24',
                marginBottom: '1.5rem'
              }}>
                {roomData.poker_game.scoring.win ? '🎉 TEAM VICTORY! 🎉' : '💔 TEAM DEFEAT 💔'}
              </h2>
              
              {/* Player Rankings */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ textAlign: 'center', marginBottom: '1rem' }}>Final Rankings (Weakest to Strongest)</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {roomData.poker_game.scoring.ranked_players.map(([player, hand], index) => {
                    const redChip = roomData.poker_game.scoring.red_chip_assignments[player];
                    const isCorrectPosition = redChip === index + 1;
                    
                    return (
                      <div key={player} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '1rem',
                        backgroundColor: 'white',
                        border: `2px solid ${isCorrectPosition ? '#28a745' : '#dc3545'}`,
                        borderRadius: '4px'
                      }}>
                        <div style={{ flex: 1 }}>
                          <strong>#{index + 1}: {player}</strong>
                          {player === playerName && ' (You)'}
                        </div>
                        <div style={{ flex: 2, textAlign: 'center' }}>
                          <div style={{ marginBottom: '0.5rem' }}><strong>{hand.rank_display}</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
                            {hand.cards.map((card, i) => (
                              <div key={i} style={{
                                padding: '0.25rem 0.5rem',
                                backgroundColor: 'white',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '0.9rem',
                                color: ['hearts', 'diamonds'].includes(card.suit) ? 'red' : 'black',
                                minWidth: '30px',
                                textAlign: 'center'
                              }}>
                                {card.rank_str}
                                <span style={{ fontSize: '0.8rem' }}>
                                  {card.suit === 'hearts' ? '♥' : 
                                   card.suit === 'diamonds' ? '♦' : 
                                   card.suit === 'clubs' ? '♣' : '♠'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div style={{ flex: 1, textAlign: 'right' }}>
                          <span style={{
                            padding: '0.25rem 0.5rem',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            borderRadius: '50%',
                            fontSize: '0.9rem'
                          }}>
                            Red #{redChip}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Game Status */}
          {roomData.poker_game.round !== 'scoring' && (
            <div style={{ 
              textAlign: 'center',
              padding: '0.5rem',
              backgroundColor: roomData.poker_game.all_players_have_chip ? '#d4edda' : '#fff3cd',
              border: `1px solid ${roomData.poker_game.all_players_have_chip ? '#c3e6cb' : '#ffeaa7'}`,
              borderRadius: '4px',
              marginBottom: '1rem'
            }}>
              {roomData.poker_game.all_players_have_chip ? 
                '✅ All players have chips! Ready to advance.' : 
                '⏳ Waiting for all players to get chips...'}
            </div>
          )}
        </div>
      ) : (
        <div>Loading game data...</div>
      )}
    </div>
  );
}

export default Game;