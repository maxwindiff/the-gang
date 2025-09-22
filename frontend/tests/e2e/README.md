# End-to-End Testing with Playwright

This directory contains comprehensive end-to-end tests for The Gang poker application using Playwright.

## Test Structure

### Test Files

- **`room-joining.spec.js`** - Tests for room creation, joining, validation, and basic room management
- **`game-mechanics.spec.js`** - Tests for complete game flow, chip mechanics, round progression, and scoring
- **`error-scenarios.spec.js`** - Tests for error handling, edge cases, and robustness

### Helper Functions

- **`helpers/gameHelpers.js`** - Reusable functions for common game actions and assertions

## Running Tests

### Prerequisites

Both frontend and backend servers should be running:
```bash
# Terminal 1 - Backend
cd /Users/kichi/dev/the-gang
source venv/bin/activate
python manage.py runserver 8000

# Terminal 2 - Frontend  
cd frontend
npm start
```

### Test Commands

```bash
# Run all E2E tests (headless)
npm run test:e2e

# Run tests with UI (interactive)
npm run test:e2e:ui

# Run tests in headed mode (see browser)
npm run test:e2e:headed

# Debug tests step by step
npm run test:e2e:debug

# Run specific test file
npx playwright test room-joining.spec.js

# Run specific test
npx playwright test --grep "should create and join a new room"
```

## Test Scenarios Covered

### Room Management
- ✅ Create and join new rooms
- ✅ Multiple players joining same room
- ✅ Room capacity enforcement (3-6 players)
- ✅ Start game button visibility logic
- ✅ Leave room functionality
- ✅ Input validation (alphanumeric, required fields)
- ✅ Duplicate player name prevention

### Game Mechanics
- ✅ Complete 4-round game flow (preflop → flop → turn → river → scoring)
- ✅ Chip taking from public area
- ✅ Chip stealing between players
- ✅ Chip return functionality
- ✅ Round advancement requirements
- ✅ Chip history tracking
- ✅ Scoring and game results
- ✅ Game restart functionality

### Error Handling & Edge Cases
- ✅ Server connection status monitoring
- ✅ Invalid chip actions
- ✅ Player disconnection during game
- ✅ Room capacity limits
- ✅ Special character validation
- ✅ Rapid clicking/double submission
- ✅ Navigation robustness
- ✅ Empty game states

## Test Features

### Multi-Player Simulation
Tests simulate multiple players by opening multiple browser contexts, allowing realistic testing of real-time game interactions.

### Unique Test Data
Each test generates unique room and player names to avoid conflicts between parallel test runs.

### Comprehensive Assertions
Tests verify both UI state and game logic, ensuring the frontend correctly reflects backend game state.

### Real WebSocket Testing
Tests use actual WebSocket connections to verify real-time synchronization between players.

## Configuration

### Playwright Config (`playwright.config.js`)
- Single worker to prevent room name conflicts
- Automatic server startup for CI environments
- Screenshots and videos on failure
- Trace collection for debugging

### Browser Support
- Primary: Chromium (Chrome/Edge)
- Additional browsers can be enabled in config

## Debugging Failed Tests

1. **Screenshots**: Check `test-results/` for failure screenshots
2. **Videos**: Watch recorded videos of failed test runs
3. **Traces**: Use Playwright trace viewer for step-by-step debugging
4. **Debug Mode**: Run with `--debug` to step through tests manually

## Best Practices

1. **Unique Identifiers**: Always use generated room/player names
2. **Proper Cleanup**: Close additional browser pages to prevent resource leaks
3. **Wait Strategies**: Use proper wait conditions for dynamic content
4. **Error Recovery**: Tests should handle temporary network issues gracefully
5. **Isolation**: Each test should be independent and not rely on others