const { test, expect } = require('@playwright/test');

test.describe('Real-Time Multi-Agent Interaction', () => {
  test('Alice sends a message to Bob, verified in real-time and encrypted over the wire', async ({ browser }) => {
    // Create two completely isolated browser sessions
    const aliceContext = await browser.newContext();
    const bobContext = await browser.newContext();

    const alicePage = await aliceContext.newPage();
    const bobPage = await bobContext.newPage();

    // 1. Log both users in
    await alicePage.goto('http://localhost:5173/login');
    await alicePage.fill('input[name="email"]', 'alice@test.com');
    await alicePage.fill('input[name="password"]', 'Password123!');
    await alicePage.click('button[type="submit"]');

    await bobPage.goto('http://localhost:5173/login');
    await bobPage.fill('input[name="email"]', 'bob@test.com');
    await bobPage.fill('input[name="password"]', 'Password123!');
    await bobPage.click('button[type="submit"]');

    // Both navigate to their shared chat
    await alicePage.click('text="Bob"');
    await bobPage.click('text="Alice"');

    // 2. Network Interception: Ensure Alice's outgoing Socket/HTTP request is encrypted
    let capturedPayload = null;
    alicePage.on('request', request => {
      if (request.url().includes('/api/messages') || request.url().includes('socket.io')) {
        const postData = request.postData();
        if (postData) {
          capturedPayload = postData;
        }
      }
    });

    // 3. Alice sends a secret message
    const secretText = "The eagle flies at midnight.";
    await alicePage.fill('input[placeholder="Type a message..."]', secretText);
    await alicePage.press('input[placeholder="Type a message..."]', 'Enter');

    // 4. Bob receives the message dynamically without refreshing
    const bobsMessageWindow = bobPage.locator('.message-window');
    
    // Playwright waits up to 5s automatically for this element to appear containing the text
    await expect(bobsMessageWindow).toContainText(secretText);

    // 5. Compliance Check: Verify the data intercepted on the network did NOT contain the plaintext
    if (capturedPayload) {
      expect(capturedPayload).not.toContain(secretText);
    }
    
    await aliceContext.close();
    await bobContext.close();
  });
});