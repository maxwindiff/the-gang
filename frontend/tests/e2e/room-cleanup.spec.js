// @ts-check
const { test, expect } = require('@playwright/test');
const { 
  generateRoomName, 
  generatePlayerName, 
  joinRoom, 
  waitForWaitingRoom 
} = require('./helpers/gameHelpers');

test.describe('Room Cleanup Tests', () => {
  test('should clean up room when all players disconnect', async ({ page, context }) => {
    const roomName = generateRoomName();
    const players = [
      generatePlayerName('alice'),
      generatePlayerName('bob')
    ];

    // Create multiple players in the same room
    const pages = [page];
    await joinRoom(page, players[0], roomName);
    await waitForWaitingRoom(page, 1);

    const page2 = await context.newPage();
    pages.push(page2);
    await joinRoom(page2, players[1], roomName);
    await waitForWaitingRoom(page2, 2);

    // Verify room exists and has players
    await expect(page.locator('text=Players (2/6)')).toBeVisible();

    // Close all player connections (simulating unexpected disconnects)
    await page.close();
    await page2.close();

    // Create a new page and try to join the same room name
    const page3 = await context.newPage();
    await joinRoom(page3, generatePlayerName('charlie'), roomName);
    
    // Should be able to create a new room with the same name
    // (indicating the old room was cleaned up)
    await waitForWaitingRoom(page3, 1);
    await expect(page3.locator('text=Players (1/6)')).toBeVisible();
    
    await page3.close();
  });

  test('should handle explicit room leaving', async ({ page, context }) => {
    const roomName = generateRoomName();
    const players = [
      generatePlayerName('alice'),
      generatePlayerName('bob')
    ];

    // Create multiple players
    await joinRoom(page, players[0], roomName);
    await waitForWaitingRoom(page, 1);

    const page2 = await context.newPage();
    await joinRoom(page2, players[1], roomName);
    await waitForWaitingRoom(page2, 2);

    // First player explicitly leaves
    await page.goto('/');
    await expect(page.locator('h1:has-text("The Gang - Poker")')).toBeVisible();

    // Second player should see updated room count
    await expect(page2.locator('text=Players (1/6)')).toBeVisible();

    // Second player also leaves
    await page2.goto('/');

    // Try to create new room with same name
    const page3 = await context.newPage();
    await joinRoom(page3, generatePlayerName('charlie'), roomName);
    await waitForWaitingRoom(page3, 1);
    
    await page3.close();
  });

  test('should maintain room when players are still connected', async ({ page, context }) => {
    const roomName = generateRoomName();
    const players = [
      generatePlayerName('alice'),
      generatePlayerName('bob')
    ];

    // Create two players
    await joinRoom(page, players[0], roomName);
    await waitForWaitingRoom(page, 1);

    const page2 = await context.newPage();
    await joinRoom(page2, players[1], roomName);
    await waitForWaitingRoom(page2, 2);

    // Close one player
    await page.close();

    // Other player should still see the room
    await expect(page2.locator('text=Players (1/6)')).toBeVisible();
    
    // Third player should be able to join the existing room
    const page3 = await context.newPage();
    await joinRoom(page3, generatePlayerName('charlie'), roomName);
    await waitForWaitingRoom(page3, 2);
    
    // Cleanup
    await page2.close();
    await page3.close();
  });
});