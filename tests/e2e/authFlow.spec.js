const { test, expect } = require('@playwright/test');

test.describe('Authentication Lifecycle', () => {
  test('User can register, log out, and log back in', async ({ page }) => {
    const testEmail = `testuser_${Date.now()}@test.com`;

    // 1. Registration
    await page.goto('http://localhost:5173/register');
    await page.fill('input[name="username"]', 'E2ETester');
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    // Should redirect to chat after successful registration
    await expect(page).toHaveURL('http://localhost:5173/chat');

    // 2. Logout (Assuming there's a profile or settings menu)
    await page.click('button[aria-label="Profile Settings"]'); // Adjust selector
    await page.click('text="Log Out"');

    // Should redirect to login page
    await expect(page).toHaveURL('http://localhost:5173/login');

    // 3. Login with the new credentials
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    // Verify successful return to chat
    await expect(page).toHaveURL('http://localhost:5173/chat');
  });
});