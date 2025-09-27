import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWebSocket } from '../hooks/useWebSocket';
import { useSounds } from '../hooks/useSounds';
import { statusColors, chipColors } from '../utils/constants';

function Game() {
  const { roomName, playerName } = useParams();
  const navigate = useNavigate();
  const [roomData, setRoomData] = useState(null);

  const getChipStyle = (chipColor, size = 30) => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: chipColors.backgrounds[chipColor] || chipColors.backgrounds.white,
    border: `2px solid ${chipColors.borders[chipColor] || chipColors.borders.white}`,
    borderRadius: '50%',
    fontWeight: 'bold',
    color: chipColors.text[chipColor] || chipColors.text.white,
    width: `${size}px`,
    height: `${size}px`,
    ...(size > 30 && { fontSize: '1rem', cursor: 'pointer' })
  });

  // Reusable chip component with mobile optimization
  const Chip = ({ chipColor, size, children, onClick, ...props }) => {
    // Default mobile-responsive size
    const defaultSize = isMobile ? 40 : 30;
    const chipSize = size || defaultSize;
    
    const style = {
      ...getChipStyle(chipColor, chipSize),
      // Ensure minimum touch target on mobile
      ...(isMobile && onClick && { 
        minWidth: '44px', 
        minHeight: '44px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      })
    };
    
    if (onClick) {
      return (
        <button onClick={onClick} style={style} {...props}>
          {children}
        </button>
      );
    }
    return (
      <div style={style} {...props}>
        {children}
      </div>
    );
  };

  // Responsive styles with mobile optimizations
  const isMobile = window.innerWidth <= 768;
  
  const styles = {
    section: { 
      marginBottom: isMobile ? '1rem' : '1.5rem', 
      padding: isMobile ? '0.5rem' : '0.75rem', 
      borderRadius: '8px' 
    },
    centerText: { textAlign: 'center' },
    button: { 
      padding: isMobile ? '0.75rem 1rem' : '0.75rem 1.5rem', 
      color: 'white', 
      border: 'none', 
      borderRadius: '4px', 
      cursor: 'pointer', 
      fontSize: isMobile ? '0.9rem' : '1rem',
      minHeight: '44px', // Touch target size
      minWidth: isMobile ? '100px' : 'auto'
    },
    smallButton: { 
      padding: isMobile ? '0.5rem 0.75rem' : '0.25rem 0.5rem', 
      fontSize: isMobile ? '0.8rem' : '0.7rem', 
      border: 'none', 
      borderRadius: '4px', 
      cursor: 'pointer',
      minHeight: '44px', // Touch target size
      minWidth: '60px'
    },
    mobileTable: {
      display: isMobile ? 'block' : 'table',
      width: '100%'
    },
    mobileTableRow: {
      display: isMobile ? 'block' : 'table-row',
      marginBottom: isMobile ? '1rem' : '0',
      padding: isMobile ? '0.75rem' : '0',
      backgroundColor: isMobile ? '#f8f9fa' : 'transparent',
      borderRadius: isMobile ? '8px' : '0',
      border: isMobile ? '1px solid #dee2e6' : 'none'
    },
    mobileTableCell: {
      display: isMobile ? 'block' : 'table-cell',
      padding: isMobile ? '0.5rem 0' : '0.75rem',
      borderBottom: isMobile ? 'none' : '1px solid #dee2e6'
    }
  };

  const { playChipTaken, playChipStolen, playNextRound } = useSounds();

  const handleMessage = useCallback((data) => {
    switch (data.type) {
      case 'room_update':
      case 'game_started':
        setRoomData(data.room_data);
        break;
      case 'game_update':
        // Detect game state changes for sound effects
        setRoomData(prevData => {
          const prevRound = prevData?.poker_game?.round;
          const newRound = data.room_data?.poker_game?.round;
          
          // Play next round sound when round advances (but not on initial game start)
          if (prevRound && newRound && prevRound !== newRound) {
            playNextRound();
          }
          
          return data.room_data;
        });
        break;
      case 'game_ended':
        setRoomData(data.room_data);
        break;
      case 'error':
        console.error('Game error:', data.message);
        // We'll handle the error through the WebSocket hook's error state
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  }, [playNextRound]);

  const { connectionStatus, error, setError, sendMessage } = useWebSocket(roomName, playerName, handleMessage);

  const sendGameMessage = (type, extraData = {}) => {
    const success = sendMessage({ type, ...extraData });
    if (!success) {
      setError(`Failed to ${type.replace('_', ' ')}. Please try again.`);
    }
  };

  const handleEndGame = () => sendGameMessage('end_game');
  const handleRestartGame = () => sendGameMessage('restart_game');
  const handleBackToHome = () => navigate('/');
  const handleTakeChipFromPublic = (chipNumber) => {
    sendGameMessage('take_chip_public', { chip_number: chipNumber });
    playChipTaken();
  };
  
  const handleTakeChipFromPlayer = (targetPlayer) => {
    sendGameMessage('take_chip_player', { target_player: targetPlayer });
    playChipStolen();
  };
  
  const handleReturnChip = () => {
    sendGameMessage('return_chip');
    playChipTaken();
  };
  
  const handleAdvanceRound = () => {
    sendGameMessage('advance_round');
    // Sound will be played by handleMessage when round change is detected
  };

  const handleDistributeChips = () => {
    // Dev helper: server-side distribution of chips to all players
    sendGameMessage('dev_distribute_chips');
  };



  return (
    <div style={{ padding: isMobile ? '0.5rem' : '1rem 2rem', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: isMobile ? '0.25rem' : '0.5rem',
        padding: isMobile ? '0.25rem 0' : '0'
      }}>
        <h1 style={{
          fontSize: isMobile ? '1rem' : '1.5rem',
          margin: '0',
          fontWeight: 'bold'
        }}>Room: {roomName}</h1>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: isMobile ? '0.5rem' : '1rem',
          fontSize: isMobile ? '0.75rem' : '0.9rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div 
              style={{ 
                width: '10px', 
                height: '10px', 
                borderRadius: '50%', 
                backgroundColor: statusColors[connectionStatus] || statusColors.default 
              }}
            />
            {connectionStatus}
          </div>
          {roomData?.poker_game?.round !== 'scoring' && (
            <button
              onClick={handleEndGame}
              style={{
                padding: isMobile ? '0.25rem 0.5rem' : '0.5rem 1rem',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.8rem'
              }}
            >
              End Game
            </button>
          )}
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

          {/* Cards Section - Pocket Cards (left) and Community Cards (right) */}
          {(roomData.poker_game.pocket_cards?.length > 0 || roomData.poker_game.community_cards.length > 0) && (
            <div style={{ 
              display: 'flex',
              flexDirection: 'column',
              gap: isMobile ? '0.5rem' : '1rem',
              marginBottom: isMobile ? '1rem' : '1.5rem'
            }}>
              {/* Pocket Cards */}
              {roomData.poker_game.pocket_cards && roomData.poker_game.pocket_cards.length > 0 && (
                <div style={{ 
                  padding: isMobile ? '0.5rem' : '0.75rem',
                  backgroundColor: '#fff3cd',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <h3 style={{ fontSize: isMobile ? '0.9rem' : '1.1rem', margin: '0 0 0.5rem 0' }}>Pocket Cards</h3>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                    {roomData.poker_game.pocket_cards.map((card, index) => (
                      <div key={index} style={{
                        padding: isMobile ? '0.3rem' : '0.5rem',
                        backgroundColor: 'white',
                        border: '2px solid #ffc107',
                        borderRadius: '4px',
                        minWidth: isMobile ? '35px' : '40px',
                        textAlign: 'center',
                        fontSize: isMobile ? '0.8rem' : '1rem'
                      }}>
                        {card.rank_str}{card.suit === 'hearts' ? '♥️' : card.suit === 'diamonds' ? '♦️' : card.suit === 'clubs' ? '♣️' : '♠️'}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Community Cards */}
              {roomData.poker_game.community_cards.length > 0 && (
                <div style={{ 
                  padding: isMobile ? '0.5rem' : '0.75rem',
                  backgroundColor: '#e8f5e8',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <h3 style={{ fontSize: isMobile ? '0.9rem' : '1.1rem', margin: '0 0 0.5rem 0' }}>Community Cards</h3>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    {roomData.poker_game.community_cards.map((card, index) => (
                      <div key={index} style={{
                        padding: isMobile ? '0.3rem' : '0.5rem',
                        backgroundColor: 'white',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        minWidth: isMobile ? '35px' : '40px',
                        textAlign: 'center',
                        fontSize: isMobile ? '0.8rem' : '1rem'
                      }}>
                        {card.rank_str}{card.suit === 'hearts' ? '♥️' : card.suit === 'diamonds' ? '♦️' : card.suit === 'clubs' ? '♣️' : '♠️'}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Available Chips / Scoring Results */}
          {roomData.poker_game.round === 'scoring' && roomData.poker_game.scoring ? (
            <div style={{
              ...styles.section,
              padding: '0.5rem 1rem',
              backgroundColor: roomData.poker_game.scoring.win ? '#d4edda' : '#f8d7da',
              border: `2px solid ${roomData.poker_game.scoring.win ? '#c3e6cb' : '#f5c6cb'}`
            }}>
              <h2 style={{ 
                ...styles.centerText,
                color: roomData.poker_game.scoring.win ? '#155724' : '#721c24',
                marginBottom: isMobile ? '0.25rem' : '0.5rem',
                fontSize: isMobile ? '1rem' : '1.5rem'
              }}>
                {roomData.poker_game.scoring.win ? '🎉 TEAM VICTORY! 🎉' : '💔 TEAM DEFEAT 💔'}
              </h2>
              
              {(() => {
                // Create array of players with their data, sorted by red chip number
                const playersWithData = roomData.poker_game.scoring.ranked_players.map(([player, hand], actualRankIndex) => ({
                  player,
                  hand,
                  actualRank: actualRankIndex + 1,
                  redChip: roomData.poker_game.scoring.red_chip_assignments[player],
                  allCards: roomData.poker_game.scoring.player_all_cards[player]
                }));
                
                // Sort by red chip number
                playersWithData.sort((a, b) => a.redChip - b.redChip);
                
                // Helper function to check if a card is used in the best hand
                const isCardUsed = (card, bestHandCards) => {
                  return bestHandCards.some(handCard => 
                    handCard.rank === card.rank && handCard.suit === card.suit
                  );
                };
                
                return (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      backgroundColor: 'white',
                      borderRadius: '8px',
                      overflow: 'hidden'
                    }}>
                      <tbody>
                        {playersWithData.map(({ player, hand, actualRank, redChip, allCards }) => {
                          const isCorrectPosition = redChip === actualRank;
                          
                          return (
                            <React.Fragment key={player}>
                              {/* Player and Hand Type Row */}
                              <tr style={{ backgroundColor: '#f8f9fa' }}>
                                <td style={{ 
                                  padding: '0.5rem', 
                                  fontWeight: 'bold', 
                                  borderBottom: '1px solid #dee2e6',
                                  verticalAlign: 'middle'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      backgroundColor: '#dc3545',
                                      color: 'white',
                                      borderRadius: '50%',
                                      fontSize: '0.8rem',
                                      fontWeight: 'bold',
                                      width: '24px',
                                      height: '24px'
                                    }}>
                                      {redChip}
                                    </div>
                                    {player}{player === playerName && ' (You)'}
                                  </div>
                                </td>
                                <td style={{ 
                                  padding: '0.5rem', 
                                  textAlign: 'center', 
                                  borderBottom: '1px solid #dee2e6',
                                  fontWeight: 'bold',
                                  fontSize: isMobile ? '0.9rem' : '1rem'
                                }}>
                                  {hand.rank_display}
                                </td>
                              </tr>
                              
                              {/* Cards Row */}
                              <tr>
                                <td colSpan="2" style={{ 
                                  padding: '0.5rem', 
                                  borderBottom: '1px solid #dee2e6',
                                  textAlign: 'center'
                                }}>
                                  <div style={{ 
                                    display: 'flex', 
                                    gap: '0.25rem', 
                                    justifyContent: 'center', 
                                    flexWrap: 'wrap',
                                    alignItems: 'center'
                                  }}>
                                    {/* Pocket Cards */}
                                    {allCards.pocket_cards.map((card, i) => {
                                      const isUsed = isCardUsed(card, hand.cards);
                                      return (
                                        <div key={`pocket-${i}`} style={{
                                          padding: isMobile ? '0.2rem 0.3rem' : '0.25rem 0.4rem',
                                          backgroundColor: 'white',
                                          border: '2px solid #ffc107',
                                          borderRadius: '3px',
                                          fontSize: isMobile ? '0.7rem' : '0.8rem',
                                          color: ['hearts', 'diamonds'].includes(card.suit) ? 'red' : 'black',
                                          fontWeight: 'bold',
                                          opacity: isUsed ? 1 : 0.3
                                        }}>
                                          {card.rank_str}{card.suit === 'hearts' ? '♥️' : card.suit === 'diamonds' ? '♦️' : card.suit === 'clubs' ? '♣️' : '♠️'}
                                        </div>
                                      );
                                    })}
                                    
                                    {/* Spacing between pocket and community cards */}
                                    <div style={{ width: '0.75rem' }}></div>
                                    
                                    {/* Community Cards */}
                                    {allCards.community_cards.map((card, i) => {
                                      const isUsed = isCardUsed(card, hand.cards);
                                      return (
                                        <div key={`community-${i}`} style={{
                                          padding: isMobile ? '0.2rem 0.3rem' : '0.25rem 0.4rem',
                                          backgroundColor: 'white',
                                          border: '1px solid #28a745',
                                          borderRadius: '3px',
                                          fontSize: isMobile ? '0.7rem' : '0.8rem',
                                          color: ['hearts', 'diamonds'].includes(card.suit) ? 'red' : 'black',
                                          fontWeight: 'bold',
                                          opacity: isUsed ? 1 : 0.3
                                        }}>
                                          {card.rank_str}{card.suit === 'hearts' ? '♥️' : card.suit === 'diamonds' ? '♦️' : card.suit === 'clubs' ? '♣️' : '♠️'}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </td>
                              </tr>
                              
                              {/* Guessed vs Actual Row */}
                              <tr style={{ backgroundColor: '#f8f9fa' }}>
                                <td style={{ 
                                  padding: '0.5rem', 
                                  borderBottom: player === playersWithData[playersWithData.length - 1].player ? 'none' : '2px solid #dee2e6',
                                  fontWeight: 'bold',
                                  fontSize: isMobile ? '0.8rem' : '0.9rem',
                                  textAlign: 'left'
                                }}>
                                  Guessed: #{redChip}
                                </td>
                                <td style={{ 
                                  padding: '0.5rem', 
                                  borderBottom: player === playersWithData[playersWithData.length - 1].player ? 'none' : '2px solid #dee2e6',
                                  fontWeight: 'bold',
                                  fontSize: isMobile ? '0.8rem' : '0.9rem',
                                  color: isCorrectPosition ? '#28a745' : '#dc3545',
                                  textAlign: 'left'
                                }}>
                                  Actual: #{actualRank}
                                </td>
                              </tr>
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div style={{ 
              ...styles.section,
              backgroundColor: '#f8f9fa'
            }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
                {roomData.poker_game.available_chips.length > 0 ? (
                  roomData.poker_game.available_chips.map((chipNumber) => (
                    <Chip
                      key={chipNumber}
                      chipColor={roomData.poker_game.current_chip_color}
                      size={40}
                      onClick={() => handleTakeChipFromPublic(chipNumber)}
                    >
                      {chipNumber}
                    </Chip>
                  ))
                ) : (
                  <div style={{ 
                    textAlign: 'center',
                    color: '#6c757d',
                    fontStyle: 'italic',
                    padding: '0.75rem',
                    width: '100%'
                  }}>
                    All chips have been taken
                    {roomData.poker_game.can_advance && (
                      <div style={{ marginTop: '1rem' }}>
                        <button
                          onClick={handleAdvanceRound}
                          style={{
                            padding: '0.75rem 1.5rem',
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '1rem'
                          }}
                        >
                          {roomData.poker_game.round === 'river' ? 'Go to Scoring' : 'Next Round'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {/* Dev helper link */}
              {process.env.NODE_ENV === 'development' && roomData.poker_game.available_chips.length > 0 && (
                <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                  <button
                    onClick={handleDistributeChips}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#999',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      fontSize: isMobile ? '0.7rem' : '0.8rem',
                      padding: '0.25rem'
                    }}
                  >
                    [dev] distribute chips to all players
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Bidding History - All Players and All Rounds */}
          <div style={{ 
            ...styles.section,
            backgroundColor: '#e7f3ff'
          }}>
            {isMobile ? (
              // Mobile card layout
              <div>
                {roomData.players.map((player, index) => {
                  const isCurrentPlayer = player === playerName;
                  return (
                    <div key={player} style={{
                      ...styles.mobileTableRow,
                      marginBottom: '0.5rem',
                      position: 'relative'
                    }}>
                      {/* Player name and history chips on same row */}
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        marginBottom: '0.25rem',
                        gap: '0.5rem'
                      }}>
                        <div style={{ 
                          fontWeight: 'bold', 
                          fontSize: isMobile ? '0.8rem' : '1.1rem',
                          color: isCurrentPlayer ? '#007bff' : '#333',
                          flex: '0 0 auto',
                          minWidth: '60px',
                          textAlign: 'left'
                        }}>
                          {player}{isCurrentPlayer && ' (You)'}
                        </div>
                        
                        {/* History chips inline with colored backgrounds */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem', flex: '1', justifyContent: 'flex-end' }}>
                          <div style={{ 
                            width: '26px', 
                            height: '26px', 
                            backgroundColor: '#f1f3f4', 
                            borderRadius: '3px',
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center' 
                          }}>
                            {roomData.poker_game.chip_history[player].white ? (
                              <Chip chipColor="white" size={20}>
                                {roomData.poker_game.chip_history[player].white}
                              </Chip>
                            ) : (
                              <span style={{ color: '#ccc', fontSize: '0.6rem' }}>-</span>
                            )}
                          </div>
                          
                          <div style={{ 
                            width: '26px', 
                            height: '26px', 
                            backgroundColor: '#fff3cd', 
                            borderRadius: '3px',
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center' 
                          }}>
                            {roomData.poker_game.chip_history[player].yellow ? (
                              <Chip chipColor="yellow" size={20}>
                                {roomData.poker_game.chip_history[player].yellow}
                              </Chip>
                            ) : (
                              <span style={{ color: '#ccc', fontSize: '0.6rem' }}>-</span>
                            )}
                          </div>
                          
                          <div style={{ 
                            width: '26px', 
                            height: '26px', 
                            backgroundColor: '#ffeaa7', 
                            borderRadius: '3px',
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center' 
                          }}>
                            {roomData.poker_game.chip_history[player].orange ? (
                              <Chip chipColor="orange" size={20}>
                                {roomData.poker_game.chip_history[player].orange}
                              </Chip>
                            ) : (
                              <span style={{ color: '#ccc', fontSize: '0.6rem' }}>-</span>
                            )}
                          </div>
                          
                          <div style={{ 
                            width: '26px', 
                            height: '26px', 
                            backgroundColor: '#f8d7da', 
                            borderRadius: '3px',
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center' 
                          }}>
                            {roomData.poker_game.chip_history[player].red ? (
                              <Chip chipColor="red" size={20}>
                                {roomData.poker_game.chip_history[player].red}
                              </Chip>
                            ) : (
                              <span style={{ color: '#ccc', fontSize: '0.6rem' }}>-</span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Current chip and action on one row */}
                      {roomData.poker_game.round !== 'scoring' && (
                      <div style={{ 
                        marginTop: '0.25rem', 
                        padding: '0.25rem', 
                        backgroundColor: '#e9ecef', 
                        borderRadius: '4px',
                        minHeight: '36px',
                        display: 'flex',
                        alignItems: 'center'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%' }}>
                          {(() => {
                            const currentChip = roomData.poker_game.player_chips[player];
                            
                            if (currentChip) {
                              return (
                                <>
                                  <Chip chipColor={roomData.poker_game.current_chip_color} size={24}>
                                    {currentChip}
                                  </Chip>
                                  {!isCurrentPlayer ? (
                                    <button
                                      onClick={() => handleTakeChipFromPlayer(player)}
                                      style={{
                                        padding: '0.25rem 0.5rem',
                                        fontSize: '0.7rem',
                                        backgroundColor: '#28a745',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        minHeight: '28px'
                                      }}
                                    >
                                      Take
                                    </button>
                                  ) : (
                                    <button
                                      onClick={handleReturnChip}
                                      style={{
                                        padding: '0.25rem 0.5rem',
                                        fontSize: '0.7rem',
                                        backgroundColor: '#ffc107',
                                        color: 'black',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        minHeight: '28px'
                                      }}
                                    >
                                      Return
                                    </button>
                                  )}
                                </>
                              );
                            } else {
                              return roomData.poker_game.recent_steal_event && 
                                     roomData.poker_game.recent_steal_event.taken_from === player ? (
                                <>
                                  <div style={{ transform: 'scale(0.5)', opacity: 0.8 }}>
                                    <Chip chipColor={roomData.poker_game.recent_steal_event.chip_color} size={24}>
                                      {roomData.poker_game.recent_steal_event.chip_number}
                                    </Chip>
                                  </div>
                                  <span style={{ color: '#666', fontStyle: 'italic', fontSize: '0.7rem' }}>
                                    stolen by {roomData.poker_game.recent_steal_event.taken_by}
                                  </span>
                                </>
                              ) : (
                                <span style={{ color: '#666', fontStyle: 'italic', fontSize: '0.7rem' }}>No chip</span>
                              );
                            }
                          })()}
                        </div>
                      </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              // Desktop table layout
              <div style={{ overflowX: 'auto' }}>
                <table style={{
                  ...styles.mobileTable,
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
                    const currentRound = roomData.poker_game.round;
                    
                    // Helper function to determine if a round should show in history
                    const shouldShowInHistory = (roundColor) => {
                      const roundOrder = ['preflop', 'flop', 'turn', 'river', 'scoring'];
                      const colorToRound = { white: 'preflop', yellow: 'flop', orange: 'turn', red: 'river' };
                      const historyRound = colorToRound[roundColor];
                      const currentRoundIndex = roundOrder.indexOf(currentRound);
                      const historyRoundIndex = roundOrder.indexOf(historyRound);
                      return historyRoundIndex < currentRoundIndex;
                    };
                    
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
                          {playerHistory.white && shouldShowInHistory('white') ? (
                            <Chip chipColor="white">
                              {playerHistory.white}
                            </Chip>
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
                          {playerHistory.yellow && shouldShowInHistory('yellow') ? (
                            <Chip chipColor="yellow">
                              {playerHistory.yellow}
                            </Chip>
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
                          {playerHistory.orange && shouldShowInHistory('orange') ? (
                            <Chip chipColor="orange">
                              {playerHistory.orange}
                            </Chip>
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
                          {playerHistory.red && shouldShowInHistory('red') ? (
                            <Chip chipColor="red">
                              {playerHistory.red}
                            </Chip>
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
                          <div>
                            {currentChip ? (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                <Chip chipColor={roomData.poker_game.current_chip_color}>
                                  {currentChip}
                                </Chip>
                                {!isCurrentPlayer && (
                                  <button
                                    onClick={() => handleTakeChipFromPlayer(player)}
                                    style={{
                                      ...styles.smallButton,
                                      backgroundColor: '#28a745',
                                      color: 'white'
                                    }}
                                  >
                                    Take
                                  </button>
                                )}
                                {isCurrentPlayer && (
                                  <button
                                    onClick={handleReturnChip}
                                    style={{
                                      ...styles.smallButton,
                                      backgroundColor: '#ffc107',
                                      color: 'black'
                                    }}
                                  >
                                    Return
                                  </button>
                                )}
                              </div>
                            ) : (
                              roomData.poker_game.recent_steal_event && 
                              roomData.poker_game.recent_steal_event.taken_from === player ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0' }}>
                                  <div style={{ transform: 'scale(0.5)', opacity: 0.8 }}>
                                    <Chip chipColor={roomData.poker_game.recent_steal_event.chip_color}>
                                      {roomData.poker_game.recent_steal_event.chip_number}
                                    </Chip>
                                  </div>
                                  <span style={{ color: '#666', fontStyle: 'italic' }}>
                                    stolen by {roomData.poker_game.recent_steal_event.taken_by}
                                  </span>
                                </div>
                              ) : (
                                <span style={{ color: '#666', fontStyle: 'italic' }}>No chip</span>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            )}
          </div>

          {/* Scoring Actions */}
          {roomData.poker_game.round === 'scoring' && (
            <div style={{ 
              ...styles.section,
              ...styles.centerText,
              backgroundColor: '#f8f9fa'
            }}>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={handleRestartGame}
                  style={{
                    ...styles.button,
                    backgroundColor: '#28a745'
                  }}
                >
                  Start New Game
                </button>
                <button
                  onClick={handleBackToHome}
                  style={{
                    ...styles.button,
                    backgroundColor: '#6c757d'
                  }}
                >
                  Back to Home
                </button>
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