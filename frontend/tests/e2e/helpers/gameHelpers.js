// Helper functions for game testing

/**
 * Generates a unique room name to avoid conflicts between tests
 */
function generateRoomName() {
  return `test${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

/**
 * Generates a unique player name
 */
function generatePlayerName(prefix = 'player') {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

/**
 * Joins a room through the landing page
 */
async function joinRoom(page, playerName, roomName) {
  await page.goto('/');
  await page.fill('#playerName', playerName);
  await page.fill('#roomName', roomName);
  await page.click('button[type="submit"]');
}

/**
 * Waits for a player to be in the waiting room
 */
async function waitForWaitingRoom(page, expectedPlayerCount = null) {
  await page.waitForURL(/\/waiting\/.+\/.+/);
  await page.waitForSelector('h1', { timeout: 10000 });
  
  if (expectedPlayerCount) {
    await page.waitForSelector(`text=Players (${expectedPlayerCount}/6)`, { timeout: 10000 });
  }
}

/**
 * Starts a game from the waiting room
 */
async function startGame(page) {
  await page.waitForSelector('button:has-text("Start Game")', { timeout: 10000 });
  await page.click('button:has-text("Start Game")');
}

/**
 * Waits for the game to start and navigate to game page
 */
async function waitForGameStart(page) {
  await page.waitForURL(/\/game\/.+\/.+/, { timeout: 15000 });
  await page.waitForSelector('text=Game in Progress', { timeout: 10000 });
}

/**
 * Takes a chip from the public area
 */
async function takeChipFromPublic(page, chipNumber) {
  const chipSelector = `button:has-text("${chipNumber}")`;
  await page.waitForSelector(chipSelector, { timeout: 5000 });
  await page.click(chipSelector);
}

/**
 * Takes a chip from another player
 */
async function takeChipFromPlayer(page, targetPlayer) {
  const takeButtonSelector = `button:has-text("Take")`;
  const playerRowSelector = `tr:has(td:has-text("${targetPlayer}"))`;
  
  await page.waitForSelector(`${playerRowSelector} ${takeButtonSelector}`, { timeout: 5000 });
  await page.click(`${playerRowSelector} ${takeButtonSelector}`);
}

/**
 * Returns the current player's chip to public area
 */
async function returnChip(page) {
  await page.waitForSelector('button:has-text("Return")', { timeout: 5000 });
  await page.click('button:has-text("Return")');
}

/**
 * Advances the game to the next round
 */
async function advanceRound(page) {
  await page.waitForSelector('button:has-text("Next Round"), button:has-text("Go to Scoring")', { timeout: 5000 });
  await page.click('button:has-text("Next Round"), button:has-text("Go to Scoring")');
}

/**
 * Waits for a specific round to be active
 */
async function waitForRound(page, roundName) {
  await page.waitForSelector(`text=${roundName}`, { timeout: 10000 });
}

/**
 * Checks if a player has a chip of a specific color
 */
async function playerHasChip(page, playerName, chipColor) {
  const selector = `tr:has(td:has-text("${playerName}")) td[style*="${getChipColorStyle(chipColor)}"]`;
  try {
    await page.waitForSelector(selector, { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets the background color style for a chip color
 */
function getChipColorStyle(chipColor) {
  const colors = {
    white: '#f8f9fa',
    yellow: '#fff3cd', 
    orange: '#ffcc80',
    red: '#f8d7da'
  };
  return colors[chipColor] || colors.white;
}

/**
 * Waits for scoring results to appear
 */
async function waitForScoring(page) {
  await page.waitForSelector('text=🎉 TEAM VICTORY! 🎉, text=💔 TEAM DEFEAT 💔', { timeout: 15000 });
}

/**
 * Checks if the team won or lost
 */
async function getGameResult(page) {
  try {
    await page.waitForSelector('text=🎉 TEAM VICTORY! 🎉', { timeout: 2000 });
    return 'victory';
  } catch {
    try {
      await page.waitForSelector('text=💔 TEAM DEFEAT 💔', { timeout: 2000 });
      return 'defeat';
    } catch {
      return 'unknown';
    }
  }
}

/**
 * Restarts the game from scoring screen
 */
async function restartGame(page) {
  await page.waitForSelector('button:has-text("Start New Game")', { timeout: 5000 });
  await page.click('button:has-text("Start New Game")');
}

/**
 * Leaves the room/game
 */
async function leaveRoom(page) {
  await page.waitForSelector('button:has-text("Leave Room"), button:has-text("Back to Home")', { timeout: 5000 });
  await page.click('button:has-text("Leave Room"), button:has-text("Back to Home")');
}

module.exports = {
  generateRoomName,
  generatePlayerName,
  joinRoom,
  waitForWaitingRoom,
  startGame,
  waitForGameStart,
  takeChipFromPublic,
  takeChipFromPlayer,
  returnChip,
  advanceRound,
  waitForRound,
  playerHasChip,
  waitForScoring,
  getGameResult,
  restartGame,
  leaveRoom
};