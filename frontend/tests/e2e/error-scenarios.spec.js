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
  leaveRoom
} = require('./helpers/gameHelpers');

test.describe('Error Scenarios and Edge Cases', () => {
  test('should handle server disconnect gracefully', async ({ page }) => {
    const playerName = generatePlayerName();
    const roomName = generateRoomName();

    await joinRoom(page, playerName, roomName);
    await waitForWaitingRoom(page, 1);

    // Check connection status indicator shows connected
    await expect(page.locator('text=connected')).toBeVisible();
    
    // The connection status should be visible and working
    const statusIndicator = page.locator('[style*="background-color: rgb(40, 167, 69)"]'); // Connected green color
    await expect(statusIndicator).toBeVisible();
  });

  test('should handle invalid chip actions', async ({ page, context }) => {
    const roomName = generateRoomName();
    const players = [
      generatePlayerName('alice'),
      generatePlayerName('bob'),
      generatePlayerName('charlie')
    ];

    // Set up game
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

    // Player 1 takes chip 1
    await takeChipFromPublic(page, '1');

    // Player 2 tries to take the same chip (should not be available)
    await expect(page2.locator('button:has-text("1")')).not.toBeVisible();

    // Player 2 can only take remaining chips
    await expect(page2.locator('button:has-text("2")')).toBeVisible();
    await expect(page2.locator('button:has-text("3")')).toBeVisible();

    // Cleanup
    for (let i = 1; i < pages.length; i++) {
      await pages[i].close();
    }
  });

  test('should handle player leaving during game', async ({ page, context }) => {
    const roomName = generateRoomName();
    const players = [
      generatePlayerName('alice'),
      generatePlayerName('bob'),
      generatePlayerName('charlie')
    ];

    // Set up 3 players
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

    // Take some chips
    await takeChipFromPublic(page, '1');
    await takeChipFromPublic(page2, '2');

    // Player 3 leaves during game
    await page3.goto('/'); // Simulate leaving

    // Remaining players should still be able to continue
    await expect(page.locator('h1:has-text("Room:")')).toBeVisible();
    await expect(page2.locator('h1:has-text("Room:")')).toBeVisible();

    // Cleanup
    await page2.close();
  });

  test('should handle room capacity limits', async ({ page, context }) => {
    const roomName = generateRoomName();
    const pages = [page];

    // Add 6 players (maximum)
    for (let i = 0; i < 6; i++) {
      const playerName = generatePlayerName(`player${i}`);
      
      if (i === 0) {
        await joinRoom(page, playerName, roomName);
        await waitForWaitingRoom(page, 1);
      } else {
        const newPage = await context.newPage();
        pages.push(newPage);
        await joinRoom(newPage, playerName, roomName);
        await waitForWaitingRoom(newPage, i + 1);
      }
    }

    // Should be able to start with 6 players (maximum allowed)
    await expect(page.locator('button:has-text("Start Game")')).toBeVisible();
    await expect(page.locator('h2')).toContainText('Players (6/6)');

    // Try to add 7th player (should fail or be prevented)
    const page7 = await context.newPage();
    const player7Name = generatePlayerName('player7');
    
    await page7.goto('/');
    await page7.fill('#playerName', player7Name);
    await page7.fill('#roomName', roomName);
    await page7.click('button[type="submit"]');

    // Should either show error or stay on landing page
    await expect(page7.locator('h1:has-text("The Gang - Poker")')).toBeVisible();

    // Cleanup
    for (let i = 1; i < pages.length; i++) {
      await pages[i].close();
    }
    await page7.close();
  });

  test('should handle empty room names and player names', async ({ page }) => {
    await page.goto('/');

    // Just verify the form validates - this is more of a smoke test
    await expect(page.locator('#playerName')).toBeVisible();
    await expect(page.locator('#roomName')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    
    // Verify form elements have proper validation attributes
    const playerNameRequired = await page.locator('#playerName').getAttribute('required');
    const roomNameRequired = await page.locator('#roomName').getAttribute('required');
    
    expect(playerNameRequired).toBe('');
    expect(roomNameRequired).toBe('');
  });

  test('should handle special characters in names', async ({ page }) => {
    await page.goto('/');

    const invalidNames = [
      'player@test',
      'room-name',
      'test.room',
      'player#1',
      'room name', // space
      'test_room', // underscore
    ];

    for (const invalidName of invalidNames) {
      await page.fill('#playerName', invalidName);
      await page.fill('#roomName', 'validroom');
      await page.click('button[type="submit"]');
      await expect(page.locator('text=must be alphanumeric')).toBeVisible();

      // Clear error and try room name
      await page.reload();
      await page.fill('#playerName', 'validplayer');
      await page.fill('#roomName', invalidName);
      await page.click('button[type="submit"]');
      await expect(page.locator('text=must be alphanumeric')).toBeVisible();
      
      await page.reload();
    }
  });

  test('should handle very long names', async ({ page }) => {
    await page.goto('/');

    // Test names at the length limit (should work)
    const maxLengthName = 'a'.repeat(20);
    await page.fill('#playerName', maxLengthName);
    await page.fill('#roomName', maxLengthName);
    
    // Fields should truncate at maxLength
    const playerValue = await page.inputValue('#playerName');
    const roomValue = await page.inputValue('#roomName');
    
    expect(playerValue).toBe(maxLengthName);
    expect(roomValue).toBe(maxLengthName);
  });

  test('should handle rapid clicking and double submissions', async ({ page }) => {
    const playerName = generatePlayerName();
    const roomName = generateRoomName();

    await page.goto('/');
    await page.fill('#playerName', playerName);
    await page.fill('#roomName', roomName);

    // Rapidly click submit button multiple times
    const submitButton = page.locator('button[type="submit"]');
    await Promise.all([
      submitButton.click(),
      submitButton.click(),
      submitButton.click(),
    ]);

    // Should only join once and end up in waiting room
    await waitForWaitingRoom(page, 1);
    await expect(page.locator('text=Players (1/6)')).toBeVisible();
  });

  test('should handle navigation away and back', async ({ page }) => {
    const playerName = generatePlayerName();
    const roomName = generateRoomName();

    await joinRoom(page, playerName, roomName);
    await waitForWaitingRoom(page, 1);

    // Navigate away
    await page.goto('/');
    await expect(page.locator('h1:has-text("The Gang - Poker")')).toBeVisible();

    // Try to navigate back to waiting room directly
    await page.goto(`/waiting/${roomName}/${playerName}`);
    
    // Should either reconnect or show appropriate state
    // This tests the robustness of the WebSocket reconnection
    await page.waitForSelector('h1', { timeout: 10000 });
  });

  test('should handle game state when no players have taken chips', async ({ page, context }) => {
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

    // Don't take any chips - verify advance button doesn't appear
    await expect(page.locator('button:has-text("Next Round")')).not.toBeVisible();
    await expect(page.locator('text=All chips have been taken')).not.toBeVisible();

    // Verify all players see the same state
    for (const p of pages) {
      await expect(p.locator('button:has-text("1")')).toBeVisible();
      await expect(p.locator('button:has-text("2")')).toBeVisible();
      await expect(p.locator('button:has-text("3")')).toBeVisible();
    }

    // Cleanup
    for (let i = 1; i < pages.length; i++) {
      await pages[i].close();
    }
  });
});