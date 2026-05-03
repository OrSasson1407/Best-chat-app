const { test, expect } = require('@playwright/test');

test.describe('Group Creation Flow', () => {
  test('User can create a new group chat', async ({ page }) => {
    // 1. Login
    await page.goto('http://localhost:5173/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('http://localhost:5173/chat');

    // 2. Open Create Group Modal
    // Assuming you have a button with an aria-label or specific text for this
    await page.click('button[aria-label="Create New Group"]'); 
    
    // Wait for the modal to appear
    const modal = page.locator('.create-group-modal'); // Adjust selector based on your styling
    await expect(modal).toBeVisible();

    // 3. Fill out the group details
    await page.fill('input[name="groupName"]', 'Playwright Test Group');
    
    // Select a user to add (assuming a dropdown or list of checkboxes)
    await page.click('text="Alice"'); 

    // 4. Submit the modal form
    await page.click('button:has-text("Create Group")');

    // 5. Verify the modal closes and the new group appears in the sidebar
    await expect(modal).not.toBeVisible();
    
    const sidebar = page.locator('.sidebar-contacts'); // Adjust selector
    await expect(sidebar).toContainText('Playwright Test Group');
  });
});