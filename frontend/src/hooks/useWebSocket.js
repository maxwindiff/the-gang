import { useRef, useEffect, useState } from 'react';
import { WS_BASE } from '../utils/constants';

export const useWebSocket = (roomName, playerName, onMessage) => {
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [error, setError] = useState('');
  const ws = useRef(null);
  const isClosing = useRef(false);
  const heartbeatInterval = useRef(null);

  useEffect(() => {
    const startHeartbeat = () => {
      heartbeatInterval.current = setInterval(() => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000); // Send ping every 30 seconds
    };

    const stopHeartbeat = () => {
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
        heartbeatInterval.current = null;
      }
    };

    const connectWebSocket = () => {
      ws.current = new WebSocket(`${WS_BASE}/ws/game/${roomName}/${playerName}/`);

      ws.current.onopen = () => {
        console.log('WebSocket connected');
        setConnectionStatus('connected');
        setError('');
        isClosing.current = false;
        startHeartbeat();
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message:', data);
          
          // Handle pong messages silently
          if (data.type === 'pong') {
            return;
          }
          
          onMessage(data);
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.current.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setConnectionStatus('disconnected');
        stopHeartbeat();
        
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

    return () => {
      stopHeartbeat();
      if (ws.current && !isClosing.current) {
        try {
          if (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING) {
            isClosing.current = true;
            ws.current.close(1001, 'Component unmounting');
          }
        } catch (error) {
          console.log('WebSocket close error (safe to ignore):', error);
        }
      }
    };
  }, [roomName, playerName, onMessage]);

  const sendMessage = (message) => {
    try {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify(message));
        return true;
      }
      return false;
    } catch (error) {
      console.log('Error sending message:', error);
      setError('Failed to send message. Please try again.');
      return false;
    }
  };

  return {
    connectionStatus,
    error,
    setError,
    sendMessage
  };
};