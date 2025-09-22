// @ts-check
const { test, expect } = require('@playwright/test');
const { 
  generateRoomName, 
  generatePlayerName, 
  joinRoom, 
  waitForWaitingRoom 
} = require('./helpers/gameHelpers');

test.describe('Room Joining Flow', () => {
  test('should create and join a new room', async ({ page }) => {
    const playerName = generatePlayerName();
    const roomName = generateRoomName();

    await joinRoom(page, playerName, roomName);
    await waitForWaitingRoom(page, 1);

    // Verify player is in the room
    await expect(page.locator('h1')).toContainText(`Room: ${roomName}`);
    await expect(page.locator('strong')).toContainText(`You are: ${playerName}`);
    await expect(page.locator('text=Players (1/6)')).toBeVisible();
    await expect(page.locator(`text=${playerName} (You)`)).toBeVisible();
  });

  test('should join existing room with multiple players', async ({ page, context }) => {
    const roomName = generateRoomName();
    const player1Name = generatePlayerName('alice');
    const player2Name = generatePlayerName('bob');
    
    // Create first player
    await joinRoom(page, player1Name, roomName);
    await waitForWaitingRoom(page, 1);

    // Create second player in new page
    const page2 = await context.newPage();
    await joinRoom(page2, player2Name, roomName);
    await waitForWaitingRoom(page2, 2);

    // Verify both players see each other
    await expect(page2.locator('text=Players (2/6)')).toBeVisible();
    await expect(page2.locator(`text=${player1Name}`)).toBeVisible();
    await expect(page2.locator(`text=${player2Name} (You)`)).toBeVisible();

    // Check first player's page also updated
    await expect(page.locator('text=Players (2/6)')).toBeVisible();
    await expect(page.locator(`text=${player2Name}`)).toBeVisible();

    await page2.close();
  });

  test('should show start button when 3 players join', async ({ page, context }) => {
    const roomName = generateRoomName();
    const players = [
      generatePlayerName('alice'),
      generatePlayerName('bob'), 
      generatePlayerName('charlie')
    ];

    const pages = [page];
    
    // Join first player
    await joinRoom(page, players[0], roomName);
    await waitForWaitingRoom(page, 1);
    
    // Should not be able to start with 1 player
    await expect(page.locator('button:has-text("Start Game")')).not.toBeVisible();
    await expect(page.locator('text=Waiting for more players')).toBeVisible();

    // Join second player
    const page2 = await context.newPage();
    pages.push(page2);
    await joinRoom(page2, players[1], roomName);
    await waitForWaitingRoom(page2, 2);
    
    // Should not be able to start with 2 players
    await expect(page2.locator('button:has-text("Start Game")')).not.toBeVisible();

    // Join third player
    const page3 = await context.newPage();
    pages.push(page3);
    await joinRoom(page3, players[2], roomName);
    await waitForWaitingRoom(page3, 3);

    // Now should be able to start
    await expect(page3.locator('button:has-text("Start Game")')).toBeVisible();
    await expect(page3.locator('text=Ready to start!')).toBeVisible();

    // All pages should show start button
    for (const p of pages) {
      await expect(p.locator('button:has-text("Start Game")')).toBeVisible();
    }

    // Cleanup
    for (let i = 1; i < pages.length; i++) {
      await pages[i].close();
    }
  });

  test('should handle leave room functionality', async ({ page, context }) => {
    const roomName = generateRoomName();
    const player1Name = generatePlayerName('alice');
    const player2Name = generatePlayerName('bob');

    // Join first player
    await joinRoom(page, player1Name, roomName);
    await waitForWaitingRoom(page, 1);

    // Join second player
    const page2 = await context.newPage();
    await joinRoom(page2, player2Name, roomName);
    await waitForWaitingRoom(page2, 2);

    // First player leaves
    await page.click('button:has-text("Leave Room")');
    await page.waitForURL('/');

    // Second player should see updated count
    await expect(page2.locator('text=Players (1/6)')).toBeVisible();
    await expect(page2.locator(`text=${player1Name}`)).not.toBeVisible();
    await expect(page2.locator(`text=${player2Name} (You)`)).toBeVisible();

    await page2.close();
  });

  test('should prevent duplicate player names', async ({ page, context }) => {
    const roomName = generateRoomName();
    const playerName = generatePlayerName();

    // First player joins successfully
    await joinRoom(page, playerName, roomName);
    await waitForWaitingRoom(page, 1);

    // Second player tries to join with same name
    const page2 = await context.newPage();
    await page2.goto('/');
    await page2.fill('#playerName', playerName);
    await page2.fill('#roomName', roomName);
    await page2.click('button[type="submit"]');

    // Should show error message
    await expect(page2.locator('text=already in the room')).toBeVisible();
    
    // Should still be on landing page
    await expect(page2.locator('h1:has-text("The Gang - Poker")')).toBeVisible();

    await page2.close();
  });

  test('should validate alphanumeric names', async ({ page }) => {
    await page.goto('/');

    // Try invalid player name
    await page.fill('#playerName', 'player@123');
    await page.fill('#roomName', 'testroom');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=must be alphanumeric')).toBeVisible();
    await expect(page.locator('h1:has-text("The Gang - Poker")')).toBeVisible();

    // Try invalid room name  
    await page.fill('#playerName', 'validplayer');
    await page.fill('#roomName', 'test-room');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=must be alphanumeric')).toBeVisible();
    await expect(page.locator('h1:has-text("The Gang - Poker")')).toBeVisible();
  });

  test('should require both player and room names', async ({ page }) => {
    await page.goto('/');

    // Try submitting without player name
    await page.fill('#roomName', 'testroom');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=are required')).toBeVisible();

    // Try submitting without room name
    await page.fill('#playerName', 'testplayer');
    await page.fill('#roomName', '');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=are required')).toBeVisible();
  });
});