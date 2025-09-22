// @ts-check
const { test, expect } = require('@playwright/test');
const { 
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
  waitForScoring,
  getGameResult,
  restartGame
} = require('./helpers/gameHelpers');

test.describe('Game Mechanics', () => {
  test('should complete full game flow with 3 players', async ({ page, context }) => {
    const roomName = generateRoomName();
    const players = [
      generatePlayerName('alice'),
      generatePlayerName('bob'),
      generatePlayerName('charlie')
    ];

    // Set up 3 players
    const pages = [page];
    await joinRoom(page, players[0], roomName);
    await waitForWaitingRoom(page, 1);

    const page2 = await context.newPage();
    pages.push(page2);
    await joinRoom(page2, players[1], roomName);
    await waitForWaitingRoom(page2, 2);

    const page3 = await context.newPage();
    pages.push(page3);
    await joinRoom(page3, players[2], roomName);
    await waitForWaitingRoom(page3, 3);

    // Start the game
    await startGame(page);
    
    // All players should be in game
    for (const p of pages) {
      await waitForGameStart(p);
      await expect(p.locator('text=Round: preflop')).toBeVisible();
      await expect(p.locator('text=Available Chips (Public Area)')).toBeVisible();
    }

    // Test chip taking in preflop (white chips)
    await takeChipFromPublic(page, '1');
    await takeChipFromPublic(page2, '2'); 
    await takeChipFromPublic(page3, '3');

    // Verify all players have chips
    for (const p of pages) {
      await expect(p.locator('text=All chips have been taken')).toBeVisible();
      await expect(p.locator('button:has-text("Next Round")')).toBeVisible();
    }

    // Advance to flop
    await advanceRound(page);
    for (const p of pages) {
      await waitForRound(p, 'flop');
      await expect(p.locator('text=3 community cards')).toBeVisible();
    }

    // Test chip stealing in flop (yellow chips)
    await takeChipFromPublic(page, '1');
    await takeChipFromPublic(page2, '2');
    await takeChipFromPlayer(page3, players[0]); // Charlie steals from Alice

    // Verify chip transfer
    await expect(page.locator('text=All chips have been taken')).toBeVisible();
    await advanceRound(page);
    
    // Continue to turn
    for (const p of pages) {
      await waitForRound(p, 'turn');
      await expect(p.locator('text=4 community cards')).toBeVisible();
    }

    // Take orange chips
    await takeChipFromPublic(page, '1');
    await takeChipFromPublic(page2, '2');
    await takeChipFromPublic(page3, '3');
    
    await advanceRound(page);

    // Continue to river
    for (const p of pages) {
      await waitForRound(p, 'river');
      await expect(p.locator('text=5 community cards')).toBeVisible();
    }

    // Take red chips
    await takeChipFromPublic(page, '1');
    await takeChipFromPublic(page2, '2');
    await takeChipFromPublic(page3, '3');

    await advanceRound(page);

    // Wait for scoring
    for (const p of pages) {
      await waitForScoring(p);
      await expect(p.locator('text=TEAM VICTORY, text=TEAM DEFEAT')).toBeVisible();
      await expect(p.locator('button:has-text("Play Again")')).toBeVisible();
    }

    // Cleanup
    for (let i = 1; i < pages.length; i++) {
      await pages[i].close();
    }
  });

  test('should handle chip return functionality', async ({ page, context }) => {
    const roomName = generateRoomName();
    const players = [
      generatePlayerName('alice'),
      generatePlayerName('bob'),
      generatePlayerName('charlie')
    ];

    // Set up 3 players and start game
    const pages = [page];
    await joinRoom(page, players[0], roomName);
    await waitForWaitingRoom(page, 1);

    const page2 = await context.newPage();
    pages.push(page2);
    await joinRoom(page2, players[1], roomName);

    const page3 = await context.newPage(); 
    pages.push(page3);
    await joinRoom(page3, players[2], roomName);

    await startGame(page);
    for (const p of pages) {
      await waitForGameStart(p);
    }

    // Player 1 takes a chip
    await takeChipFromPublic(page, '1');
    
    // Player 1 returns the chip
    await returnChip(page);

    // Verify chip is back in public area
    await expect(page.locator('button:has-text("1")')).toBeVisible();

    // Another player can take it
    await takeChipFromPublic(page2, '1');
    await expect(page2.locator('text=All chips have been taken')).not.toBeVisible();

    // Cleanup
    for (let i = 1; i < pages.length; i++) {
      await pages[i].close();
    }
  });

  test('should track chip history correctly', async ({ page, context }) => {
    const roomName = generateRoomName();
    const players = [
      generatePlayerName('alice'),
      generatePlayerName('bob'),
      generatePlayerName('charlie')
    ];

    // Set up and start game
    const pages = [page];
    await joinRoom(page, players[0], roomName);
    
    const page2 = await context.newPage();
    pages.push(page2);
    await joinRoom(page2, players[1], roomName);

    const page3 = await context.newPage();
    pages.push(page3);
    await joinRoom(page3, players[2], roomName);

    await startGame(page);
    for (const p of pages) {
      await waitForGameStart(p);
    }

    // Take chips in preflop
    await takeChipFromPublic(page, '1');   // Alice: 1
    await takeChipFromPublic(page2, '2');  // Bob: 2  
    await takeChipFromPublic(page3, '3');  // Charlie: 3

    // Advance to flop
    await advanceRound(page);
    for (const p of pages) {
      await waitForRound(p, 'flop');
    }

    // Take chips in flop 
    await takeChipFromPublic(page, '2');   // Alice: 2
    await takeChipFromPublic(page2, '1');  // Bob: 1
    await takeChipFromPublic(page3, '3');  // Charlie: 3

    // Verify chip history shows in bidding table
    await expect(page.locator('table')).toBeVisible();
    
    // Each player should see their chip history
    const aliceRow = page.locator(`tr:has(td:has-text("${players[0]}"))`);
    await expect(aliceRow.locator('td').nth(1)).toContainText('1'); // White chip
    await expect(aliceRow.locator('td').nth(2)).toContainText('2'); // Yellow chip

    // Cleanup
    for (let i = 1; i < pages.length; i++) {
      await pages[i].close();
    }
  });

  test('should handle game restart functionality', async ({ page, context }) => {
    const roomName = generateRoomName();
    const players = [
      generatePlayerName('alice'),
      generatePlayerName('bob'),
      generatePlayerName('charlie')
    ];

    // Quick game setup and completion
    const pages = [page];
    await joinRoom(page, players[0], roomName);
    
    const page2 = await context.newPage();
    pages.push(page2);
    await joinRoom(page2, players[1], roomName);

    const page3 = await context.newPage();
    pages.push(page3);
    await joinRoom(page3, players[2], roomName);

    // Complete one full game
    await startGame(page);
    for (const p of pages) {
      await waitForGameStart(p);
    }

    // Quickly advance through all rounds
    for (let round = 0; round < 4; round++) {
      // Take chips for each player
      await takeChipFromPublic(page, '1');
      await takeChipFromPublic(page2, '2');
      await takeChipFromPublic(page3, '3');
      
      if (round < 3) {
        await advanceRound(page);
      }
    }

    // Advance to scoring
    await advanceRound(page);
    
    // Wait for scoring results
    for (const p of pages) {
      await waitForScoring(p);
    }

    // Restart the game
    await restartGame(page);

    // Verify game restarted
    for (const p of pages) {
      await waitForGameStart(p);
      await expect(p.locator('text=Round: preflop')).toBeVisible();
      await expect(p.locator('text=Available Chips (Public Area)')).toBeVisible();
    }

    // Cleanup
    for (let i = 1; i < pages.length; i++) {
      await pages[i].close();
    }
  });

  test('should prevent advancement without all players having chips', async ({ page, context }) => {
    const roomName = generateRoomName();
    const players = [
      generatePlayerName('alice'),
      generatePlayerName('bob'),
      generatePlayerName('charlie')
    ];

    // Set up 3 players and start game
    const pages = [page];
    await joinRoom(page, players[0], roomName);
    
    const page2 = await context.newPage();
    pages.push(page2);
    await joinRoom(page2, players[1], roomName);

    const page3 = await context.newPage();
    pages.push(page3);
    await joinRoom(page3, players[2], roomName);

    await startGame(page);
    for (const p of pages) {
      await waitForGameStart(p);
    }

    // Only 2 players take chips
    await takeChipFromPublic(page, '1');
    await takeChipFromPublic(page2, '2');
    // Player 3 doesn't take a chip

    // Should not be able to advance
    await expect(page.locator('button:has-text("Next Round")')).not.toBeVisible();
    await expect(page.locator('text=All chips have been taken')).not.toBeVisible();

    // When third player takes chip, should be able to advance
    await takeChipFromPublic(page3, '3');
    
    for (const p of pages) {
      await expect(p.locator('button:has-text("Next Round")')).toBeVisible();
    }

    // Cleanup
    for (let i = 1; i < pages.length; i++) {
      await pages[i].close();
    }
  });
});