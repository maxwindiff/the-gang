# The Gang - Django ASGI + React Poker Game

A simple web-based poker variant with real-time multiplayer functionality.

## Features

- **Landing Page**: Join or create game rooms with alphanumeric names
- **Waiting Room**: Real-time player list updates via WebSocket
- **Game Flow**: Support for 3-6 players with state management
- **In-Memory Storage**: All game data stored server-side without external databases

## Room States

- **Waiting**: Players can join/leave, 3-6 players needed to start
- **Started**: Game in progress (placeholder implementation)
- **Intermission**: Game ended, can restart or return to waiting

## Setup

### Backend (Django ASGI)

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run Django development server with ASGI support
daphne -p 8000 thegang.asgi:application
```

### Frontend (React)

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start React development server
npm start
```

## Usage

1. Start both Django backend (port 8000) and React frontend (port 3000)
2. Open http://localhost:3000 in your browser
3. Enter your player name and room name
4. Wait for other players to join (3-6 players needed)
5. Any player can start the game when enough players are present

## Technical Implementation

- **Backend**: Django with Channels for WebSocket support
- **Frontend**: React with React Router for navigation
- **Real-time**: WebSocket connections for live updates
- **CORS**: Configured for local development
- **Storage**: In-memory room management (no database required)

## API Endpoints

- `POST /api/join-room/` - Join or create a game room
- `GET /api/room-status/<room_name>/` - Get room information
- `WS /ws/game/<room_name>/<player_name>/` - WebSocket connection for real-time updates

## Future Enhancements

- Implement actual poker game logic
- Add player authentication
- Persist game state with Redis or database
- Add spectator mode
- Implement game statistics