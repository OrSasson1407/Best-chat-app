const { test, expect } = require('@playwright/test');

test.describe('E2E: User Profile Settings Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@test.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/chat');
  });

  // Test 16
  test('16. Opens profile settings modal from the sidebar', async ({ page }) => {
    await page.click('button[aria-label="Open Settings"]');
    await expect(page.locator('h2:has-text("Profile Settings")')).toBeVisible();
  });

  // Test 17
  test('17. Updates display name and verifies persistence across reloads', async ({ page }) => {
    await page.click('button[aria-label="Open Settings"]');
    await page.fill('input[name="displayName"]', 'New E2E Name');
    await page.click('button:has-text("Save Changes")');
    await expect(page.locator('text=Profile updated successfully')).toBeVisible();
    await page.reload();
    await page.click('button[aria-label="Open Settings"]');
    await expect(page.locator('input[name="displayName"]')).toHaveValue('New E2E Name');
  });

  // Test 18
  test('18. Changes online status to away using the dropdown', async ({ page }) => {
    await page.click('button[aria-label="Open Settings"]');
    await page.selectOption('select[name="status"]', 'away');
    await page.click('button:has-text("Save Changes")');
    await expect(page.locator('.status-indicator')).toHaveClass(/away/);
  });

  // Test 19
  test('19. Toggles dark/light mode from the application shell', async ({ page }) => {
    const themeToggle = page.locator('button[aria-label="Toggle Theme"]');
    await themeToggle.click();
    await expect(page.locator('body')).toHaveClass(/dark-theme/);
    await themeToggle.click();
    await expect(page.locator('body')).toHaveClass(/light-theme/);
  });

  // Test 20
  test('20. Closes profile modal without saving should reset to original state', async ({ page }) => {
    await page.click('button[aria-label="Open Settings"]');
    const originalName = await page.inputValue('input[name="displayName"]');
    await page.fill('input[name="displayName"]', 'Temp Name');
    await page.click('button[aria-label="Close"]');
    await page.click('button[aria-label="Open Settings"]');
    await expect(page.locator('input[name="displayName"]')).toHaveValue(originalName);
  });
});