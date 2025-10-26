# The Gang - Cooperative Poker Game

A real-time multiplayer cooperative poker variant where players work together to predict hand strengths.

![Screenshot](static/screenshot.jpg)

## Game Rules

**The Gang** is a cooperative poker game where all players win or lose together based on their ability to correctly predict hand strengths.

### Objective
Work as a team to correctly assign red chips (#1, #2, #3, etc.) to players based on the final strength of their poker hands. Player with red chip #1 should have the weakest hand, #2 the second weakest, and so on.

### Gameplay
1. **Four Rounds**: Pre-flop → Flop → Turn → River → Scoring
2. **Chip Colors**: Each round has a different colored chip (White → Yellow → Orange → Red)
3. **Strategic Bidding**: Players take chips from the public area or steal from other players
4. **Bidding History**: All previous chip selections are visible to help infer hand strengths
5. **Final Prediction**: Red chips in the river round represent your team's prediction of final hand rankings

### Winning Condition
The team wins if the red chip assignments match the actual hand strength rankings. If any red chip is assigned incorrectly, the entire team loses.

### Poker Hand Rankings
Standard poker hands apply (Royal Flush > Straight Flush > Four of a Kind > Full House > Flush > Straight > Three of a Kind > Two Pair > One Pair > High Card).

## Setup

### Prerequisites
```bash
# Create virtual environment and install dependencies
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Install frontend dependencies
cd frontend
npm install
npm install react-scripts
cd ..
```

### Quick Start

**Production Mode (Port 80):**
```bash
sudo ./start_servers.sh
```
Then open http://localhost in your browser.

**Development Mode (Ports 8000 + 3000):**
```bash
./start_dev.sh
```
Then open http://localhost:3000 in your browser (with hot reloading).

### Manual Setup

**Production:**
```bash
# Build frontend
cd frontend && npm run build && cd ..

# Start Django server (serves both API and frontend on port 80)
sudo daphne -b 0.0.0.0 -p 80 thegang.asgi:application
```

**Development:**
```bash
# Start Django backend (port 8000)
daphne -b 0.0.0.0 -p 8000 thegang.asgi:application

# In another terminal, start React frontend (port 3000)
cd frontend && npm start
```

### How to Play
1. Enter your player name and room name
2. Wait for other players to join (3-6 players needed)
3. Any player can start the game when enough players are present

---

For implementation details and development history, see [prompt.md](prompt.md).