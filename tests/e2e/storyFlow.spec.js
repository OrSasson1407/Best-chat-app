const { test, expect } = require('@playwright/test');

test.describe('Story Creation Flow', () => {
  test('User can create a text-based story and view it in the tray', async ({ page }) => {
    // 1. Login
    await page.goto('http://localhost:5173/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('http://localhost:5173/chat');

    // 2. Click the "Add Story" button in the tray
    const addStoryBtn = page.locator('button[aria-label="Add new story"]'); // Adjust based on your DOM
    await addStoryBtn.click();

    // 3. Ensure the Story creation modal opens
    const storyModal = page.locator('.story-creation-modal'); // Adjust selector
    await expect(storyModal).toBeVisible();

    // 4. Enter story text and submit
    await page.fill('textarea[placeholder="Type a status..."]', 'Just finished a great coding session!');
    await page.click('button:has-text("Post Story")');

    // 5. Verify modal closes and the story appears in the tray
    await expect(storyModal).not.toBeVisible();
    
    const storyTray = page.locator('.story-tray'); // Adjust selector
    // Depending on your UI, you might check for an active ring around the user's avatar 
    // or specific text if stories are expanded.
    await expect(storyTray).toBeVisible(); 
    
    // Check that our mock user's story indicator is active
    const myStoryRing = page.locator('.story-ring.my-story');
    await expect(myStoryRing).toBeVisible();
  });
});