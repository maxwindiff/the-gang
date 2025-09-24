// @ts-check
const { test, expect } = require('@playwright/test');
const { 
  generateRoomName, 
  generatePlayerName, 
  joinRoom, 
  waitForWaitingRoom 
} = require('./helpers/gameHelpers');

test.describe('Basic Tests', () => {
  test('should load landing page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('The Gang');
    await expect(page.locator('#playerName')).toBeVisible();
    await expect(page.locator('#roomName')).toBeVisible();
  });

  test('should create and join a room', async ({ page }) => {
    const playerName = generatePlayerName();
    const roomName = generateRoomName();

    await joinRoom(page, playerName, roomName);
    await waitForWaitingRoom(page, 1);

    // Verify basic room elements
    await expect(page.locator('h1')).toContainText(`Room: ${roomName}`);
    await expect(page.locator('text=Players (1/6)')).toBeVisible();
  });
});