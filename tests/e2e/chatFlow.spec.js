const { test, expect } = require('@playwright/test');

test.describe('Full Application Flow', () => {
  test('User can log in, navigate to a chat, and send a message', async ({ page }) => {
    // 1. Navigate to the login page
    await page.goto('http://localhost:5173/login'); // Adjust port to your Vite dev server

    // 2. Perform Login
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    // 3. Verify successful redirection to the main Chat interface
    await expect(page).toHaveURL('http://localhost:5173/chat');
    
    // Wait for the contact list to load
    await page.waitForSelector('.contact-list'); 

    // 4. Click on a specific contact/group
    await page.click('text="General Chat"'); // Adjust to match a real contact name

    // 5. Type and send a message in the InputArea
    await page.fill('input[placeholder="Type a message..."]', 'Playwright E2E Test Message');
    await page.press('input[placeholder="Type a message..."]', 'Enter');

    // 6. Verify the message appears in the MessageWindow
    const messageWindow = page.locator('.message-window'); // Adjust selector based on your styles
    await expect(messageWindow).toContainText('Playwright E2E Test Message');
  });
});