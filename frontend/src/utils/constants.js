// API and WebSocket configuration
export const API_BASE = 'http://localhost:8000';
export const WS_BASE = 'ws://localhost:8000';

// Chip colors
export const chipColors = {
  backgrounds: {
    white: '#f8f9fa',
    yellow: '#fff3cd',
    orange: '#ffcc80',  // More orange background
    red: '#f8d7da'
  },
  borders: {
    white: '#6c757d',
    yellow: '#e0a800',
    orange: '#e65100',  // More orange border
    red: '#b02a37'
  },
  text: {
    white: '#343a40',
    yellow: '#856404',
    orange: '#bf360c',  // More orange text
    red: '#721c24'
  }
};

// Common styles
export const commonStyles = {
  container: {
    padding: '2rem',
    maxWidth: '600px', 
    margin: '0 auto'
  },
  button: {
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  smallButton: {
    padding: '0.5rem 1rem',
    fontSize: '0.9rem',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  input: {
    width: '100%',
    padding: '0.5rem',
    fontSize: '1rem',
    marginBottom: '0.5rem'
  },
  errorBox: {
    color: 'red',
    marginBottom: '1rem',
    padding: '0.5rem',
    border: '1px solid red',
    borderRadius: '4px'
  },
  statusIndicator: {
    width: '10px',
    height: '10px',
    borderRadius: '50%'
  }
};

// Status colors
export const statusColors = {
  connected: '#28a745',
  connecting: '#ffc107', 
  disconnected: '#dc3545',
  error: '#dc3545',
  default: '#6c757d'
};

// Button colors
export const buttonColors = {
  primary: '#007bff',
  success: '#28a745',
  danger: '#dc3545',
  secondary: '#6c757d',
  warning: '#ffc107'
};